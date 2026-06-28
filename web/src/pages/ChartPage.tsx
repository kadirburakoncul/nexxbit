import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { coinsApi } from '@/api/coins'
import { strategiesApi } from '@/api/strategies'
import Header from '@/components/layout/Header'
import { Timer, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Layers, RefreshCw } from 'lucide-react'
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type Time, type SeriesMarker, ColorType, CrosshairMode,
} from 'lightweight-charts'
import {
  fetchBinanceKlines, computeT3, deriveSignals, pricePrecision,
  type BKline,
} from '@/lib/t3chart'

const INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
}
const T3_PERIOD = 7
const T3_VFACTOR = 0.7

// ─── Countdown ─────────────────────────────────────────────────────────────────
function Countdown({ interval }: { interval: string }) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const ms = INTERVAL_MS[interval] ?? 3_600_000
    const tick = () => {
      const now = Date.now()
      setSec(Math.max(0, Math.ceil((Math.ceil(now / ms) * ms - now) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [interval])

  const m = Math.floor(sec / 60), s = sec % 60
  const ms = INTERVAL_MS[interval] ?? 3_600_000
  const pct = Math.min(1, sec / (ms / 1000))
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <Timer size={13} />
      <span>Sonraki mum:</span>
      <span className={`font-mono font-semibold tabular-nums ${pct < 0.1 ? 'text-yellow-400' : 'text-slate-300'}`}>
        {m > 0 ? `${m}d ` : ''}{String(s).padStart(2, '0')}s
      </span>
      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400/60 rounded-full transition-none" style={{ width: `${(1 - pct) * 100}%` }} />
      </div>
    </div>
  )
}

// ─── Chart bileşeni — her veri değişiminde chart'ı yeniden oluşturur ──────────
function CandleChart({
  candles, t3Values, signals, height,
}: {
  candles: BKline[]
  t3Values: number[]
  signals: Array<{ time: number; side: 'buy' | 'sell' }>
  height: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || candles.length === 0) return

    // Önceki chart'ı temizle
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { /* */ }
      chartRef.current = null
    }

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth || 600,
      height,
    })

    // Mum serisi
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    })

    // T3 çizgisi
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#facc15',
      lineWidth: 2 as any,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    // Fiyat formatı
    const fmt = pricePrecision(candles[candles.length - 1].close)
    candleSeries.applyOptions({ priceFormat: { type: 'price', ...fmt } })
    lineSeries.applyOptions({ priceFormat: { type: 'price', ...fmt } })

    // Mum verisi
    candleSeries.setData(
      candles.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
    )

    // T3 verisi — sıfır (ısınma) değerlerini atla
    const lineData = candles
      .map((c, i) => ({ time: c.time as Time, value: t3Values[i] ?? 0 }))
      .filter(d => d.value > 0)
    lineSeries.setData(lineData as any)

    // Al/Sat marker'ları
    if (signals.length > 0) {
      const candleTimeSet = new Set(candles.map(c => c.time))
      const markers: SeriesMarker<Time>[] = signals
        .filter(s => candleTimeSet.has(s.time))
        .sort((a, b) => a.time - b.time)
        .map(s => ({
          time: s.time as Time,
          position: s.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: s.side === 'buy' ? '#10b981' : '#ef4444',
          shape: s.side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: s.side === 'buy' ? 'AL' : 'SAT',
          size: 1,
        }))
      if (markers.length > 0) {
        const markersPlugin = createSeriesMarkers(candleSeries, markers)
        void markersPlugin
      }
    }

    chart.timeScale().fitContent()
    chartRef.current = chart

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (el && chartRef.current) {
        chartRef.current.applyOptions({ width: el.clientWidth })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      try { chart.remove() } catch { /* */ }
      chartRef.current = null
    }
  }, [candles, t3Values, signals, height])

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height }} />
}

// ─── Sayfa ─────────────────────────────────────────────────────────────────────
export default function ChartPage() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('1h')
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('none')

  const { data: coins } = useQuery({ queryKey: ['coins'], queryFn: coinsApi.list })
  const { data: strategies } = useQuery({ queryKey: ['strategies'], queryFn: strategiesApi.list })

  const selectedStrategy = useMemo(
    () => strategies?.find(s => s.id === selectedStrategyId),
    [strategies, selectedStrategyId]
  )

  // Coin listesi: strateji seçiliyse strateji coinleri, yoksa watchlist
  const coinList = useMemo(() => {
    if (selectedStrategy) {
      return (selectedStrategy.coins ?? []).map(c => ({ symbol: c.symbol, label: c.symbol }))
    }
    return (coins ?? [])
      .filter(c => c.isInWatchlist)
      .map(c => ({ symbol: c.symbol, label: c.symbol }))
  }, [coins, selectedStrategy])

  // Strateji değişince zaman dilimi ve ilk coini ayarla
  useEffect(() => {
    if (selectedStrategy) {
      setInterval(selectedStrategy.timeframe)
    }
    if (coinList.length > 0 && !coinList.some(c => c.symbol === symbol)) {
      setSymbol(coinList[0].symbol)
    }
  }, [selectedStrategyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Binance'den doğrudan kline çek
  const { data: candles, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['chart-klines', symbol, interval],
    queryFn: () => fetchBinanceKlines(symbol, interval, 300),
    refetchInterval: INTERVAL_MS[interval] ?? 60_000,
    staleTime: 0,
    retry: 2,
  })

  // Frontend T3 hesapla
  const t3Result = useMemo(() => {
    if (!candles || candles.length < 20) return null
    try { return computeT3(candles, T3_PERIOD, T3_VFACTOR) } catch { return null }
  }, [candles])

  // Al/Sat sinyalleri T3 yön değişiminden türet
  const signals = useMemo(() => {
    if (!candles || !t3Result) return []
    return deriveSignals(candles, t3Result.values)
  }, [candles, t3Result])

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <>
      <Header title="Grafik" />
      <div className="p-3 md:p-6 space-y-4">

        {/* Kontroller */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Strateji seçici */}
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-500" />
            <select
              value={selectedStrategyId}
              onChange={e => setSelectedStrategyId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            >
              <option value="none">Strateji Yok</option>
              {strategies?.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.timeframe})</option>
              ))}
            </select>
          </div>

          {/* Coin seçici */}
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 min-w-36"
          >
            {coinList.map(c => <option key={c.symbol} value={c.symbol}>{c.label}</option>)}
            {coinList.length === 0 && <option value={symbol}>{symbol}</option>}
          </select>

          {/* Zaman dilimi */}
          <div className="flex gap-1">
            {INTERVALS.map(iv => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  interval === iv
                    ? 'bg-yellow-400/20 text-yellow-400'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {iv}
              </button>
            ))}
          </div>

          {/* Durum */}
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="text-slate-600 hover:text-slate-300 transition-colors"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            </button>
            {lastUpdate && <span className="text-xs text-slate-600">{lastUpdate}</span>}
            <Countdown interval={interval} />
          </div>
        </div>

        {/* T3 durum bilgisi */}
        {t3Result && (
          <div className="flex items-center gap-4 px-1">
            {t3Result.t3TurnUp ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                <ArrowUpRight size={12} /> T3 Yukarı Döndü
              </span>
            ) : t3Result.t3TurnDown ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                <ArrowDownRight size={12} /> T3 Aşağı Döndü
              </span>
            ) : t3Result.currentT3Up ? (
              <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                <TrendingUp size={11} className="text-emerald-500/60" /> T3 Yükseliyor
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-slate-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                <TrendingDown size={11} className="text-red-500/60" /> T3 Düşüyor
              </span>
            )}
            <span className="text-xs text-slate-500 font-mono">
              T3: <span className="text-yellow-400">{t3Result.currentT3.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}</span>
            </span>
            {candles && candles.length > 0 && (
              <span className="text-xs text-slate-400 font-mono">
                Fiyat: <span className="text-slate-100 font-semibold">
                  {candles[candles.length - 1].close.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Grafik */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-3">
          {isError ? (
            <div className="flex flex-col items-center justify-center h-[520px] gap-3">
              <p className="text-red-400 text-sm">Binance verisi alınamadı</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-yellow-400 border border-yellow-400/30 px-3 py-1.5 rounded-lg hover:bg-yellow-400/10 transition-colors"
              >
                Yeniden Dene
              </button>
            </div>
          ) : !candles || candles.length === 0 ? (
            <div className="flex items-center justify-center h-[520px] text-slate-600 text-sm">
              {isFetching ? 'Veri alınıyor…' : coinList.length === 0 ? 'Watchlist boş — coin ekleyin' : 'Grafik yükleniyor…'}
            </div>
          ) : (
            <CandleChart
              key={`${symbol}-${interval}`}
              candles={candles}
              t3Values={t3Result?.values ?? []}
              signals={signals}
              height={520}
            />
          )}
        </div>

      </div>
    </>
  )
}
