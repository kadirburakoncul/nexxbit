import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { coinsApi } from '@/api/coins'
import { strategiesApi } from '@/api/strategies'
import Header from '@/components/layout/Header'
import { Timer, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react'
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type Time, type SeriesMarker, ColorType, CrosshairMode,
} from 'lightweight-charts'
import {
  fetchBinanceKlines, computeT3, deriveSignals, pricePrecision,
  type BKline, type T3Result,
} from '@/lib/t3chart'

const INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ interval }: { interval: string }) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const tick = () => {
      const ms = INTERVAL_MS[interval] ?? 3_600_000
      setSec(Math.max(0, Math.ceil((Math.ceil(Date.now() / ms) * ms - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [interval])

  const m = Math.floor(sec / 60), s = sec % 60
  const pct = sec / ((INTERVAL_MS[interval] ?? 3_600_000) / 1000)
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <Timer size={13} />
      <span>Sonraki mum:</span>
      <span className={`font-mono font-semibold tabular-nums ${pct < 0.1 ? 'text-yellow-400' : 'text-slate-300'}`}>
        {m > 0 ? `${m}d ` : ''}{String(s).padStart(2, '0')}s
      </span>
      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400/60 rounded-full" style={{ width: `${(1 - pct) * 100}%` }} />
      </div>
    </div>
  )
}

// ─── Full T3 Chart ────────────────────────────────────────────────────────────
function FullT3Chart({ candles, t3, signals, height }: {
  candles: BKline[]; t3: number[]
  signals: Array<{ time: number; side: 'buy' | 'sell' }>
  height: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
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
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height,
    })
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    })
    lineRef.current = chart.addSeries(LineSeries, {
      color: '#facc15', lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
    })
    chartRef.current = chart
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [height])

  useEffect(() => {
    if (!candleRef.current || !lineRef.current || candles.length === 0) return
    const fmt = pricePrecision(candles[candles.length - 1].close)
    candleRef.current.applyOptions({ priceFormat: { type: 'price', ...fmt } })
    lineRef.current.applyOptions({ priceFormat: { type: 'price', ...fmt } })
    candleRef.current.setData(candles.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })))
    lineRef.current.setData(candles.map((c, i) => ({ time: c.time as Time, value: t3[i] ?? c.close })))
    if (signals.length > 0) {
      const markers: SeriesMarker<Time>[] = signals.map(s => ({
        time: s.time as Time,
        position: s.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: s.side === 'buy' ? '#10b981' : '#ef4444',
        shape: s.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: s.side === 'buy' ? 'AL' : 'SAT',
        size: 1.2,
      }))
      createSeriesMarkers(candleRef.current, markers)
    }
    chartRef.current?.timeScale().fitContent()
  }, [candles, t3, signals])

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height }} />
}

// ─── Status panel ─────────────────────────────────────────────────────────────
function StatusPanel({ t3Result, currentPrice }: { t3Result?: T3Result; currentPrice?: number }) {
  if (!t3Result) return null
  const { currentT3Up, t3TurnUp, t3TurnDown, currentT3 } = t3Result

  const badge = t3TurnUp ? (
    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
      <ArrowUpRight size={12} /> T3 Yukarı Döndü
    </span>
  ) : t3TurnDown ? (
    <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
      <ArrowDownRight size={12} /> T3 Aşağı Döndü
    </span>
  ) : currentT3Up ? (
    <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
      <TrendingUp size={11} className="text-emerald-500/60" /> T3 Yükseliyor
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-slate-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
      <TrendingDown size={11} className="text-red-500/60" /> T3 Düşüyor
    </span>
  )

  return (
    <div className="flex items-center gap-4 px-1">
      {badge}
      {currentPrice != null && (
        <span className="text-xs text-slate-400 font-mono">
          Fiyat: <span className="text-slate-100 font-semibold">{currentPrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}</span>
        </span>
      )}
      <span className="text-xs text-slate-500 font-mono">
        T3: <span className="text-yellow-400">{currentT3.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}</span>
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChartPage() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('1h')
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('all')

  const { data: coins } = useQuery({ queryKey: ['coins'], queryFn: coinsApi.list })
  const { data: strategies } = useQuery({ queryKey: ['strategies'], queryFn: strategiesApi.list })

  // Strateji seçilince timeframe'i otomatik ayarla ve coin listesini filtrele
  const selectedStrategy = strategies?.find(s => s.id === selectedStrategyId)
  const strategyCoinSymbols = selectedStrategy?.coins.map(c => c.symbol) ?? null

  // Coin listesi: strateji seçiliyse o stratejinin coinleri, yoksa tüm coinler
  const filteredCoins = useMemo(() => {
    if (!coins) return []
    if (!strategyCoinSymbols) return coins
    return coins.filter(c => strategyCoinSymbols.includes(c.symbol))
  }, [coins, strategyCoinSymbols])

  const { data: klines, isFetching } = useQuery({
    queryKey: ['chart-klines', symbol, interval],
    queryFn: () => fetchBinanceKlines(symbol, interval, 300),
    enabled: !!symbol,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const t3Result = useMemo(() => {
    if (!klines || klines.length < 10) return undefined
    return computeT3(klines, 5, 0.7)
  }, [klines])

  const signals = useMemo(() => {
    if (!klines || !t3Result) return []
    return deriveSignals(klines, t3Result.values)
  }, [klines, t3Result])

  const currentPrice = klines?.[klines.length - 1]?.close

  return (
    <>
      <Header title="Grafik" />
      <div className="p-6 space-y-4">

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Strateji seçici */}
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-500" />
            <select
              value={selectedStrategyId}
              onChange={e => {
                const id = e.target.value
                setSelectedStrategyId(id)
                const strat = strategies?.find(s => s.id === id)
                if (strat) setInterval(strat.timeframe)
              }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            >
              <option value="all">Tüm Coinler</option>
              {strategies?.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.timeframe})</option>
              ))}
            </select>
          </div>

          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 min-w-36"
          >
            {filteredCoins.map(c => <option key={c.id} value={c.symbol}>{c.symbol}</option>)}
            {filteredCoins.length === 0 && <option value={symbol}>{symbol}</option>}
          </select>

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

          <div className="ml-auto flex items-center gap-4">
            {isFetching && <span className="text-xs text-slate-600">Yükleniyor…</span>}
            <Countdown interval={interval} />
          </div>
        </div>

        {/* Status */}
        <StatusPanel t3Result={t3Result} currentPrice={currentPrice} />

        {/* Chart */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-3">
          {klines && klines.length > 0
            ? <FullT3Chart candles={klines} t3={t3Result?.values ?? []} signals={signals} height={520} />
            : (
              <div className="flex items-center justify-center h-[520px] text-slate-600 text-sm">
                {isFetching ? 'Binance\'den veri alınıyor…' : 'Coin seçin'}
              </div>
            )
          }
        </div>
      </div>
    </>
  )
}
