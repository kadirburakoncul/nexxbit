import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { bistApi } from '@/api/bist'
import type { BistOhlcv } from '@/api/bist'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Timer, Search } from 'lucide-react'
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type Time, type SeriesMarker, ColorType, CrosshairMode,
} from 'lightweight-charts'
import { UTC3_OFFSET, computeT3, deriveSignals, pricePrecision } from '@/lib/t3chart'
import type { BKline } from '@/lib/t3chart'
import { cn } from '@/lib/utils'

const INTERVALS = ['5m', '15m', '30m', '1h', '1d']

const INTERVAL_MS: Record<string, number> = {
  '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000, '1d': 86_400_000,
}

const BIST30_SYMBOLS = new Set([
  'AKBNK', 'ARCLK', 'ASELS', 'BIMAS', 'EKGYO', 'ENKAI', 'EREGL', 'FROTO',
  'GARAN', 'HALKB', 'ISCTR', 'KCHOL', 'KOZAL', 'KRDMD', 'PETKM', 'PGSUS',
  'SAHOL', 'SASA', 'SISE', 'TAVHL', 'TCELL', 'THYAO', 'TKFEN', 'TOASO',
  'TTKOM', 'TUPRS', 'VAKBN', 'YKBNK', 'KOZAA', 'AGHOL',
])

const BIST50_SYMBOLS = new Set([
  ...BIST30_SYMBOLS,
  'AEFES', 'AKSEN', 'ALKIM', 'ANACM', 'BRSAN', 'CCOLA', 'CIMSA', 'DOHOL',
  'HEKTS', 'MAVI', 'MGROS', 'OTKAR', 'SKBNK', 'SNGYO', 'SOKM', 'SUNTR',
  'TRKCM', 'YKGYO', 'ZRGYO', 'ALBRK',
])

const BIST100_SYMBOLS = new Set([
  ...BIST50_SYMBOLS,
  'AGESA', 'AHGAZ', 'AKCNS', 'AKGRT', 'AKSA', 'ALARK', 'ASUZU', 'ATAKP',
  'AVOD', 'AYEN', 'BAGFS', 'BERA', 'BIOEN', 'BLCYT', 'BUCIM', 'BURCE',
  'CANTES', 'CEMTS', 'CRFSA', 'CUSAN', 'DEVA', 'DOAS', 'ECZYT', 'EGEEN',
  'ELKAR', 'EMKEL', 'ENJSA', 'EPLAS', 'ESCOM', 'ETILR', 'FONET', 'GLYHO',
  'GOLTS', 'GSDHO', 'GUBRF', 'GUSGR', 'IHLGM', 'INDES', 'IPEKE', 'ISDMR',
  'IZMDC', 'JANTS', 'KARSN', 'KATMR', 'KMPUR', 'KONYA', 'KORDS', 'KTLEV',
  'LUKSK', 'NTHOL',
])

type Source = 'strategy' | 'bist30' | 'bist50' | 'bist100' | 'watchlist' | 'search'

function useCountdown(timeframe: string) {
  const calc = useCallback(() => {
    const now = Date.now()
    const iv = INTERVAL_MS[timeframe] ?? 900_000
    const nextMs = Math.ceil(now / iv) * iv
    return { sec: Math.max(0, Math.round((nextMs - now) / 1000)), nextMs }
  }, [timeframe]) // eslint-disable-line react-hooks/exhaustive-deps

  const [rem, setRem] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setRem(calc()), 1000)
    return () => clearInterval(t)
  }, [calc])
  return rem
}

function Countdown({ timeframe }: { timeframe: string }) {
  const { sec } = useCountdown(timeframe)
  const iv = INTERVAL_MS[timeframe] ?? 900_000
  const pct = Math.max(0, Math.min(100, ((iv - sec * 1000) / iv) * 100))
  const label = sec < 60 ? `${sec}sn` : `${Math.floor(sec / 60)}dk ${sec % 60}sn`
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
      <Timer size={12} className="text-yellow-400 shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] text-slate-500 leading-none">Sonraki mum</span>
        <span className="text-xs text-yellow-400 font-semibold tabular-nums leading-none">{label}</span>
      </div>
      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden shrink-0">
        <div
          className="h-full bg-yellow-400/60 rounded-full transition-[width] duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function toKlines(data: BistOhlcv[]): BKline[] {
  return data.map(c => ({
    time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
  }))
}

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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    })
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#facc15',
      lineWidth: 2 as any,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    const fmt = pricePrecision(candles[candles.length - 1].close)
    candleSeries.applyOptions({ priceFormat: { type: 'price', ...fmt } })
    lineSeries.applyOptions({ priceFormat: { type: 'price', ...fmt } })

    const toT = (t: number): Time => (t + UTC3_OFFSET) as Time
    candleSeries.setData(
      candles.map(c => ({ time: toT(c.time), open: c.open, high: c.high, low: c.low, close: c.close }))
    )

    const lineData = candles
      .map((c, i) => ({ time: toT(c.time), value: t3Values[i] ?? 0 }))
      .filter(d => d.value > 0)
    lineSeries.setData(lineData as any)

    if (signals.length > 0) {
      const candleTimeSet = new Set(candles.map(c => c.time))
      const markers: SeriesMarker<Time>[] = signals
        .filter(s => candleTimeSet.has(s.time))
        .sort((a, b) => a.time - b.time)
        .map(s => ({
          time: toT(s.time),
          position: s.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: s.side === 'buy' ? '#10b981' : '#ef4444',
          shape: s.side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: s.side === 'buy' ? 'AL' : 'SAT',
          size: 1,
        }))
      if (markers.length > 0) createSeriesMarkers(candleSeries, markers)
    }

    chart.timeScale().fitContent()
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (el && chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth })
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

export default function BistChartPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initSymbol = searchParams.get('symbol') ?? ''
  const initTf = searchParams.get('timeframe') ?? '15m'

  const [symbol, setSymbol]   = useState(initSymbol)
  const [interval, setInterval] = useState(initTf)
  const [symbolInput, setSymbolInput] = useState(initSymbol)
  const [source, setSource] = useState<Source>('strategy')
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('')

  const { data: catalog } = useQuery({ queryKey: ['bist-catalog'], queryFn: bistApi.catalog })
  const { data: strategies } = useQuery({ queryKey: ['bist-strategies'], queryFn: bistApi.strategies })
  const { data: watchlist } = useQuery({ queryKey: ['bist-watchlist'], queryFn: bistApi.watchlist })

  // Kaynak bazında hisse listesi
  const stockList = useMemo(() => {
    if (!catalog) return []
    switch (source) {
      case 'strategy': {
        if (!strategies) return []
        const strat = selectedStrategyId
          ? strategies.find(s => s.id === selectedStrategyId)
          : strategies.find(s => s.isActive) ?? strategies[0]
        if (!strat) return []
        return strat.stocks.map(st => ({ symbol: st.symbol, displayName: st.displayName }))
          .sort((a, b) => a.symbol.localeCompare(b.symbol))
      }
      case 'bist30':
        return catalog.filter(c => BIST30_SYMBOLS.has(c.symbol))
          .map(c => ({ symbol: c.symbol, displayName: c.displayName }))
      case 'bist50':
        return catalog.filter(c => BIST50_SYMBOLS.has(c.symbol))
          .map(c => ({ symbol: c.symbol, displayName: c.displayName }))
      case 'bist100':
        return catalog.filter(c => BIST100_SYMBOLS.has(c.symbol))
          .map(c => ({ symbol: c.symbol, displayName: c.displayName }))
      case 'watchlist':
        return (watchlist ?? []).map(w => ({ symbol: w.symbol, displayName: w.displayName }))
      case 'search':
        return []
    }
  }, [source, catalog, strategies, selectedStrategyId, watchlist])

  // İlk sembolü otomatik seç
  useEffect(() => {
    if (source !== 'search' && stockList.length > 0 && !stockList.some(s => s.symbol === symbol)) {
      applySymbol(stockList[0].symbol)
    }
  }, [stockList]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: chartData, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['bist-chart', symbol, interval],
    queryFn: () => bistApi.chart(symbol, interval, 300),
    enabled: !!symbol,
    refetchInterval: 5 * 60_000,
    staleTime: 0,
  })

  const candles = useMemo(() => chartData ? toKlines(chartData) : [], [chartData])
  const t3Result = useMemo(() => {
    if (candles.length < 20) return null
    try { return computeT3(candles, 7, 0.7) } catch { return null }
  }, [candles])
  const signals = useMemo(() => {
    if (!candles.length || !t3Result) return []
    return deriveSignals(candles, t3Result.values)
  }, [candles, t3Result])

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const applySymbol = (sym: string) => {
    const upper = sym.toUpperCase().trim()
    if (!upper) return
    setSymbol(upper)
    setSymbolInput(upper)
    setSearchParams({ symbol: upper, timeframe: interval }, { replace: true })
  }

  const changeInterval = (iv: string) => {
    setInterval(iv)
    if (symbol) setSearchParams({ symbol, timeframe: iv }, { replace: true })
  }

  const displayName = catalog?.find(c => c.symbol === symbol)?.displayName ?? symbol

  const sourceBtnCls = (s: Source) => cn(
    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
    source === s
      ? 'bg-yellow-400/20 border-yellow-400/30 text-yellow-400'
      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
  )

  return (
    <>
      <Header title="BIST Grafik" />
      <div className="p-3 md:p-6 space-y-4">

        {/* Kaynak seçici */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSource('strategy')} className={sourceBtnCls('strategy')}>Strateji</button>
          <button onClick={() => setSource('bist30')} className={sourceBtnCls('bist30')}>BIST30</button>
          <button onClick={() => setSource('bist50')} className={sourceBtnCls('bist50')}>BIST50</button>
          <button onClick={() => setSource('bist100')} className={sourceBtnCls('bist100')}>BIST100</button>
          <button onClick={() => setSource('watchlist')} className={sourceBtnCls('watchlist')}>
            Kayıtlı {watchlist && watchlist.length > 0 ? `(${watchlist.length})` : ''}
          </button>
          <button onClick={() => setSource('search')} className={sourceBtnCls('search')}>
            <Search size={11} className="inline mr-1" />Arama
          </button>
        </div>

        {/* Kontroller */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Strateji seçici */}
          {source === 'strategy' && strategies && strategies.length > 0 && (
            <select
              value={selectedStrategyId}
              onChange={e => setSelectedStrategyId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            >
              <option value="">Tüm aktif (ilk strateji)</option>
              {strategies.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Hisse seçici — dropdown */}
          {source !== 'search' && stockList.length > 0 && (
            <select
              value={symbol}
              onChange={e => applySymbol(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 min-w-36"
            >
              {stockList.map(s => (
                <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.displayName}</option>
              ))}
            </select>
          )}

          {/* Arama modu */}
          {source === 'search' && (
            <form onSubmit={e => { e.preventDefault(); applySymbol(symbolInput) }} className="flex gap-1.5">
              <input
                value={symbolInput}
                onChange={e => setSymbolInput(e.target.value.toUpperCase())}
                placeholder="Örn: THYAO"
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 w-32"
              />
              <button type="submit" className="px-3 py-2 text-xs bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 rounded-xl hover:bg-yellow-400/20 transition-colors">
                Git
              </button>
            </form>
          )}

          {/* Zaman dilimi */}
          <div className="flex gap-1 flex-wrap">
            {INTERVALS.map(iv => (
              <button
                key={iv}
                onClick={() => changeInterval(iv)}
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
            <Countdown timeframe={interval} />
            <button onClick={() => refetch()} className="text-slate-600 hover:text-slate-300 transition-colors">
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            </button>
            {lastUpdate && <span className="text-xs text-slate-600">{lastUpdate}</span>}
            <span className="text-xs text-slate-600 bg-white/5 border border-white/8 rounded-lg px-2 py-1">~15-20dk gecikmeli</span>
          </div>
        </div>

        {/* Hisse adı */}
        {symbol && (
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-200">{symbol}</p>
            {displayName && displayName !== symbol && <p className="text-xs text-slate-500">{displayName}</p>}
          </div>
        )}

        {/* T3 durum */}
        {t3Result && (
          <div className="flex items-center gap-4 px-1 flex-wrap">
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
              T3: <span className="text-yellow-400">{t3Result.currentT3.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}</span>
            </span>
            {candles.length > 0 && (
              <span className="text-xs text-slate-400 font-mono">
                Fiyat: <span className="text-slate-100 font-semibold">
                  {candles[candles.length - 1].close.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} ₺
                </span>
              </span>
            )}
          </div>
        )}

        {/* Grafik */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-3">
          {!symbol ? (
            <div className="flex items-center justify-center h-[520px] text-slate-600 text-sm">
              Bir hisse seçin veya sembol girin
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-[520px] gap-3">
              <p className="text-red-400 text-sm">Veri alınamadı — {symbol} geçersiz veya seans dışı olabilir</p>
              <button onClick={() => refetch()} className="text-xs text-yellow-400 border border-yellow-400/30 px-3 py-1.5 rounded-lg hover:bg-yellow-400/10 transition-colors">
                Tekrar Dene
              </button>
            </div>
          ) : isFetching && candles.length === 0 ? (
            <div className="flex items-center justify-center h-[520px] text-slate-600 text-sm">
              Yükleniyor…
            </div>
          ) : candles.length === 0 ? (
            <div className="flex items-center justify-center h-[520px] text-slate-600 text-sm">
              Veri bulunamadı
            </div>
          ) : (
            <CandleChart
              candles={candles}
              t3Values={t3Result?.values ?? []}
              signals={signals}
              height={window.innerHeight > 800 ? 560 : 400}
            />
          )}
        </div>

        <p className="text-[10px] text-slate-700">
          Veriler Yahoo Finance kaynaklıdır (~15-20 dakika gecikmeli). Bu grafik yalnızca sinyal analizi amaçlıdır.
        </p>
      </div>
    </>
  )
}
