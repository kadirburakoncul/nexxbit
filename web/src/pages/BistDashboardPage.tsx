import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { bistApi } from '@/api/bist'
import {
  Activity, BarChart3, Clock, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, CandlestickChart, RefreshCw, Flame,
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

function fmtPrice(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

export default function BistDashboardPage() {
  const navigate = useNavigate()

  const { data: strategies, isLoading: stLoading } = useQuery({
    queryKey: ['bist-strategies'],
    queryFn: bistApi.strategies,
    refetchInterval: 60_000,
  })

  const { data: signals } = useQuery({
    queryKey: ['bist-signals'],
    queryFn: () => bistApi.signals(20),
    refetchInterval: 60_000,
  })

  const { data: index } = useQuery({
    queryKey: ['bist-index'],
    queryFn: bistApi.index,
    refetchInterval: 60_000,
  })

  const { data: gainers, isLoading: gainersLoading, refetch: refetchGainers } = useQuery({
    queryKey: ['bist-top-gainers'],
    queryFn: () => bistApi.topGainers(20),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  })

  const activeStrategies = strategies?.filter(s => s.isActive) ?? []
  const totalTracked = activeStrategies.reduce((s, st) => s + st.stocks.length, 0)
  const openSignalsToday = signals?.filter(s => {
    const t = new Date(s.candleTime.endsWith('Z') ? s.candleTime : s.candleTime + 'Z')
    return t.toDateString() === new Date().toDateString()
  }).length ?? 0

  return (
    <>
      <Header title="BIST Pano" />
      <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-5xl">

        {/* Bilgi şeridi */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-500">
          <Clock size={13} />
          Veri ~15-20 dk gecikmeli &middot; sadece sinyal, otomatik işlem yok &middot; seans 10:00-18:10 TRT
        </div>

        {/* Stat kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">BIST 100</span>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <BarChart3 size={14} className="text-yellow-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100 font-mono">
              {index?.price != null ? fmtPrice(index.price) : '—'}
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Aktif Takip</span>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Activity size={14} className="text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100">
              {totalTracked} <span className="text-sm text-slate-500 font-normal">hisse</span>
            </p>
            <p className="text-xs text-slate-600 mt-1">{activeStrategies.length} aktif strateji</p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Bugünkü Sinyal</span>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <TrendingUp size={14} className="text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100">{openSignalsToday}</p>
          </div>
        </div>

        {/* ── Top Gainers ──────────────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={15} className="text-orange-400" />
              <p className="text-sm font-semibold text-slate-200">Günün En Çok Yükselen Hisseleri</p>
            </div>
            <button
              onClick={() => refetchGainers()}
              className="text-slate-600 hover:text-slate-300 transition-colors"
              title="Yenile"
            >
              <RefreshCw size={13} className={gainersLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {gainersLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
            </div>
          ) : !gainers || gainers.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">
              Veri alınamadı — seans dışı veya servis yanıt vermiyor olabilir
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {gainers.map((g, i) => (
                <div
                  key={g.symbol}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => navigate(`/bist/chart?symbol=${g.symbol}`)}
                >
                  <span className="text-xs text-slate-600 w-5 text-right shrink-0">{i + 1}</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp size={13} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{g.symbol}</p>
                    <p className="text-xs text-slate-600 truncate">{g.displayName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-slate-300">{fmtPrice(g.price)} ₺</p>
                    <p className={cn(
                      'text-xs font-semibold',
                      (g.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {fmtPct(g.changePercent)}
                    </p>
                  </div>
                  <CandlestickChart size={13} className="text-slate-700 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Strateji Takibi ──────────────────────────────────────────────────── */}
        {activeStrategies.length === 0 && !stLoading && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">Aktif BIST stratejisi yok.</p>
            <p className="text-slate-600 text-xs mt-1">Stratejiler sayfasından bir strateji oluşturup aktif edin.</p>
          </div>
        )}

        {activeStrategies.map(strategy => (
          <div key={strategy.id} className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Activity size={14} className="text-yellow-400" />
              <p className="text-sm font-semibold text-slate-200">{strategy.name}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500">{strategy.timeframe}</span>
              <span className="text-xs text-slate-600 ml-auto">{strategy.stocks.length} hisse</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                    <th className="text-left px-4 py-3">Hisse</th>
                    <th className="text-right px-4 py-3">Son Fiyat</th>
                    <th className="text-right px-4 py-3">T3 Yönü</th>
                    <th className="text-right px-4 py-3">Durum</th>
                    <th className="text-right px-4 py-3">Son Tarama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {strategy.stocks.map(s => {
                    const isBuy = s.lastCheckedReason?.includes('AL sinyali')
                    const isSell = s.lastCheckedReason?.includes('SAT sinyali')
                    return (
                      <tr
                        key={s.stockId}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => navigate(`/bist/chart?symbol=${s.symbol}&timeframe=${strategy.timeframe}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-200">{s.symbol}</p>
                          <p className="text-[11px] text-slate-600">{s.displayName}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{fmtPrice(s.lastPrice)}</td>
                        <td className="px-4 py-3 text-right">
                          {s.lastT3UpDirection != null ? (
                            <span className={cn('inline-flex items-center gap-1 text-xs', s.lastT3UpDirection ? 'text-emerald-400' : 'text-red-400')}>
                              {s.lastT3UpDirection ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {s.lastT3UpDirection ? 'Yükseliyor' : 'Düşüyor'}
                            </span>
                          ) : <span className="text-slate-700 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isBuy ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">AL</span>
                          ) : isSell ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold border bg-red-500/15 text-red-400 border-red-500/20">SAT</span>
                          ) : (
                            <span className="text-xs text-slate-600">İzleniyor</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600">{fmtTime(s.lastCheckedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* ── Son Sinyaller ─────────────────────────────────────────────────────── */}
        {signals && signals.length > 0 && (
          <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-sm font-semibold text-slate-200">Son Sinyaller</p>
            </div>
            <div className="divide-y divide-white/5">
              {signals.map(sig => {
                const isBuy = sig.direction === 'Buy'
                return (
                  <div key={sig.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      isBuy ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                      {isBuy
                        ? <TrendingUp size={13} className="text-emerald-400" />
                        : <TrendingDown size={13} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{sig.symbol}</p>
                      <p className="text-[11px] text-slate-600">{sig.strategyName} &middot; {sig.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono text-slate-300">{fmtPrice(sig.price)}</p>
                      <p className="text-[11px] text-slate-600">{fmtTime(sig.candleTime)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
