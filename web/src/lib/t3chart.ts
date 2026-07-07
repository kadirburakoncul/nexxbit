// Shared Binance klines fetch + Tillson T3 computation

/** UTC+3 (Europe/Istanbul) offset — lightweight-charts zaman eksenini UTC+3'e çevirmek için */
export const UTC3_OFFSET = 3 * 3600

export interface BKline {
  time: number   // unix seconds (UTC)
  open: number
  high: number
  low: number
  close: number
  volume: number // base asset volume
}

export async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  limit = 200,
): Promise<BKline[]> {
  const url =
    `https://api.binance.com/api/v3/klines` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`)
  const raw: [number, string, string, string, string, string, ...unknown[]][] = await res.json()
  return raw.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }))
}

// ─── T3 indicator ─────────────────────────────────────────────────────────────

function ema(data: number[], k: number): number[] {
  let prev = data[0]
  return data.map(v => { prev = v * k + prev * (1 - k); return prev })
}

export interface T3Result {
  values: number[]
  currentT3Up: boolean
  t3TurnUp: boolean
  t3TurnDown: boolean
  currentT3: number
  /** 2-bar konfirmasyon tamamlandı mı (son iki kapanmış bar senkron yönde) */
  hasConfirmation: boolean
}

export function computeT3(candles: BKline[], period: number, vFactor: number): T3Result {
  const src = candles.map(c => (c.high + c.low + 2 * c.close) / 4)
  const k = 2 / (period + 1)
  const e1 = ema(src, k), e2 = ema(e1, k), e3 = ema(e2, k)
  const e4 = ema(e3, k), e5 = ema(e4, k), e6 = ema(e5, k)
  const v2 = vFactor * vFactor, v3 = vFactor * v2
  const c1 = -v3, c2 = 3 * v2 + 3 * v3
  const c3 = -6 * v2 - 3 * vFactor - 3 * v3, c4 = 1 + 3 * vFactor + v3 + 3 * v2
  const values = e1.map((_, i) => c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i])
  const n = values.length

  // Backend SignalEngine.cs ile birebir eşleşen 2-bar konfirmasyon (3 koşul):
  // [n-1] = açık (kapanmamış) mum  ← sinyal hesabına dahil edilmez
  // [n-2] = son kapanmış mum       ← onay barı (t3[^2])
  // [n-3] = dönüş barı             ← t3[^3]
  // [n-4] = önceki yön barı        ← t3[^4]
  // [n-5] = önceki önceki yön barı ← t3[^5]
  //
  // Backend: t3TurnUp = t3[^3]>t3[^4] && !(t3[^4]>t3[^5]) && t3[^2]>t3[^3]
  const t3TurnUp = n >= 5 &&
    values[n-3] > values[n-4] &&    // dönüş barı [n-3], [n-4]'ten yukarı döndü
    !(values[n-4] > values[n-5]) && // [n-4] önceki bardan aşağıdaydı (önceki yön aşağıydı)
    values[n-2] > values[n-3]       // onay barı [n-2] dönüşü teyit etti

  // Backend: t3TurnDown = !(t3[^3]>t3[^4]) && t3[^4]>t3[^5] && !(t3[^2]>t3[^3])
  const t3TurnDown = n >= 5 &&
    !(values[n-3] > values[n-4]) && // dönüş barı [n-3] aşağı döndü
    values[n-4] > values[n-5] &&    // [n-4] önceki bardan yukarıdaydı (önceki yön yukarıydı)
    !(values[n-2] > values[n-3])    // onay barı [n-2] aşağı yönü teyit etti

  const closedT3Up = n >= 3 && values[n-2] > values[n-3] // T3 mevcut yönü (son kapanmış bar)

  return {
    values,
    currentT3Up: closedT3Up,
    t3TurnUp,
    t3TurnDown,
    hasConfirmation: t3TurnUp || t3TurnDown,
    currentT3: n >= 2 ? values[n-2] : 0,
  }
}

// ─── RSI (Wilder's Smoothing) ─────────────────────────────────────────────────

export function computeRsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  if (closes.length <= period) return result

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1]
    avgGain += Math.max(delta, 0)
    avgLoss += Math.max(-delta, 0)
  }
  avgGain /= period
  avgLoss /= period

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return result
}

/** Son kapanmış mum için RSI değeri (index n-2, açık mum n-1) */
export function latestRsi(candles: BKline[], period = 14): number | null {
  const closes = candles.map(c => c.close)
  const rsi = computeRsi(closes, period)
  const val = rsi[rsi.length - 2]
  return isNaN(val) ? null : val
}

// ─── Volume helpers ───────────────────────────────────────────────────────────

/** 24-bar ortalama hacim (USDT cinsinden) */
export function avgVolumeUsdt(candles: BKline[], bars = 24): number {
  const slice = candles.slice(-bars - 1, -1) // son kapanmış bar dahil, açık hariç
  if (slice.length === 0) return 0
  return slice.reduce((s, c) => s + c.volume * c.close, 0) / slice.length
}

/** 20-bar ortalama hacim (base asset) */
export function avgVolume20(candles: BKline[]): number {
  const slice = candles.slice(-21, -1)
  if (slice.length === 0) return 0
  return slice.reduce((s, c) => s + c.volume, 0) / slice.length
}

/** Son kapanmış bar hacmi */
export function lastBarVolume(candles: BKline[]): number {
  return candles.length >= 2 ? candles[candles.length - 2].volume : 0
}

// ─── Signal Analysis ──────────────────────────────────────────────────────────

export interface SignalAnalysis {
  t3Up: boolean
  t3Confirmation: boolean           // 2-bar confirmation
  rsiValue: number | null           // null if filter disabled
  rsiOk: boolean | null             // null if filter disabled
  volUsdt: number | null            // null if filter disabled
  volUsdtOk: boolean | null         // null if filter disabled (minVolumeUsdt)
  volSurgeRatio: number | null      // lastVol / required — null if filter disabled
  volSurgeOk: boolean | null        // null if filter disabled
  lastCheckedReason: string | null  // backend reason text
}

export interface SignalFilterSettings {
  isRsiFilterEnabled: boolean
  minVolumeUsdt: number | null
  isVolumeSurgeFilterEnabled: boolean
  volumeSurgeMultiplier: number
  useMarketRegimeFilter: boolean
}

export function computeSignalAnalysis(
  candles: BKline[],
  t3Result: T3Result,
  settings: SignalFilterSettings,
  lastCheckedReason: string | null,
): SignalAnalysis {
  const rsiVal = settings.isRsiFilterEnabled ? latestRsi(candles) : null
  const rsiOk  = rsiVal !== null ? rsiVal > 50 : null

  const volUsdt   = settings.minVolumeUsdt != null ? avgVolumeUsdt(candles, 24) : null
  const volUsdtOk = volUsdt !== null && settings.minVolumeUsdt !== null
    ? volUsdt >= settings.minVolumeUsdt
    : null

  let volSurgeRatio: number | null = null
  let volSurgeOk: boolean | null = null
  if (settings.isVolumeSurgeFilterEnabled) {
    const avg20 = avgVolume20(candles)
    const last  = lastBarVolume(candles)
    const required = avg20 * settings.volumeSurgeMultiplier
    volSurgeRatio = required > 0 ? last / required : null
    volSurgeOk    = volSurgeRatio !== null ? volSurgeRatio >= 1 : null
  }

  return {
    t3Up: t3Result.currentT3Up,
    t3Confirmation: t3Result.hasConfirmation,
    rsiValue: rsiVal,
    rsiOk,
    volUsdt,
    volUsdtOk,
    volSurgeRatio,
    volSurgeOk,
    lastCheckedReason,
  }
}

// ─── Signals ──────────────────────────────────────────────────────────────────

export function deriveSignals(
  klines: BKline[],
  t3Values: number[],
): Array<{ time: number; side: 'buy' | 'sell' }> {
  const out: Array<{ time: number; side: 'buy' | 'sell' }> = []
  // Son eleman (length-1) açık/kapanmamış mum — sinyal üretme
  const limit = t3Values.length - 1

  // Backend SignalEngine.cs ile birebir eşleşen 3-koşul:
  // i = onay barı ([n-2] pozisyonu)
  // i-1 = dönüş barı ([n-3])
  // i-2 = önceki yön barı ([n-4])
  // i-3 = önceki önceki yön barı ([n-5])
  for (let i = 4; i < limit; i++) {
    const turnUp =
      t3Values[i-1] > t3Values[i-2] &&    // dönüş barı yukarı döndü
      !(t3Values[i-2] > t3Values[i-3]) &&  // önceki yön aşağıydı
      t3Values[i] > t3Values[i-1]          // onay barı teyit etti

    const turnDown =
      !(t3Values[i-1] > t3Values[i-2]) &&  // dönüş barı aşağı döndü
      t3Values[i-2] > t3Values[i-3] &&     // önceki yön yukarıydı
      !(t3Values[i] > t3Values[i-1])       // onay barı aşağıyı teyit etti

    if (turnUp) out.push({ time: klines[i].time, side: 'buy' })
    else if (turnDown) out.push({ time: klines[i].time, side: 'sell' })
  }
  return out
}

// Auto-detect price precision from current price
export function pricePrecision(price: number): { precision: number; minMove: number } {
  if (price >= 1000) return { precision: 2, minMove: 0.01 }
  if (price >= 10)   return { precision: 3, minMove: 0.001 }
  if (price >= 0.1)  return { precision: 4, minMove: 0.0001 }
  if (price >= 0.01) return { precision: 6, minMove: 0.000001 }
  return { precision: 8, minMove: 0.00000001 }
}
