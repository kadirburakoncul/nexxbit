import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { coinsApi } from '@/api/coins'
import { indicatorsApi } from '@/api/indicators'
import Header from '@/components/layout/Header'
import { Timer, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type Time, type SeriesMarker, ColorType, CrosshairMode,
} from 'lightweight-charts'
import { UTC3_OFFSET } from '@/lib/t3chart'
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
      if (markers.length > 0) {
        const markersPlugin = createSeriesMarkers(candleSeries, markers)
        void markersPlugin
      }
    }

    chart.timeScale().fitContent()
    chartRef.current = chart

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

export default function ChartPage() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('1h')
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string>('none')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  const { data: coins } = useQuery({ queryKey: ['coins'], queryFn: coinsApi.list })
  const { data: indicators } = useQuery({ queryKey: ['indicators'], queryFn: () => indicatorsApi.list() })

  const watchlistCoins = useMemo(() =>
    (coins ?? []).filter(c => c.isInWatchlist),
    [coins]
  )

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toUpperCase()
    return (coins ?? [])
      .filter(c =>
        c.symbol.includes(q) ||
        c.displayName.toUpperCase().includes(q) ||
        c.baseAsset.toUpperCase().includes(q)
      )
      .slice(0, 20)
  }, [coins, searchQuery])

  // İlk watchlist coin'ini seç
  useEffect(() => {
    if (watchlistCoins.length > 0 && !watchlistCoins.some(c => c.symbol === symbol)) {
      setSymbol(watchlistCoins[0].symbol)
    }
  }, [watchlistCoins]) // eslint-disable-line react-hooks/exhaustive-deps

  // Arama paneli dışına tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false)
    }
    if (searchOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [searchOpen])

  const applySymbol = (sym: string) => {
    const s = sym.trim().toUpperCase()
    if (s) { setSymbol(s); setSearchOpen(false); setSearchQuery('') }
  }

  const { data: candles, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['chart-klines', symbol, interval],
    queryFn: () => fetchBinanceKlines(symbol, interval, 300),
    refetchInterval: INTERVAL_MS[interval] ?? 60_000,
    staleTime: 0,
    retry: 2,
  })

  const t3Result = useMemo(() => {
    if (!candles || candles.length < 20) return null
    try { return computeT3(candles, T3_PERIOD, T3_VFACTOR) } catch { return null }
  }, [candles])

  const signals = useMemo(() => {
    if (!candles || !t3Result) return []
    return deriveSignals(candles, t3Result.values)
  }, [candles, t3Result])

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  // RSI içeren indikatörleri filtrele (RSI bir indikatör değil, filtre)
  const filteredIndicators = (indicators ?? []).filter(
    i => i.isEnabled && !i.displayName?.toLowerCase().includes('rsi')
  )

  return (
    <>
      <Header title="Grafik" />
      <div className="p-3 md:p-6 space-y-4">

        {/* Kontroller */}
        <div className="space-y-2">
          {/* Satır 1: Coin seçimi */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Kayıtlı coin pill'leri */}
            {watchlistCoins.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {watchlistCoins.map(c => (
                  <button
                    key={c.symbol}
                    onClick={() => applySymbol(c.symbol)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                      symbol === c.symbol
                        ? 'bg-yellow-400/20 border-yellow-400/30 text-yellow-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                    )}
                  >
                    {c.baseAsset || c.symbol.replace('USDT', '')}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">Watchlist boş — Coinler sayfasından ekle</p>
            )}

            {/* Binance arama butonu */}
            <div className="relative" ref={searchRef}>
              <button
                onClick={() => { setSearchOpen(v => !v); setSearchQuery('') }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                  searchOpen
                    ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                )}
                title="Binance'de coin ara"
              >
                <Search size={12} />
                Ara
              </button>

              {/* Arama paneli */}
              {searchOpen && (
                <div className="absolute top-full left-0 mt-1.5 z-50 w-72 bg-[#0f1117] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Sembol veya isim… (örn. DOG, Bitcoin)"
                        className="w-full pl-8 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400/40"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto border-t border-white/5">
                    {searchQuery.trim() === '' ? (
                      <p className="text-xs text-slate-600 px-3 py-4 text-center">
                        Binance sembolü veya coin adı yaz
                      </p>
                    ) : searchResults.length === 0 ? (
                      <p className="text-xs text-slate-600 px-3 py-4 text-center">Eşleşen coin bulunamadı</p>
                    ) : (
                      searchResults.map(c => (
                        <button
                          key={c.symbol}
                          onClick={() => applySymbol(c.symbol)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
                            <span className="text-yellow-400 text-[10px] font-bold">{(c.baseAsset || c.symbol.replace('USDT', '')).slice(0, 3)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-100">{c.symbol}</p>
                            <p className="text-[10px] text-slate-500 truncate">{c.displayName}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Satır 2: Zaman dilimi + durum */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* İndikatör seçici */}
            {filteredIndicators.length > 0 && (
              <select
                value={selectedIndicatorId}
                onChange={e => setSelectedIndicatorId(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-yellow-400/50"
              >
                <option value="none">İndikatör Seçin</option>
                {filteredIndicators.map(i => (
                  <option key={i.indicatorId} value={String(i.indicatorId)}>{i.displayName}</option>
                ))}
              </select>
            )}

            {/* Zaman dilimi */}
            <div className="flex gap-1 flex-wrap">
              {INTERVALS.map(iv => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    interval === iv
                      ? 'bg-yellow-400/20 text-yellow-400'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  )}
                >
                  {iv}
                </button>
              ))}
            </div>

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
        </div>

        {/* Seçili coin */}
        {symbol && (
          <p className="text-sm font-semibold text-slate-200 px-1">{symbol}</p>
        )}

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
              <p className="text-red-400 text-sm">Binance verisi alınamadı — {symbol} geçersiz veya çevrimdışı olabilir</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-yellow-400 border border-yellow-400/30 px-3 py-1.5 rounded-lg hover:bg-yellow-400/10 transition-colors"
              >
                Yeniden Dene
              </button>
            </div>
          ) : !candles || candles.length === 0 ? (
            <div className="flex items-center justify-center h-[520px] text-slate-600 text-sm">
              {isFetching ? 'Veri alınıyor…' : 'Grafik yükleniyor…'}
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
