import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { useSignalR } from '@/hooks/useSignalR'
import { Link } from 'react-router-dom'
import { binanceApi } from '@/api/binance'
import { signalRecordsApi } from '@/api/signals'
import { strategiesApi } from '@/api/strategies'
import { notificationsApi } from '@/api/notifications'
import { coinsApi } from '@/api/coins'
import type { MomentumCoin } from '@/api/coins'
import { formatUsdt, cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Wifi, WifiOff, Activity, RefreshCw,
  AlertCircle, ArrowUpRight, ArrowDownRight, Bell, Radar,
  BarChart3, Zap, ChevronRight, DollarSign, Target, Shield, Flame,
  X, Timer, BarChart2
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import Header from '@/components/layout/Header'
import BalanceChart from '@/components/charts/BalanceChart'

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, color = 'text-slate-100',
  accent = 'border-white/5', glow, warn, loading,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType
  color?: string; accent?: string; glow?: string; warn?: string; loading?: boolean
}) {
  return (
    <div className={cn(
      'relative bg-white/5 border rounded-2xl p-3 sm:p-5 overflow-hidden',
      accent,
      glow && `before:absolute before:inset-0 before:rounded-2xl before:opacity-20 before:blur-xl before:${glow}`
    )}>
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center bg-white/5', color.replace('text-', 'text-'))}>
          <Icon size={14} className={color} />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-white/10 rounded animate-pulse" />
      ) : (
        <p className={cn('text-lg sm:text-2xl font-bold tracking-tight truncate', color)}>{value}</p>
      )}
      {sub && !loading && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
      {warn && <p className="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1"><AlertCircle size={10} />{warn}</p>}
    </div>
  )
}

// ─── PnL Badge ───────────────────────────────────────────────────────────────
function PnlBadge({ value, pct, size = 'sm' }: { value: number | null; pct?: number | null; size?: 'sm' | 'lg' }) {
  if (value === null) return <span className="text-slate-700">—</span>
  const pos = value >= 0
  const cls = pos ? 'text-emerald-400' : 'text-red-400'
  const Icon = pos ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('flex items-center gap-0.5 font-semibold', cls, size === 'lg' ? 'text-base' : 'text-xs')}>
      <Icon size={size === 'lg' ? 14 : 11} />
      {pos ? '+' : ''}{value.toFixed(size === 'lg' ? 4 : 2)}
      {pct != null && <span className="opacity-70 ml-1">({pos ? '+' : ''}{pct.toFixed(2)}%)</span>}
    </span>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, icon: Icon, to, onAction, actionLabel = 'Tümü' }: {
  title: string; sub?: string; icon: React.ElementType
  to?: string; onAction?: () => void; actionLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {sub && <span className="text-xs text-slate-600">{sub}</span>}
      </div>
      {onAction && (
        <button onClick={onAction} className="flex items-center gap-1 text-xs text-slate-600 hover:text-yellow-400 transition-colors">
          {actionLabel} <ChevronRight size={12} />
        </button>
      )}
      {to && !onAction && (
        <Link to={to} className="flex items-center gap-1 text-xs text-slate-600 hover:text-yellow-400 transition-colors">
          Tümü <ChevronRight size={12} />
        </Link>
      )}
    </div>
  )
}

// ─── Momentum Modal ────────────────────────────────────────────────────────────
function MomentumModal({ coins, countdown, onClose }: {
  coins: MomentumCoin[]
  countdown: number
  onClose: () => void
}) {
  const fmtVol = (v: number) =>
    v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)}B`
    : v >= 1_000_000   ? `${(v / 1_000_000).toFixed(1)}M`
    : `${(v / 1_000).toFixed(0)}K`

  const fmtPx = (p: number) =>
    p >= 1000 ? p.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
    : p >= 1  ? p.toLocaleString('tr-TR', { maximumFractionDigits: 4 })
    : p.toFixed(6)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Flame size={15} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Momentum Tarayıcısı</h2>
              <p className="text-[10px] text-slate-600">24 saatlik en çok yükselen USDT çiftleri · min %3 yükseliş</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Geri sayım */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
              <Timer size={11} className={countdown <= 10 ? 'text-orange-400' : 'text-slate-500'} />
              <span className={cn('text-xs font-mono tabular-nums font-semibold',
                countdown <= 10 ? 'text-orange-400' : 'text-slate-400')}>
                {countdown}s
              </span>
              <span className="text-[10px] text-slate-700">yenileme</span>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* İstatistik özeti */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02] shrink-0 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
            {coins.length} coin momentum'da
          </span>
          {coins.length > 0 && (
            <>
              <span>En yüksek: <strong className="text-emerald-400">+{Math.max(...coins.map(c => c.priceChangePercent)).toFixed(1)}%</strong></span>
              <span>Ort. değişim: <strong className="text-slate-300">+{(coins.reduce((s, c) => s + c.priceChangePercent, 0) / coins.length).toFixed(1)}%</strong></span>
            </>
          )}
        </div>

        {/* Tablo */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0f1117] border-b border-white/8 z-10">
              <tr className="text-[10px] text-slate-600 uppercase tracking-wider">
                <th className="text-left px-5 py-3 w-8">#</th>
                <th className="text-left px-2 py-3">Coin</th>
                <th className="text-right px-4 py-3">Fiyat</th>
                <th className="text-right px-4 py-3">24s %</th>
                <th className="text-right px-4 py-3">Yüksek</th>
                <th className="text-right px-4 py-3">Düşük</th>
                <th className="text-right px-5 py-3">Hacim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {coins.map((c, i) => {
                const range = c.highPrice - c.lowPrice
                const rangePct = c.lowPrice > 0 ? (range / c.lowPrice) * 100 : 0
                return (
                  <tr key={c.symbol} className="hover:bg-white/[0.04] transition-colors">
                    <td className="px-5 py-3 text-slate-700 text-xs">{i + 1}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-orange-400/10 flex items-center justify-center shrink-0">
                          <span className="text-orange-400 text-[9px] font-bold">{c.baseAsset.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-200">{c.baseAsset}</p>
                          <p className="text-[10px] text-slate-600">{c.symbol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-200">{fmtPx(c.lastPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-emerald-400">+{c.priceChangePercent.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-400">{fmtPx(c.highPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-500">{fmtPx(c.lowPrice)}</td>
                    <td className="px-5 py-3 text-right">
                      <p className="text-xs font-mono text-slate-400">{fmtVol(c.quoteVolume)}</p>
                      <p className="text-[10px] text-slate-700">aralık %{rangePct.toFixed(1)}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-slate-700 flex items-center gap-1">
            <BarChart2 size={10} /> Binance 24h ticker · min %3 yükseliş · min 1M USDT hacim
          </span>
          <div className="flex items-center gap-1 text-[10px] text-slate-700">
            <Timer size={10} />
            <span className={countdown <= 10 ? 'text-orange-500' : ''}>
              {countdown}s sonra yenileniyor
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Win Rate Ring ────────────────────────────────────────────────────────────
function WinRateRing({ wins, losses, total }: { wins: number; losses: number; total: number }) {
  const rate = total > 0 ? (wins / total) * 100 : 0
  const R = 28, cx = 36, cy = 36
  const circ = 2 * Math.PI * R
  const winArc = total > 0 ? (wins / total) * circ : 0

  return (
    <div className="flex items-center gap-3">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        {total > 0 && (
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#10b981" strokeWidth="8"
            strokeDasharray={`${winArc} ${circ - winArc}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} />
        )}
        {losses > 0 && total > 0 && (
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#ef4444" strokeWidth="8"
            strokeDasharray={`${circ - winArc} ${winArc}`} strokeLinecap="round"
            strokeDashoffset={-winArc} transform={`rotate(-90 ${cx} ${cy})`} />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">
          {rate.toFixed(0)}%
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7" fill="rgba(148,163,184,0.7)">başarı</text>
      </svg>
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Kazanç <span className="text-emerald-400 font-semibold">{wins}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className="text-slate-400">Kayıp <span className="text-red-400 font-semibold">{losses}</span></span>
        </div>
        <div className="text-slate-600">{total} toplam</div>
      </div>
    </div>
  )
}

// ─── P&L Equity Curve ────────────────────────────────────────────────────────

function PnlEquityChart({ positions }: { positions: Array<{ closedAt: string | null; realizedPnl: number | null }> }) {
  const sorted = [...positions]
    .filter(p => p.closedAt && p.realizedPnl !== null)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())

  if (sorted.length < 2) return null

  let cum = 0
  const points = sorted.map(p => { cum += p.realizedPnl!; return cum })
  const minY = Math.min(0, ...points)
  const maxY = Math.max(0, ...points)
  const range = maxY - minY || 1
  const W = 600, H = 120, PAD = 8
  const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const ys = points.map(v => PAD + (1 - (v - minY) / range) * (H - PAD * 2))
  const zeroY = PAD + (1 - (0 - minY) / range) * (H - PAD * 2)
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${xs[xs.length - 1].toFixed(1)},${zeroY.toFixed(1)} L${xs[0].toFixed(1)},${zeroY.toFixed(1)} Z`
  const finalPnl = points[points.length - 1]
  const isPos = finalPnl >= 0
  const color = isPos ? '#10b981' : '#ef4444'

  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-200">P&L Eğrisi</h2>
          <span className="text-xs text-slate-600">{sorted.length} işlem</span>
        </div>
        <span className={`text-sm font-bold font-mono ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPos ? '+' : ''}{finalPnl.toFixed(2)} USDT
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Zero line */}
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,4" />
        {/* Area fill */}
        <path d={areaD} fill="url(#pnlGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Last dot */}
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={color} />
      </svg>
    </div>
  )
}

// ─── Portfolio Heatmap ───────────────────────────────────────────────────────

interface HeatmapTile {
  symbol: string
  pnlPct: number | null
  hasOpenPosition: boolean
}

function PortfolioHeatmap({ tiles }: { tiles: HeatmapTile[] }) {
  if (tiles.length === 0) return null

  const maxAbs = Math.max(...tiles.map(t => Math.abs(t.pnlPct ?? 0)), 1)

  const tileColor = (pct: number | null, hasPos: boolean) => {
    if (!hasPos) return 'bg-slate-800/60 text-slate-600'
    if (pct === null) return 'bg-slate-700/60 text-slate-500'
    const intensity = Math.min(Math.abs(pct) / maxAbs, 1)
    if (pct > 0) {
      if (intensity > 0.6) return 'bg-emerald-600/90 text-white'
      if (intensity > 0.3) return 'bg-emerald-600/50 text-emerald-200'
      return 'bg-emerald-600/25 text-emerald-400'
    } else {
      if (intensity > 0.6) return 'bg-red-600/90 text-white'
      if (intensity > 0.3) return 'bg-red-600/50 text-red-200'
      return 'bg-red-600/25 text-red-400'
    }
  }

  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Portföy Isı Haritası</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        {tiles.map(t => (
          <div
            key={t.symbol}
            className={cn('rounded-lg p-2 flex flex-col items-center justify-center gap-0.5 min-h-[52px] transition-colors', tileColor(t.pnlPct, t.hasOpenPosition))}
          >
            <span className="text-[10px] font-bold truncate w-full text-center">{t.symbol.replace('USDT', '')}</span>
            {t.hasOpenPosition && t.pnlPct !== null && (
              <span className="text-[9px]">{t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(1)}%</span>
            )}
            {!t.hasOpenPosition && (
              <span className="text-[9px] opacity-50">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const MOMENTUM_INTERVAL = 60 // saniye

const DASHBOARD_KEYS = [
  ['binance-status'], ['balances'], ['positions', 'dashboard-all'],
  ['signal-history', 'dashboard'], ['signal-stats'], ['strategy-monitor'],
  ['notifications'], ['momentum-coins'],
]

export default function DashboardPage() {
  const qc = useQueryClient()
  const [momentumOpen, setMomentumOpen] = useState(false)
  const [countdown, setCountdown] = useState(MOMENTUM_INTERVAL)
  const [lastSync, setLastSync] = useState<Date>(new Date())
  const [syncing, setSyncing] = useState(false)

  const syncAll = async () => {
    setSyncing(true)
    await Promise.all(DASHBOARD_KEYS.map(key => qc.invalidateQueries({ queryKey: key })))
    setLastSync(new Date())
    setSyncing(false)
  }

  // Sayfaya her gelindiğinde tüm verileri yenile
  useEffect(() => {
    syncAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['binance-status'],
    queryFn: binanceApi.getStatus,
    refetchInterval: 60_000,
  })

  const { data: balances, isLoading: balanceLoading, isError: balanceError, error: balanceErrObj, refetch: refetchBal } = useQuery({
    queryKey: ['balances'],
    queryFn: binanceApi.getBalances,
    enabled: !!status?.isConnected,
    staleTime: 30_000,
    retry: 0,
  })

  const { data: positions } = useQuery({
    queryKey: ['positions', 'dashboard-all'],
    queryFn: () => signalRecordsApi.list({ pageSize: 200 }),
    refetchInterval: 15_000,
  })


  const { data: monitor } = useQuery({
    queryKey: ['strategy-monitor'],
    queryFn: strategiesApi.monitor,
    refetchInterval: 30_000,
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ pageSize: 5 }),
    refetchInterval: 30_000,
  })

  const { data: momentumCoins, dataUpdatedAt: momentumUpdatedAt } = useQuery({
    queryKey: ['momentum-coins'],
    queryFn: () => coinsApi.getMomentumCoins(3, 50),
    refetchInterval: MOMENTUM_INTERVAL * 1000,
    staleTime: (MOMENTUM_INTERVAL - 5) * 1000,
  })

  // Geri sayım: veri her güncellendiğinde sıfırla
  useEffect(() => {
    setCountdown(MOMENTUM_INTERVAL)
  }, [momentumUpdatedAt])

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  // Candle WebSocket — strateji coinlerine subscribe ol, her kapanan mumda sinyal/pozisyon invalidate et
  const watchlistCoins = monitor?.flatMap(st => st.coins.map(c => ({ symbol: c.coinSymbol, interval: st.timeframe }))) ?? []
  useSignalR({
    hubUrl: '/hubs/candle',
    enabled: watchlistCoins.length > 0,
    events: {
      CandleUpdate: useCallback(() => {
        qc.invalidateQueries({ queryKey: ['signal-history', 'dashboard'] })
        qc.invalidateQueries({ queryKey: ['positions', 'dashboard-all'] })
        qc.invalidateQueries({ queryKey: ['signal-stats'] })
      }, [qc]),
    },
    onConnected: useCallback(async (conn) => {
      for (const { symbol, interval } of watchlistCoins) {
        try { await conn.invoke('JoinRoom', symbol, interval) } catch { }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(watchlistCoins)]),
  })

  const open = positions?.filter(p => p.status === 'Open') ?? []
  const closed = positions?.filter(p => p.status !== 'Open') ?? []
  const recentClosed = closed.slice(0, 10)

  const usdt = balances?.find(b => b.asset === 'USDT')
  const usdtFree = usdt?.free ?? 0
  const usdtLocked = usdt?.locked ?? 0
  const assetCount = balances?.filter(b => b.free + b.locked > 0).length ?? 0

  // P&L %: her işlemin pnlPct'sinin toplamı (sanal + gerçek)
  const closedPositions = positions?.filter(p => p.status !== 'Open') ?? []
  const closedWithPnlPct = closedPositions.filter(p => p.realizedPnlPct != null)
  const totalPnlPct = closedWithPnlPct.reduce((s, p) => s + (p.realizedPnlPct ?? 0), 0)
  const totalPnlWins = closedWithPnlPct.filter(p => (p.realizedPnlPct ?? 0) > 0).length
  const totalPnlLosses = closedWithPnlPct.filter(p => (p.realizedPnlPct ?? 0) < 0).length
  const winRate = closedWithPnlPct.length > 0 ? (totalPnlWins / closedWithPnlPct.length) * 100 : 0

  // Active strategies + monitored coins
  const activeStrategies = monitor?.length ?? 0
  const monitoredCoins = monitor?.reduce((s, st) => s + st.coins.length, 0) ?? 0
  const openMonitorPositions = monitor?.reduce((s, st) => s + st.coins.filter(c => c.hasOpenPosition).length, 0) ?? 0

  const isConnected = status?.isConnected ?? false

  // Heatmap: tüm monitor coinleri + açık pozisyon varsa realizedPnlPct
  const heatmapTiles: HeatmapTile[] = monitor?.flatMap(st =>
    st.coins.map(c => {
      const openPos = open.find(p => p.coinSymbol === c.coinSymbol && !p.isVirtual)
      return {
        symbol: c.coinSymbol,
        pnlPct: openPos?.realizedPnlPct ?? null,
        hasOpenPosition: c.hasOpenPosition,
      }
    })
  ).filter((t, i, arr) => arr.findIndex(x => x.symbol === t.symbol) === i) ?? []

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1400px]">
        {/* Sync bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>Son güncelleme: <span className="text-slate-500 tabular-nums">{format(lastSync, 'HH:mm:ss')}</span></span>
          <button
            onClick={syncAll}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            Tümünü Yenile
          </button>
        </div>

        {/* ── Hero: top metrics row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {/* Bağlantı */}
          <MetricCard
            label="Binance"
            value={statusLoading ? '…' : isConnected ? 'Bağlı' : 'Bağlı Değil'}
            sub={isConnected ? (status?.isTestnet ? 'Testnet modu' : 'Mainnet — canlı') : 'API bağlantısı yok'}
            icon={isConnected ? Wifi : WifiOff}
            color={isConnected ? 'text-emerald-400' : 'text-red-400'}
            accent={isConnected ? 'border-emerald-500/15' : 'border-red-500/15'}
          />

          {/* USDT */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">USDT Bakiye</span>
              <button
                onClick={() => { refetchBal(); qc.invalidateQueries({ queryKey: ['binance-status'] }) }}
                disabled={balanceLoading}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-600 hover:text-slate-300 transition-colors"
              >
                <RefreshCw size={12} className={balanceLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            {!isConnected ? (
              <p className="text-2xl font-bold text-slate-700">—</p>
            ) : balanceLoading ? (
              <div className="h-7 w-28 bg-white/10 rounded animate-pulse" />
            ) : balanceError ? (
              <div>
                <p className="text-sm text-red-400">Bakiye Alınamadı</p>
                <p className="text-xs text-red-400/60 mt-0.5 max-w-48 truncate" title={String((balanceErrObj as any)?.response?.data?.errors?.[0] ?? (balanceErrObj as any)?.message ?? '')}>
                  {(balanceErrObj as any)?.response?.data?.errors?.[0] ?? (balanceErrObj as any)?.message ?? 'API hatası'}
                </p>
              </div>
            ) : (
              <p className="text-2xl font-bold text-slate-100">{formatUsdt(usdtFree)}</p>
            )}
            {usdtLocked > 0 && <p className="text-xs text-slate-600 mt-1.5">Kilitli: {formatUsdt(usdtLocked)}</p>}
            {isConnected && !balanceLoading && !balanceError && usdtFree === 0 && (
              <p className="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1">
                <AlertCircle size={10} /> Spot cüzdan boş
              </p>
            )}
            {isConnected && !balanceLoading && !balanceError && assetCount > 0 && (
              <p className="text-xs text-slate-600 mt-1.5">{assetCount} varlık</p>
            )}
          </div>

          {/* Toplam K/Z */}
          <MetricCard
            label="Toplam K/Z"
            value={closedWithPnlPct.length > 0
              ? `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`
              : '—'}
            sub={closedWithPnlPct.length > 0
              ? `${closedWithPnlPct.length} işlem · ${totalPnlWins}K / ${totalPnlLosses}Z`
              : undefined}
            icon={totalPnlPct >= 0 ? TrendingUp : TrendingDown}
            color={closedWithPnlPct.length === 0 ? 'text-slate-500' : totalPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}
            accent={totalPnlPct >= 0 ? 'border-emerald-500/10' : 'border-red-500/10'}
          />

          {/* Açık Pozisyon */}
          <MetricCard
            label="Açık Pozisyon"
            value={String(open.length)}
            sub={open.length > 0 ? open.map(p => p.coinSymbol).join(', ') : 'Şu an aktif pozisyon yok'}
            icon={Activity}
            color={open.length > 0 ? 'text-yellow-400' : 'text-slate-500'}
            accent={open.length > 0 ? 'border-yellow-400/15' : 'border-white/5'}
          />

          {/* Strateji Takip */}
          <Link to="/monitor" className="block">
            <div className="bg-white/5 border border-yellow-400/10 hover:border-yellow-400/25 rounded-2xl p-5 h-full transition-colors group">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Aktif Takip</span>
                <div className="w-7 h-7 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                  <Radar size={14} className="text-yellow-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{monitoredCoins}</p>
              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1 group-hover:text-yellow-400/50 transition-colors">
                {activeStrategies} strateji · {openMonitorPositions} açık
                <ChevronRight size={11} className="ml-0.5" />
              </p>
            </div>
          </Link>
        </div>

        {/* ── Main content ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">

          {/* Left column: balance chart + performance */}
          <div className="xl:col-span-2 space-y-5">

            {/* Balance history chart */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
              <SectionHeader title="Bakiye Geçmişi" sub="Son 30 gün" icon={BarChart3} />
              {isConnected ? (
                <BalanceChart days={30} />
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-700 text-sm">
                  Binance bağlantısı gerekli
                </div>
              )}
            </div>

            {/* P&L Equity Curve */}
            <PnlEquityChart positions={closed} />

            {/* Portfolio Heatmap */}
            {heatmapTiles.length > 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <PortfolioHeatmap tiles={heatmapTiles} />
              </div>
            )}

            {/* Performance summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Win/Loss ring */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <SectionHeader title="Performans" sub={winRate > 0 ? `${winRate.toFixed(1)}% başarı` : undefined} icon={Target} to="/signals" />
                <WinRateRing wins={totalPnlWins} losses={totalPnlLosses} total={closedWithPnlPct.length} />
              </div>

              {/* Open positions quick view */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <SectionHeader title="Açık Pozisyonlar" sub={`${open.length} aktif`} icon={Zap} to="/positions" />
                {open.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-5 text-center">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
                      <Activity size={16} className="text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-600">Açık pozisyon yok</p>
                  </div>
                ) : (
                  <div className="space-y-2 mt-1">
                    {open.slice(0, 4).map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-yellow-400/10 flex items-center justify-center">
                            <span className="text-yellow-400 text-[9px] font-bold">{p.coinSymbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{p.coinSymbol}</p>
                            <p className="text-[10px] text-slate-600 font-mono">{p.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">Açık</span>
                          <p className="text-[10px] text-slate-600 mt-0.5">{format(new Date(p.openedAt), 'dd MMM', { locale: tr })}</p>
                        </div>
                      </div>
                    ))}
                    {open.length > 4 && (
                      <p className="text-xs text-slate-600 text-center pt-1">+{open.length - 4} daha</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recent closed positions */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
              <SectionHeader title="Son Kapanan Sinyaller" sub={`${closed.length} kapanan pozisyon`} icon={DollarSign} to="/signals" />
              {recentClosed.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-6">Henüz kapanan pozisyon yok</p>
              ) : (
                <div className="space-y-0 -mx-1">
                  {recentClosed.map((p, i) => {
                    const pnl = p.realizedPnl
                    const pnlPct = p.realizedPnlPct
                    const pos = pnlPct != null ? pnlPct >= 0 : (pnl != null ? pnl >= 0 : true)
                    const fmtPrice = (v: number) => v.toLocaleString('tr-TR', {
                      maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 6
                    })
                    return (
                      <div key={p.id} className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5',
                        i % 2 === 0 && 'bg-white/[0.02]'
                      )}>
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                          pos ? 'bg-emerald-500/10' : 'bg-red-500/10'
                        )}>
                          {pos
                            ? <ArrowUpRight size={14} className="text-emerald-400" />
                            : <ArrowDownRight size={14} className="text-red-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-200">{p.coinSymbol}</p>
                          <p className="text-[10px] text-slate-500">
                            {format(new Date(p.openedAt), 'dd MMM HH:mm', { locale: tr })}
                            {p.closedAt && ` → ${format(new Date(p.closedAt), 'dd MMM HH:mm', { locale: tr })}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0 font-mono space-y-0.5">
                          <p className="text-[10px] text-slate-400">
                            <span className="text-slate-600">Al: </span>
                            <span>{fmtPrice(p.entryPrice)}</span>
                          </p>
                          {p.closePrice != null && (
                            <p className="text-[10px] text-slate-400">
                              <span className="text-slate-600">Sat: </span>
                              <span>{fmtPrice(p.closePrice)}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 min-w-[52px]">
                          {pnlPct != null ? (
                            <p className={cn('text-sm font-bold', pos ? 'text-emerald-400' : 'text-red-400')}>
                              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                            </p>
                          ) : (
                            <p className="text-xs text-slate-600">—</p>
                          )}
                          {pnl != null && (
                            <PnlBadge value={pnl} size="sm" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column: strategy monitor + notifications */}
          <div className="space-y-5">

            {/* Active strategies widget */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
              <SectionHeader title="Strateji Takibi" icon={Radar} to="/monitor" />
              {!monitor || monitor.length === 0 ? (
                <div className="text-center py-6">
                  <Shield size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">Aktif strateji yok</p>
                  <Link to="/strategies" className="text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors mt-1 block">
                    Strateji oluştur →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {monitor.map(strategy => {
                    const openCount = strategy.coins.filter(c => c.hasOpenPosition).length
                    const alertCount = strategy.coins.filter(c => c.reEntryState !== 0).length
                    return (
                      <div key={strategy.strategyId} className="bg-white/5 border border-white/5 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200">{strategy.name}</span>
                            <span className="text-[10px] bg-yellow-400/10 text-yellow-400 border border-yellow-400/15 px-1.5 py-0.5 rounded-full">{strategy.timeframe}</span>
                          </div>
                          {alertCount > 0 && (
                            <span className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                              {alertCount} re-entry
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {strategy.coins.map(coin => (
                            <div key={coin.coinId} className={cn(
                              'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border',
                              coin.hasOpenPosition
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : coin.reEntryState !== 0
                                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
                                  : 'bg-white/5 border-white/10 text-slate-400'
                            )}>
                              <span className="font-semibold">{coin.coinSymbol.replace('USDT', '')}</span>
                              {coin.hasOpenPosition && <span className="opacity-60">●</span>}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600">
                          <span>{strategy.coins.length} coin</span>
                          {openCount > 0 && <span className="text-emerald-500">{openCount} açık</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Momentum Tarayıcısı */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
              {/* Başlık + geri sayım */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame size={15} className="text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-200">Momentum Tarayıcısı</h2>
                  <span className="text-xs text-slate-600">24s en çok yükselen</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Geri sayım rozeti */}
                  <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-md px-2 py-1">
                    <Timer size={10} className={countdown <= 10 ? 'text-orange-400' : 'text-slate-600'} />
                    <span className={cn('text-[10px] font-mono tabular-nums font-semibold',
                      countdown <= 10 ? 'text-orange-400' : 'text-slate-600')}>
                      {countdown}s
                    </span>
                  </div>
                  {momentumCoins && momentumCoins.length > 0 && (
                    <button
                      onClick={() => setMomentumOpen(true)}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-yellow-400 transition-colors"
                    >
                      Tümü <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>

              {!momentumCoins || momentumCoins.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-5">Veri alınıyor…</p>
              ) : (
                <div className="space-y-1.5">
                  {momentumCoins.slice(0, 8).map((c, i) => (
                    <div key={c.symbol} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-700 w-4">{i + 1}</span>
                        <div className="w-6 h-6 rounded-md bg-orange-400/10 flex items-center justify-center">
                          <span className="text-orange-400 text-[8px] font-bold">{c.baseAsset.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-200">{c.baseAsset}</p>
                          <p className="text-[10px] text-slate-600 font-mono">
                            {c.lastPrice >= 1
                              ? c.lastPrice.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                              : c.lastPrice.toFixed(6)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-400">+{c.priceChangePercent.toFixed(1)}%</p>
                        <p className="text-[10px] text-slate-600">
                          {c.quoteVolume >= 1_000_000
                            ? `${(c.quoteVolume / 1_000_000).toFixed(1)}M`
                            : `${(c.quoteVolume / 1_000).toFixed(0)}K`} USDT
                        </p>
                      </div>
                    </div>
                  ))}
                  {momentumCoins.length > 8 && (
                    <button
                      onClick={() => setMomentumOpen(true)}
                      className="w-full text-[10px] text-slate-700 hover:text-yellow-400/70 text-center pt-1.5 pb-0.5 transition-colors"
                    >
                      +{momentumCoins.length - 8} coin daha görmek için tıkla
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Momentum modal */}
            {momentumOpen && momentumCoins && (
              <MomentumModal
                coins={momentumCoins}
                countdown={countdown}
                onClose={() => setMomentumOpen(false)}
              />
            )}

            {/* Notifications widget */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
              <SectionHeader
                title="Son Bildirimler"
                sub={notifications?.unreadCount ? `${notifications.unreadCount} okunmamış` : undefined}
                icon={Bell}
                to="/notifications"
              />
              {!notifications?.items.length ? (
                <p className="text-xs text-slate-600 text-center py-6">Bildirim yok</p>
              ) : (
                <div className="space-y-2">
                  {notifications.items.slice(0, 5).map(n => (
                    <div key={n.id} className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                      !n.isRead ? 'bg-yellow-400/5 border-yellow-400/15' : 'bg-white/3 border-transparent'
                    )}>
                      {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">{n.title}</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System status */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
              <SectionHeader title="Sistem Durumu" icon={Shield} />
              <div className="space-y-3">
                {[
                  {
                    label: 'Binance Bağlantısı',
                    ok: isConnected,
                    val: isConnected ? (status?.isTestnet ? 'Testnet' : 'Mainnet') : 'Bağlantı Yok',
                  },
                  {
                    label: 'Aktif Strateji',
                    ok: activeStrategies > 0,
                    val: `${activeStrategies} strateji`,
                  },
                  {
                    label: 'Takip Edilen Coin',
                    ok: monitoredCoins > 0,
                    val: `${monitoredCoins} coin`,
                  },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', item.ok ? 'bg-emerald-400' : 'bg-red-400/60')} />
                      <span className="text-xs text-slate-400">{item.label}</span>
                    </div>
                    <span className={cn('text-xs font-medium', item.ok ? 'text-slate-300' : 'text-slate-600')}>
                      {item.val}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/5 text-[10px] text-slate-700 text-center">
                  Withdrawal yetkisi kesinlikle kullanılmaz
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
