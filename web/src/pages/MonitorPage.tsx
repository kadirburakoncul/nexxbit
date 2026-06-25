import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategiesApi } from '@/api/strategies'
import type { StrategyMonitor, CoinMonitor } from '@/api/strategies'
import { indicatorsApi } from '@/api/indicators'
import Header from '@/components/layout/Header'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'


function parseUtc(str: string): Date {
  const s = str.endsWith('Z') || str.includes('+') ? str : str + 'Z'
  return new Date(s)
}

function fmtUtc3(str: string | null | undefined, fmt: 'short' | 'time' = 'short'): string {
  if (!str) return '—'
  const opts: Intl.DateTimeFormatOptions = fmt === 'time'
    ? { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }
  return parseUtc(str).toLocaleString('tr-TR', opts)
}
import { cn } from '@/lib/utils'
import {
  Activity, Clock, TrendingUp, TrendingDown, RefreshCw,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Zap
} from 'lucide-react'
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type Time, type SeriesMarker
} from 'lightweight-charts'

// ─── Constants ───────────────────────────────────────────────────────────────
const RE_ENTRY_LABEL: Record<number, string> = { 0: 'Normal', 1: 'SAT Bekliyor', 2: 'AL Bekliyor' }
const RE_ENTRY_COLOR: Record<number, string> = {
  0: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  1: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  2: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}
const DIR_LABEL: Record<string, string> = { Buy: 'AL', Sell: 'SAT', StrongSell: 'GÜÇLÜ SAT', Hold: '—' }
const DIR_COLOR: Record<string, string> = {
  Buy: 'text-emerald-400', Sell: 'text-red-400', StrongSell: 'text-red-500', Hold: 'text-slate-500'
}

import { fetchBinanceKlines, computeT3, deriveSignals, pricePrecision } from '@/lib/t3chart'
import type { BKline, T3Result } from '@/lib/t3chart'


// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(timeframe: string) {
  const MS: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000,
    '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000
  }
  const calc = useCallback(() => {
    const now = Date.now()
    const iv = MS[timeframe] ?? 300_000
    const nextMs = Math.ceil(now / iv) * iv
    return { sec: Math.max(0, Math.round((nextMs - now) / 1000)), nextMs }
  }, [timeframe])

  const [rem, setRem] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setRem(calc()), 1000)
    return () => clearInterval(t)
  }, [calc])
  return rem
}

// ─── T3 Chart ─────────────────────────────────────────────────────────────────
// visible prop: chart stays in DOM (no remount on collapse) but resizes when shown
function T3Chart({
  candles, t3, signals, visible,
}: {
  candles: BKline[]
  t3: number[]
  signals: Array<{ time: number; side: 'buy' | 'sell' }>
  visible: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(148,163,184,0.8)',
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: true, secondsVisible: false },
    })
    chartRef.current = chart
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    })
    lineRef.current = chart.addSeries(LineSeries, {
      color: '#facc15', lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    })
    const ro = new ResizeObserver(() => {
      if (containerRef.current)
        chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [])

  // Resize + fitContent when becoming visible
  useEffect(() => {
    if (!visible) return
    requestAnimationFrame(() => {
      if (!containerRef.current || !chartRef.current) return
      chartRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight)
      chartRef.current.timeScale().fitContent()
    })
  }, [visible])

  // Update data when candles change
  useEffect(() => {
    if (!candleRef.current || !lineRef.current || candles.length === 0) return
    const fmt = pricePrecision(candles[candles.length - 1].close)
    candleRef.current.applyOptions({ priceFormat: { type: 'price', ...fmt } })
    lineRef.current.applyOptions({ priceFormat: { type: 'price', ...fmt } })
    candleRef.current.setData(
      candles.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
    )
    lineRef.current.setData(
      candles.map((c, i) => ({ time: c.time as Time, value: t3[i] ?? c.close }))
    )
    if (signals.length > 0) {
      const markers: SeriesMarker<Time>[] = signals.map(s => ({
        time: s.time as Time,
        position: s.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: s.side === 'buy' ? '#10b981' : '#ef4444',
        shape: s.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: s.side === 'buy' ? 'AL' : 'SAT',
        size: 1,
      }))
      createSeriesMarkers(candleRef.current, markers)
    }
    chartRef.current?.timeScale().fitContent()
  }, [candles, t3, signals])

  return (
    <div className="relative w-full h-44">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}

// ─── T3 Status Badge ─────────────────────────────────────────────────────────
function T3StatusBadge({ t3Result }: { t3Result?: T3Result }) {
  if (!t3Result) return null
  if (t3Result.t3TurnUp) return (
    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
      <ArrowUpRight size={11} /> T3 Yukarı Döndü
    </span>
  )
  if (t3Result.t3TurnDown) return (
    <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
      <ArrowDownRight size={11} /> T3 Aşağı Döndü
    </span>
  )
  if (t3Result.currentT3Up) return (
    <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
      <TrendingUp size={11} className="text-emerald-500/60" /> T3 Yükseliyor
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
      <TrendingDown size={11} className="text-red-500/60" /> T3 Düşüyor
    </span>
  )
}

// ─── Coin Card ────────────────────────────────────────────────────────────────
function CoinCard({ coin, timeframe, t3Period, t3VFactor, strategyId }: {
  coin: CoinMonitor; timeframe: string; t3Period: number; t3VFactor: number; strategyId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()
  const resetMut = useMutation({
    mutationFn: () => strategiesApi.resetReEntry(strategyId, coin.coinId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategy-monitor'] }),
  })

  const { data: klines, isFetching } = useQuery({
    queryKey: ['binance-klines', coin.coinSymbol, timeframe],
    queryFn: () => fetchBinanceKlines(coin.coinSymbol, timeframe, 200),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const t3Result = useMemo(() => {
    if (!klines || klines.length < 10) return undefined
    return computeT3(klines, t3Period, t3VFactor)
  }, [klines, t3Period, t3VFactor])

  const signals = useMemo(() => {
    if (!klines || !t3Result) return []
    return deriveSignals(klines, t3Result.values)
  }, [klines, t3Result])

  // Frontend'den hesaplanan son sinyal (chart ile senkron)
  const lastLiveSignal = signals.length > 0 ? signals[signals.length - 1] : null
  const liveSignalDirection = lastLiveSignal?.side === 'buy' ? 'Buy' : lastLiveSignal?.side === 'sell' ? 'Sell' : null
  const liveSignalPrice = lastLiveSignal && klines
    ? klines.find(k => k.time === lastLiveSignal.time)?.close ?? null
    : null
  const liveSignalTime = lastLiveSignal ? new Date(lastLiveSignal.time * 1000).toISOString() : null

  const hasSignal = !!liveSignalDirection || !!coin.lastSignalAt
  const hasCheck = !!coin.lastCheckedAt

  return (
    <div className="bg-[#0f1117] border border-white/8 rounded-2xl overflow-hidden">
      {/* Card header — click row toggles expand */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-3 flex items-center gap-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors text-left"
      >
        {/* Coin + status */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
            <span className="text-yellow-400 text-xs font-bold">{coin.coinSymbol.slice(0, 2)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-100">{coin.coinSymbol}</span>
              {coin.hasOpenPosition && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Açık Pozisyon</span>
              )}
              {isFetching && <div className="w-3 h-3 border border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />}
              <T3StatusBadge t3Result={t3Result} />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full border font-medium', RE_ENTRY_COLOR[coin.reEntryState])}>
                {RE_ENTRY_LABEL[coin.reEntryState]}
              </span>
              {coin.reEntryState !== 0 && (
                <button
                  onClick={e => { e.stopPropagation(); resetMut.mutate() }}
                  disabled={resetMut.isPending}
                  title="Normal'e sıfırla"
                  className="text-xs text-slate-500 hover:text-slate-300 px-1 py-0.5 rounded border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40"
                >
                  {resetMut.isPending ? '…' : 'Sıfırla'}
                </button>
              )}
              {t3Result && (
                <span className="text-xs text-slate-600 font-mono">
                  T3: {t3Result.currentT3.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Signal / last check info — her ikisini de göster */}
        <div className="text-right shrink-0 mr-2 space-y-0.5 min-w-[120px]" onClick={e => e.stopPropagation()}>
          {hasSignal && (
            <div>
              <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Son Sinyal</span>
                <span className={cn('text-xs font-bold', DIR_COLOR[liveSignalDirection ?? coin.lastSignalDirection ?? ''] ?? 'text-slate-400')}>
                  {DIR_LABEL[liveSignalDirection ?? coin.lastSignalDirection ?? ''] ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                {(liveSignalPrice ?? coin.lastSignalPrice) != null && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {(liveSignalPrice ?? coin.lastSignalPrice)!.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                  </span>
                )}
                {(liveSignalTime ?? coin.lastSignalAt) && (
                  <span className="text-[10px] text-slate-600">
                    · {formatDistanceToNow(parseUtc((liveSignalTime ?? coin.lastSignalAt)!), { addSuffix: true, locale: tr })}
                  </span>
                )}
              </div>
            </div>
          )}
          {hasCheck && (
            <div>
              <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] text-slate-700 uppercase tracking-wider">Son Tarama</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {coin.lastCheckedPrice?.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                </span>
              </div>
              <p className="text-[10px] text-slate-700">
                {formatDistanceToNow(parseUtc(coin.lastCheckedAt!), { addSuffix: true, locale: tr })}
              </p>
            </div>
          )}
          {!hasSignal && !hasCheck && (
            <span className="text-[10px] text-slate-700">Tarama bekleniyor</span>
          )}
        </div>

        {expanded ? <ChevronUp size={14} className="text-slate-600 shrink-0" /> : <ChevronDown size={14} className="text-slate-600 shrink-0" />}
      </button>

      {/* Chart + details — always mounted, hidden via CSS */}
      <div className={cn('px-4 pt-3 pb-4 space-y-3', !expanded && 'hidden')}>
        <T3Chart
          candles={klines ?? []}
          t3={t3Result?.values ?? []}
          signals={signals}
          visible={expanded}
        />

        {/* Details row */}
        <div className="grid grid-cols-4 gap-3 text-xs">
          {/* Son AL fiyatı */}
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
            <p className="text-slate-600 mb-1 uppercase text-[10px] tracking-wider">Son AL</p>
            {coin.lastBuyPrice != null ? (
              <>
                <p className="text-emerald-400 font-mono font-semibold text-[11px]">
                  {coin.lastBuyPrice.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}
                </p>
                <p className="text-slate-600 text-[10px] mt-0.5">{fmtUtc3(coin.lastBuyAt)}</p>
              </>
            ) : (
              <p className="text-slate-700 text-[10px]">—</p>
            )}
          </div>

          {/* Son SAT fiyatı */}
          <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2.5">
            <p className="text-slate-600 mb-1 uppercase text-[10px] tracking-wider">Son SAT</p>
            {coin.lastSellPrice != null ? (
              <>
                <p className="text-red-400 font-mono font-semibold text-[11px]">
                  {coin.lastSellPrice.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}
                </p>
                <p className="text-slate-600 text-[10px] mt-0.5">{fmtUtc3(coin.lastSellAt)}</p>
              </>
            ) : (
              <p className="text-slate-700 text-[10px]">—</p>
            )}
          </div>

          {/* Son tarama */}
          <div className="bg-white/5 rounded-lg p-2.5">
            <p className="text-slate-600 mb-1 uppercase text-[10px] tracking-wider">Son Tarama</p>
            {hasCheck ? (
              <>
                <p className="text-slate-300 font-mono text-[10px]">
                  {coin.lastCheckedPrice?.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}
                </p>
                <p className="text-slate-500 text-[10px] mt-0.5 leading-tight">{coin.lastCheckedReason}</p>
                <p className="text-slate-700 text-[10px] mt-0.5">
                  {fmtUtc3(coin.lastCheckedAt, 'time')}
                </p>
              </>
            ) : (
              <p className="text-slate-700 text-[10px]">—</p>
            )}
          </div>

          {/* T3 durumu */}
          <div className="bg-white/5 rounded-lg p-2.5">
            <p className="text-slate-600 mb-1 uppercase text-[10px] tracking-wider">T3 Durumu</p>
            {t3Result ? (
              <>
                <div className="flex items-center gap-1 mt-0.5">
                  {t3Result.currentT3Up
                    ? <TrendingUp size={10} className="text-emerald-400" />
                    : <TrendingDown size={10} className="text-red-400" />
                  }
                  <span className={t3Result.currentT3Up ? 'text-emerald-400 text-[10px] font-semibold' : 'text-red-400 text-[10px] font-semibold'}>
                    {t3Result.currentT3Up ? 'Yukarı' : 'Aşağı'}
                  </span>
                </div>
                {t3Result.t3TurnUp && <p className="text-emerald-400 text-[10px] mt-0.5 font-semibold">⚡ AL Dönüşü!</p>}
                {t3Result.t3TurnDown && <p className="text-red-400 text-[10px] mt-0.5 font-semibold">⚡ SAT Dönüşü!</p>}
                <p className="text-slate-600 text-[10px] mt-0.5 font-mono">
                  {t3Result.currentT3.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}
                </p>
              </>
            ) : (
              <p className="text-slate-700 text-[10px]">Yükleniyor…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Strategy Section ─────────────────────────────────────────────────────────
function StrategySection({ strategy, t3Period, t3VFactor }: {
  strategy: StrategyMonitor; t3Period: number; t3VFactor: number
}) {
  const [coinsExpanded, setCoinsExpanded] = useState(true)
  const countdown = useCountdown(strategy.timeframe)

  const nextLabel = countdown.sec < 60
    ? `${countdown.sec}sn`
    : `${Math.floor(countdown.sec / 60)}dk ${countdown.sec % 60}sn`
  const nextTime = new Date(countdown.nextMs).toLocaleTimeString('tr-TR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul',
  })

  const openCount = strategy.coins.filter(c => c.hasOpenPosition).length
  const alertCoins = strategy.coins.filter(c => c.reEntryState !== 0)

  return (
    <div className="space-y-3">
      {/* Strategy header bar — click to collapse coins */}
      <button
        type="button"
        onClick={() => setCoinsExpanded(e => !e)}
        className="w-full bg-white/5 border border-white/8 rounded-xl px-5 py-3.5 flex items-center gap-4 flex-wrap hover:bg-white/[0.07] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-yellow-400" />
          <span className="text-sm font-bold text-slate-100">{strategy.name}</span>
          <span className="text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded-full font-medium">{strategy.timeframe}</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center gap-3 text-xs text-slate-500 mr-4">
            <span><span className="text-slate-300 font-semibold">{strategy.coins.length}</span> coin</span>
            <span><span className="text-emerald-400 font-semibold">{openCount}</span> açık</span>
            {alertCoins.length > 0 && (
              <span><span className="text-yellow-400 font-semibold">{alertCoins.length}</span> re-entry</span>
            )}
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-1.5 bg-yellow-400/5 border border-yellow-400/15 rounded-lg px-3 py-1.5" onClick={e => e.stopPropagation()}>
            <Clock size={11} className="text-yellow-400" />
            <span className="text-xs text-slate-400">Sonraki Mum:</span>
            <span className="text-xs text-yellow-400 font-semibold tabular-nums">{nextLabel}</span>
            <span className="text-xs text-slate-600">({nextTime})</span>
          </div>

          {coinsExpanded
            ? <ChevronUp size={15} className="text-slate-600 ml-1 shrink-0" />
            : <ChevronDown size={15} className="text-slate-600 ml-1 shrink-0" />}
        </div>
      </button>

      {/* Coin cards */}
      {coinsExpanded && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
          {strategy.coins.map(coin => (
            <CoinCard key={coin.coinId} coin={coin} timeframe={strategy.timeframe} t3Period={t3Period} t3VFactor={t3VFactor} strategyId={strategy.strategyId} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────
function SummaryBar({ strategies }: { strategies: StrategyMonitor[] }) {
  const totalCoins = strategies.reduce((s, st) => s + st.coins.length, 0)
  const openPositions = strategies.reduce((s, st) => s + st.coins.filter(c => c.hasOpenPosition).length, 0)
  const reEntryWaiting = strategies.reduce((s, st) => s + st.coins.filter(c => c.reEntryState !== 0).length, 0)
  const recentSignals = strategies.reduce((s, st) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return s + st.coins.filter(c => c.lastSignalAt && new Date(c.lastSignalAt).getTime() > cutoff).length
  }, 0)

  const items = [
    { label: 'Aktif Strateji', value: strategies.length, color: 'text-slate-100' },
    { label: 'Takip Edilen Coin', value: totalCoins, color: 'text-slate-100' },
    { label: 'Açık Pozisyon', value: openPositions, color: openPositions > 0 ? 'text-emerald-400' : 'text-slate-600' },
    { label: 'Re-entry Bekliyor', value: reEntryWaiting, color: reEntryWaiting > 0 ? 'text-yellow-400' : 'text-slate-600' },
    { label: 'Son 24s Sinyal', value: recentSignals, color: recentSignals > 0 ? 'text-blue-400' : 'text-slate-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map(item => (
        <div key={item.label} className="bg-white/5 border border-white/5 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className={cn('text-2xl font-bold mt-0.5', item.color)}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MonitorPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['strategy-monitor'],
    queryFn: strategiesApi.monitor,
    refetchInterval: 30_000,
  })

  // Fetch user's T3 indicator settings (period, vFactor)
  const { data: indicators } = useQuery({
    queryKey: ['indicators'],
    queryFn: () => indicatorsApi.list(),
    staleTime: 5 * 60_000,
  })

  const t3Settings = useMemo(() => {
    const t3 = indicators?.find(ind =>
      ind.name.toLowerCase().includes('t3') ||
      ind.name.toLowerCase().includes('tillson') ||
      ind.displayName.toLowerCase().includes('t3')
    )
    if (!t3) return { period: 3, vFactor: 0.7 }
    const period = Number(t3.parameters.find(p => p.parameterKey.toLowerCase() === 'period')?.value ?? 3)
    const vFactor = Number(t3.parameters.find(p =>
      p.parameterKey.toLowerCase().includes('factor') ||
      p.parameterKey.toLowerCase() === 'vfactor' ||
      p.parameterKey.toLowerCase() === 'v'
    )?.value ?? 0.7)
    return { period: isNaN(period) ? 3 : period, vFactor: isNaN(vFactor) ? 0.7 : vFactor }
  }, [indicators])

  return (
    <>
      <Header title="Strateji Takip" />
      <div className="p-6 space-y-5 max-w-[1400px]">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            <p className="text-xs text-slate-500">
              OHLCV Binance'den · Sarı çizgi T3 (periyot {t3Settings.period}) · Oklar AL/SAT sinyalleri
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Yenile
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        )}

        {data && data.length === 0 && !isLoading && (
          <div className="bg-white/5 border border-white/5 rounded-2xl p-12 text-center">
            <Activity size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aktif strateji bulunamadı.</p>
            <p className="text-slate-700 text-xs mt-1">Stratejiler sayfasından bir strateji oluşturun ve aktif edin.</p>
          </div>
        )}

        {data && data.length > 0 && (
          <>
            <SummaryBar strategies={data} />
            {data.map(strategy => (
              <StrategySection
                key={strategy.strategyId}
                strategy={strategy}
                t3Period={t3Settings.period}
                t3VFactor={t3Settings.vFactor}
              />
            ))}
          </>
        )}
      </div>
    </>
  )
}
