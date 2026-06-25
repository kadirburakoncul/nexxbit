import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { binanceApi } from '@/api/binance'
import { signalRecordsApi } from '@/api/signals'
import { strategiesApi } from '@/api/strategies'
import { notificationsApi } from '@/api/notifications'
import { formatUsdt, pnlColor, cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Wifi, WifiOff, Activity, RefreshCw,
  AlertCircle, ArrowUpRight, ArrowDownRight, Bell, Radar,
  BarChart3, Zap, ChevronRight, DollarSign, Target, Shield
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
      'relative bg-white/5 border rounded-2xl p-5 overflow-hidden',
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
        <p className={cn('text-2xl font-bold tracking-tight', color)}>{value}</p>
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
function SectionHeader({ title, sub, icon: Icon, to }: {
  title: string; sub?: string; icon: React.ElementType; to?: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {sub && <span className="text-xs text-slate-600">{sub}</span>}
      </div>
      {to && (
        <Link to={to} className="flex items-center gap-1 text-xs text-slate-600 hover:text-yellow-400 transition-colors">
          Tümü <ChevronRight size={12} />
        </Link>
      )}
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const qc = useQueryClient()

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
    queryFn: () => signalRecordsApi.list({ pageSize: 100 }),
    refetchInterval: 15_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['signal-stats'],
    queryFn: signalRecordsApi.stats,
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

  const open = positions?.filter(p => p.status === 'Open') ?? []
  const closed = positions?.filter(p => p.status === 'Closed') ?? []
  const recentClosed = closed.slice(0, 5)

  const usdt = balances?.find(b => b.asset === 'USDT')
  const usdtFree = usdt?.free ?? 0
  const usdtLocked = usdt?.locked ?? 0
  const assetCount = balances?.filter(b => b.free + b.locked > 0).length ?? 0

  const totalPnl = stats?.totalPnlUsdt ?? 0
  const winRate = (stats?.closed ?? 0) > 0 ? ((stats!.wins / stats!.closed) * 100) : 0

  // Active strategies + monitored coins
  const activeStrategies = monitor?.length ?? 0
  const monitoredCoins = monitor?.reduce((s, st) => s + st.coins.length, 0) ?? 0
  const openMonitorPositions = monitor?.reduce((s, st) => s + st.coins.filter(c => c.hasOpenPosition).length, 0) ?? 0

  const isConnected = status?.isConnected ?? false

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6 max-w-[1400px]">

        {/* ── Hero: top metrics row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
            value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT`}
            sub={stats ? `${stats.closed} kapanan işlem` : undefined}
            icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
            color={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
            accent={totalPnl >= 0 ? 'border-emerald-500/10' : 'border-red-500/10'}
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

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

            {/* Performance summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Win/Loss ring */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <SectionHeader title="Performans" sub={winRate > 0 ? `${winRate.toFixed(1)}% başarı` : undefined} icon={Target} to="/signals" />
                <WinRateRing wins={stats?.wins ?? 0} losses={stats?.losses ?? 0} total={stats?.closed ?? 0} />
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
              <SectionHeader title="Son Kapanan İşlemler" sub={`${closed.length} toplam`} icon={DollarSign} to="/signals" />
              {recentClosed.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-6">Henüz kapanan işlem yok</p>
              ) : (
                <div className="space-y-0 -mx-1">
                  {recentClosed.map((p, i) => {
                    const pnl = p.realizedPnl
                    const pnlPct = p.realizedPnlPct
                    const pos = pnl !== null && pnl >= 0
                    return (
                      <div key={p.id} className={cn(
                        'flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5',
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
                          <p className="text-xs text-slate-600">
                            {format(new Date(p.openedAt), 'dd MMM', { locale: tr })}
                            {p.closedAt && ` → ${format(new Date(p.closedAt), 'dd MMM', { locale: tr })}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <PnlBadge value={pnl} size="sm" />
                          {pnlPct != null && (
                            <p className={cn('text-[10px] mt-0.5', pnlColor(pnlPct))}>
                              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 text-[10px] text-slate-700 font-mono w-20 hidden md:block">
                          <p>{p.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}</p>
                          {p.closePrice && <p>{p.closePrice.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}</p>}
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
