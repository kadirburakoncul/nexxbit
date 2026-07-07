import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { bistApi } from '@/api/bist'
import type { BistStrategyStock, BistOhlcv } from '@/api/bist'
import {
  ArrowUpRight, ArrowDownRight, CandlestickChart, RefreshCw,
  CheckCircle2, XCircle, Clock, Activity, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtTime(s: string | null) {
  if (!s) return '—'
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

function fmtPrice(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Countdown ─────────────────────────────────────────────────────────────────
const INTERVAL_MS: Record<string, number> = {
  '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000, '1d': 86_400_000,
}

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

// ── SummaryBar ────────────────────────────────────────────────────────────────
function SummaryBar({ strategies }: { strategies: any[] }) {
  const totalStocks  = strategies.reduce((s, st) => s + st.stocks.length, 0)
  const t3UpCount    = strategies.reduce((s, st) => s + st.stocks.filter((x: any) => x.lastT3UpDirection === true).length, 0)
  const t3DownCount  = strategies.reduce((s, st) => s + st.stocks.filter((x: any) => x.lastT3UpDirection === false).length, 0)
  const scannedCount = strategies.reduce((s, st) => s + st.stocks.filter((x: any) => !!x.lastCheckedAt).length, 0)

  const items = [
    { label: 'Aktif Strateji',  value: strategies.length,  color: 'text-slate-100' },
    { label: 'Takip Edilen',    value: totalStocks,         color: 'text-slate-100' },
    { label: 'T3 Yukarı',       value: t3UpCount,           color: t3UpCount   > 0 ? 'text-emerald-400' : 'text-slate-600' },
    { label: 'T3 Aşağı',        value: t3DownCount,         color: t3DownCount > 0 ? 'text-red-400'     : 'text-slate-600' },
    { label: 'Son Taranan',      value: scannedCount,        color: 'text-slate-300' },
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

// ── MiniSparkline ─────────────────────────────────────────────────────────────
function MiniSparkline({ candles }: { candles: BistOhlcv[] }) {
  if (candles.length < 2) return null

  const closes = candles.map(c => c.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const W = 200, H = 48

  const pts = closes.map((v, i) => ({
    x: (i / (closes.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 6) - 3,
  }))

  const linePts = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaD = [
    `M${pts[0].x},${pts[0].y}`,
    ...pts.slice(1).map(p => `L${p.x},${p.y}`),
    `L${W},${H}`, `L0,${H}`, 'Z',
  ].join(' ')

  const isUp = closes[closes.length - 1] >= closes[0]
  const color = isUp ? '#34d399' : '#f87171'
  const gradId = `sg-${isUp ? 'u' : 'd'}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── StockCard ─────────────────────────────────────────────────────────────────
function StockCard({ stock, timeframe }: { stock: BistStrategyStock; timeframe: string }) {
  const navigate = useNavigate()
  const t3Up = stock.lastT3UpDirection

  const { data: candles } = useQuery({
    queryKey: ['bist-mini-chart', stock.symbol, timeframe],
    queryFn: () => bistApi.chart(stock.symbol, timeframe, 60),
    staleTime: 5 * 60_000,
  })

  return (
    <div className="bg-[#0f1117] border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
          <span className="text-yellow-400 text-xs font-bold">{stock.symbol.slice(0, 2)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-100">{stock.symbol}</p>
          <p className="text-xs text-slate-500 truncate">{stock.displayName}</p>
        </div>
        <button
          onClick={() => navigate(`/bist/chart?symbol=${stock.symbol}&timeframe=${timeframe}`)}
          className="p-1.5 text-slate-500 hover:text-yellow-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
          title="Grafiğe git"
        >
          <CandlestickChart size={14} />
        </button>
      </div>

      {/* Inline mini chart */}
      <div className="px-2 pt-2 pb-0">
        {candles && candles.length >= 2 ? (
          <MiniSparkline candles={candles} />
        ) : (
          <div className="h-12 flex items-center justify-center">
            <div className="w-4 h-4 border border-white/10 border-t-slate-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-slate-100 font-mono">
            {fmtPrice(stock.lastPrice)}
            <span className="text-xs text-slate-500 ml-1 font-sans">₺</span>
          </p>
          {t3Up != null ? (
            <span className={cn('flex items-center gap-1 text-xs font-semibold', t3Up ? 'text-emerald-400' : 'text-red-400')}>
              {t3Up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {t3Up ? 'T3 Yukarı' : 'T3 Aşağı'}
            </span>
          ) : (
            <span className="text-xs text-slate-600">T3 bekleniyor…</span>
          )}
        </div>

        <div className="bg-white/[0.03] rounded-lg px-3 py-2">
          {stock.lastCheckedReason ? (
            <div className="flex items-start gap-2">
              {stock.lastCheckedReason.toLowerCase().includes('al') ||
               stock.lastCheckedReason.toLowerCase().includes('sinyal') ? (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : stock.lastCheckedReason.toLowerCase().includes('bekleniyor') ||
                  stock.lastCheckedReason.toLowerCase().includes('sinyal yok') ? (
                <Clock size={13} className="text-slate-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={13} className="text-slate-600 shrink-0 mt-0.5" />
              )}
              <p className="text-xs text-slate-400">{stock.lastCheckedReason}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-600">Henüz taranmadı</p>
          )}
        </div>

        {stock.lastCheckedAt && (
          <p className="text-[10px] text-slate-600">Son tarama: {fmtTime(stock.lastCheckedAt)}</p>
        )}
      </div>
    </div>
  )
}

// ── StrategySection ───────────────────────────────────────────────────────────
function StrategySection({ strategy }: { strategy: any }) {
  const [expanded, setExpanded] = useState(true)
  const countdown = useCountdown(strategy.timeframe)

  const nextLabel = countdown.sec < 60
    ? `${countdown.sec}sn`
    : `${Math.floor(countdown.sec / 60)}dk ${countdown.sec % 60}sn`

  const t3UpCount   = strategy.stocks.filter((s: any) => s.lastT3UpDirection === true).length
  const t3DownCount = strategy.stocks.filter((s: any) => s.lastT3UpDirection === false).length

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full bg-white/5 border border-white/8 rounded-xl px-5 py-3.5 flex items-center gap-4 flex-wrap hover:bg-white/[0.07] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-yellow-400" />
          <span className="text-sm font-bold text-slate-100">{strategy.name}</span>
          <span className="text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded-full font-medium">
            {strategy.timeframe}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center gap-3 text-xs text-slate-500 mr-4">
            <span><span className="text-slate-300 font-semibold">{strategy.stocks.length}</span> hisse</span>
            <span><span className="text-emerald-400 font-semibold">{t3UpCount}</span> yukarı</span>
            <span><span className="text-red-400 font-semibold">{t3DownCount}</span> aşağı</span>
          </div>

          <div
            className="flex items-center gap-1.5 bg-yellow-400/5 border border-yellow-400/15 rounded-lg px-3 py-1.5"
            onClick={e => e.stopPropagation()}
          >
            <Clock size={11} className="text-yellow-400" />
            <span className="text-xs text-slate-400">Sonraki:</span>
            <span className="text-xs text-yellow-400 font-semibold tabular-nums">{nextLabel}</span>
          </div>

          {expanded
            ? <ChevronUp size={15} className="text-slate-600 ml-1 shrink-0" />
            : <ChevronDown size={15} className="text-slate-600 ml-1 shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {strategy.stocks.map((stock: any) => (
            <StockCard key={stock.stockId} stock={stock} timeframe={strategy.timeframe} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BistMonitorPage() {
  const { data: strategies, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['bist-strategies'],
    queryFn: bistApi.strategies,
    refetchInterval: 60_000,
  })

  const activeStrategies = strategies?.filter(s => s.isActive) ?? []

  return (
    <>
      <Header title="BIST Takip" />
      <div className="p-3 md:p-6 max-w-[1400px] space-y-4 md:space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-yellow-400" />
            <p className="text-xs text-slate-500">
              Yahoo Finance verisi (~15-20dk gecikmeli) · T3 göstergesi
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

        {!isLoading && activeStrategies.length === 0 && (
          <div className="bg-white/5 border border-white/5 rounded-2xl p-12 text-center">
            <Activity size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aktif BIST stratejisi yok.</p>
            <p className="text-slate-700 text-xs mt-1">Stratejiler sayfasından bir strateji oluşturun ve aktive edin.</p>
          </div>
        )}

        {activeStrategies.length > 0 && (
          <>
            <SummaryBar strategies={activeStrategies} />
            {activeStrategies.map(strategy => (
              <StrategySection key={strategy.id} strategy={strategy} />
            ))}
          </>
        )}
      </div>
    </>
  )
}
