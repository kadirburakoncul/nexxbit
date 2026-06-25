// Shared Binance klines fetch + Tillson T3 computation

export interface BKline {
  time: number   // unix seconds
  open: number
  high: number
  low: number
  close: number
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
  const raw: [number, string, string, string, string, ...unknown[]][] = await res.json()
  return raw.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
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
  // [n-1] = açık (kapanmamış) mum, [n-2] = son kapanmış mum
  // Yön değişimi tespiti için kapanmış mum kullan; böylece mum kapanmadan önce sahte sinyal üretilmez
  const liveT3Up   = values[n - 1] > values[n - 2]   // canlı yön (badge için)
  const closedT3Up = values[n - 2] > values[n - 3]   // kapanmış mum yönü (sinyal için)
  const prevT3Up   = values[n - 3] > values[n - 4]
  return {
    values,
    currentT3Up: liveT3Up,
    t3TurnUp:   closedT3Up && !prevT3Up,
    t3TurnDown: !closedT3Up && prevT3Up,
    currentT3: values[n - 1],
  }
}

export function deriveSignals(
  klines: BKline[],
  t3Values: number[],
): Array<{ time: number; side: 'buy' | 'sell' }> {
  const out: Array<{ time: number; side: 'buy' | 'sell' }> = []
  // Son eleman (length-1) açık/kapanmamış mum — sinyal üretme, mum kapanınca T3 değişebilir
  const limit = t3Values.length - 1
  for (let i = 1; i < limit; i++) {
    const upNow = t3Values[i] > t3Values[i - 1]
    const upPrev = t3Values[i - 1] > (i >= 2 ? t3Values[i - 2] : t3Values[i - 1])
    if (upNow && !upPrev) out.push({ time: klines[i].time, side: 'buy' })
    else if (!upNow && upPrev) out.push({ time: klines[i].time, side: 'sell' })
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
