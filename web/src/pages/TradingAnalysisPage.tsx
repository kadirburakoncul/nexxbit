import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { signalRecordsApi, type SignalRecord } from '@/api/signals'
import Header from '@/components/layout/Header'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity, Clock, BarChart2, Target, AlertTriangle, CheckCircle2, CalendarRange, X } from 'lucide-react'

const RANGES = [
  { label: '24s', hours: 24 },
  { label: '7g', hours: 168 },
  { label: '30g', hours: 720 },
  { label: 'Tümü', hours: 0 },
]

function toLocalDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function holdBucket(openedAt: string, closedAt: string) {
  const mins = (new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000
  if (mins < 5)   return '0–5dk'
  if (mins < 15)  return '5–15dk'
  if (mins < 30)  return '15–30dk'
  if (mins < 60)  return '30–60dk'
  if (mins < 180) return '1–3sa'
  return '3sa+'
}

const HOLD_ORDER = ['0–5dk', '5–15dk', '15–30dk', '30–60dk', '1–3sa', '3sa+']

function fmtPct(v: number | null | undefined, decimals = 2) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`
}
function fmtUsdt(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`
}

interface GroupStat {
  count: number
  wins: number
  avgPct: number
  totalUsdt: number | null
}

function groupStats(rows: SignalRecord[]): GroupStat {
  const withPct = rows.filter(r => r.realizedPnlPct != null)
  const avgPct = withPct.length ? withPct.reduce((s, r) => s + r.realizedPnlPct!, 0) / withPct.length : 0
  const withUsdt = rows.filter(r => r.realizedPnl != null)
  const totalUsdt = withUsdt.length ? withUsdt.reduce((s, r) => s + r.realizedPnl!, 0) : null
  return {
    count: rows.length,
    wins: rows.filter(r => (r.realizedPnlPct ?? 0) > 0).length,
    avgPct,
    totalUsdt,
  }
}

export default function TradingAnalysisPage() {
  const [rangeIdx, setRangeIdx] = useState(0)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')
  const isCustom = customFrom !== '' || customTo !== ''

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['analysis-positions'],
    queryFn: () => signalRecordsApi.list({ pageSize: 1000 }),
    staleTime: 60_000,
  })

  const closed = useMemo(() => {
    const base = all.filter(r => r.status === 'Closed' && r.isVirtual && r.closedAt)

    if (isCustom) {
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : null
      const to   = customTo   ? new Date(customTo   + 'T23:59:59') : null
      return base.filter(r => {
        const d = new Date(r.closedAt!)
        if (from && d < from) return false
        if (to   && d > to)   return false
        return true
      })
    }

    const hrs = RANGES[rangeIdx].hours
    if (!hrs) return base
    const cutoff = new Date(Date.now() - hrs * 3600 * 1000)
    return base.filter(r => new Date(r.closedAt!) >= cutoff)
  }, [all, rangeIdx, isCustom, customFrom, customTo])

  const clearCustom = () => { setCustomFrom(''); setCustomTo('') }

  const summary = useMemo(() => {
    const withPct = closed.filter(r => r.realizedPnlPct != null)
    const wins = closed.filter(r => (r.realizedPnlPct ?? 0) > 0)
    const losses = closed.filter(r => (r.realizedPnlPct ?? 0) <= 0)
    const avgPct = withPct.length ? withPct.reduce((s, r) => s + r.realizedPnlPct!, 0) / withPct.length : 0
    const withUsdt = closed.filter(r => r.realizedPnl != null)
    const netUsdt = withUsdt.reduce((s, r) => s + r.realizedPnl!, 0)
    const avgWin = wins.filter(r => r.realizedPnlPct != null).reduce((s, r) => s + r.realizedPnlPct!, 0) / (wins.filter(r => r.realizedPnlPct != null).length || 1)
    const avgLoss = losses.filter(r => r.realizedPnlPct != null).reduce((s, r) => s + r.realizedPnlPct!, 0) / (losses.filter(r => r.realizedPnlPct != null).length || 1)
    return { total: closed.length, wins: wins.length, losses: losses.length, avgPct, netUsdt, avgWin, avgLoss }
  }, [closed])

  const byReason = useMemo(() => {
    const map = new Map<string, SignalRecord[]>()
    closed.forEach(r => {
      const key = r.closeReason ?? 'Diğer'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return Array.from(map.entries())
      .map(([reason, rows]) => ({ reason, ...groupStats(rows) }))
      .sort((a, b) => b.count - a.count)
  }, [closed])

  const byHold = useMemo(() => {
    const map = new Map<string, SignalRecord[]>()
    HOLD_ORDER.forEach(k => map.set(k, []))
    closed.forEach(r => {
      if (!r.closedAt) return
      const k = holdBucket(r.openedAt, r.closedAt)
      map.get(k)!.push(r)
    })
    return HOLD_ORDER.map(k => ({ bucket: k, ...groupStats(map.get(k)!) }))
  }, [closed])

  const sorted = useMemo(() =>
    [...closed]
      .filter(r => r.realizedPnlPct != null)
      .sort((a, b) => b.realizedPnlPct! - a.realizedPnlPct!),
    [closed])

  const maxAbs = useMemo(() =>
    Math.max(...sorted.map(r => Math.abs(r.realizedPnlPct ?? 0)), 0.01),
    [sorted])

  const recent = useMemo(() =>
    [...closed].sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime()).slice(0, 50),
    [closed])

  const fmtDate = (s: string) => new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const reasonColor = (r: string) => {
    if (r === 'TrailingStop') return 'text-yellow-400'
    if (r.includes('StopLoss') || r.includes('stop') || r.toLowerCase().includes('stop')) return 'text-red-400'
    if (r.includes('SAT') || r.includes('Sat')) return 'text-blue-400'
    return 'text-slate-400'
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f]">
      <Header title="Trader Analizi" />
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

        {/* Range selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Dönem:</span>
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => { setRangeIdx(i); clearCustom() }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                !isCustom && rangeIdx === i
                  ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30'
                  : 'text-slate-400 hover:text-slate-200 bg-white/5 border border-white/5'
              )}
            >
              {r.label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Custom date range */}
          <div className="flex items-center gap-1.5">
            <CalendarRange size={13} className={cn(isCustom ? 'text-yellow-400' : 'text-slate-600')} />
            <input
              type="date"
              value={customFrom}
              max={customTo || toLocalDateStr(new Date())}
              onChange={e => setCustomFrom(e.target.value)}
              className={cn(
                'bg-white/5 border rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-yellow-400/50 transition-colors',
                isCustom ? 'border-yellow-400/30' : 'border-white/10'
              )}
              style={{ colorScheme: 'dark' }}
            />
            <span className="text-xs text-slate-600">–</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={toLocalDateStr(new Date())}
              onChange={e => setCustomTo(e.target.value)}
              className={cn(
                'bg-white/5 border rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-yellow-400/50 transition-colors',
                isCustom ? 'border-yellow-400/30' : 'border-white/10'
              )}
              style={{ colorScheme: 'dark' }}
            />
            {isCustom && (
              <button
                onClick={clearCustom}
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <span className="ml-auto text-xs text-slate-600">{summary.total} kapalı işlem</span>
        </div>

        {isLoading && (
          <div className="text-center py-20 text-slate-500 text-sm">Yükleniyor...</div>
        )}

        {!isLoading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'Kazanma Oranı',
                  value: summary.total ? `%${((summary.wins / summary.total) * 100).toFixed(1)}` : '—',
                  sub: `${summary.wins}K / ${summary.losses}K`,
                  icon: Target,
                  color: summary.wins >= summary.losses ? 'text-emerald-400' : 'text-red-400',
                },
                {
                  label: 'Ort. Getiri',
                  value: fmtPct(summary.avgPct),
                  sub: `Kazanç: ${fmtPct(summary.avgWin)} · Kayıp: ${fmtPct(summary.avgLoss)}`,
                  icon: Activity,
                  color: summary.avgPct >= 0 ? 'text-emerald-400' : 'text-red-400',
                },
                {
                  label: 'Net P&L',
                  value: fmtUsdt(summary.netUsdt),
                  sub: `${summary.total} işlem toplamı`,
                  icon: summary.netUsdt >= 0 ? TrendingUp : TrendingDown,
                  color: summary.netUsdt >= 0 ? 'text-emerald-400' : 'text-red-400',
                },
                {
                  label: 'Profit Factor',
                  value: summary.avgLoss !== 0 ? Math.abs(summary.avgWin / summary.avgLoss).toFixed(2) : '—',
                  sub: 'Ort.Kazanç / Ort.Kayıp',
                  icon: BarChart2,
                  color: Math.abs(summary.avgWin) > Math.abs(summary.avgLoss) ? 'text-emerald-400' : 'text-red-400',
                },
              ].map(card => (
                <div key={card.label} className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">{card.label}</span>
                    <card.icon size={14} className="text-slate-600" />
                  </div>
                  <p className={cn('text-xl font-semibold', card.color)}>{card.value}</p>
                  <p className="text-xs text-slate-600 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* By close reason */}
              <div className="bg-white/5 rounded-xl border border-white/5 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <span className="text-sm font-medium text-slate-200">Kapanış Nedenine Göre</span>
                </div>
                {byReason.length === 0 && <p className="text-xs text-slate-600 text-center py-4">Veri yok</p>}
                <div className="space-y-3">
                  {byReason.map(row => (
                    <div key={row.reason} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={cn('font-medium', reasonColor(row.reason))}>{row.reason}</span>
                        <div className="flex items-center gap-3 text-slate-400">
                          <span>{row.count} işlem</span>
                          <span className={row.avgPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            ort. {fmtPct(row.avgPct)}
                          </span>
                          {row.totalUsdt != null && (
                            <span className={row.totalUsdt >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {fmtUsdt(row.totalUsdt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {/* win bar */}
                        <div
                          className="h-1.5 rounded-full bg-emerald-500/70"
                          style={{ flex: row.wins }}
                        />
                        {/* loss bar */}
                        {(row.count - row.wins) > 0 && (
                          <div
                            className="h-1.5 rounded-full bg-red-500/70"
                            style={{ flex: row.count - row.wins }}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600">
                        {row.wins} kazanan · {row.count - row.wins} kaybeden
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* By hold time */}
              <div className="bg-white/5 rounded-xl border border-white/5 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={14} className="text-blue-400" />
                  <span className="text-sm font-medium text-slate-200">Tutma Süresine Göre</span>
                </div>
                <div className="space-y-2.5">
                  {byHold.map(row => {
                    if (row.count === 0) return null
                    return (
                      <div key={row.bucket} className="flex items-center gap-3 text-xs">
                        <span className="w-16 text-slate-400 shrink-0">{row.bucket}</span>
                        <div className="flex-1 bg-white/5 rounded-full h-5 relative overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', row.avgPct >= 0 ? 'bg-emerald-500/30' : 'bg-red-500/30')}
                            style={{ width: `${Math.min(100, (row.count / (summary.total || 1)) * 100 * 3)}%` }}
                          />
                          <span className={cn('absolute inset-0 flex items-center px-2 text-[10px] font-medium',
                            row.avgPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {fmtPct(row.avgPct)} · {row.count} işlem
                          </span>
                        </div>
                        <span className="w-8 text-right text-slate-600 text-[10px]">
                          {row.count > 0 ? `%${((row.wins / row.count) * 100).toFixed(0)}K` : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* P&L bar chart */}
            {sorted.length > 0 && (
              <div className="bg-white/5 rounded-xl border border-white/5 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={14} className="text-yellow-400" />
                  <span className="text-sm font-medium text-slate-200">İşlem P&L Dağılımı</span>
                  <span className="text-xs text-slate-600 ml-auto">en iyi → en kötü</span>
                </div>
                <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
                  {sorted.map(r => {
                    const pct = r.realizedPnlPct ?? 0
                    const barH = Math.max(4, (Math.abs(pct) / maxAbs) * 112)
                    const isPos = pct >= 0
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col items-center gap-0.5 group cursor-default"
                        style={{ minWidth: Math.max(8, Math.min(24, 600 / sorted.length)) }}
                        title={`${r.coinSymbol}: ${fmtPct(pct)}`}
                      >
                        {isPos ? (
                          <>
                            <div className="flex-1 flex items-end w-full">
                              <div
                                className="w-full rounded-t bg-emerald-500/70 group-hover:bg-emerald-400 transition-colors"
                                style={{ height: barH }}
                              />
                            </div>
                            <div className="h-[1px] w-full bg-white/10" />
                          </>
                        ) : (
                          <>
                            <div className="flex-1 flex items-start justify-center w-full">
                              <div className="h-[1px] w-full bg-white/10" />
                            </div>
                            <div
                              className="w-full rounded-b bg-red-500/70 group-hover:bg-red-400 transition-colors"
                              style={{ height: barH }}
                            />
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-600">
                  <span>En iyi: {fmtPct(sorted[0]?.realizedPnlPct)} ({sorted[0]?.coinSymbol})</span>
                  <span>En kötü: {fmtPct(sorted[sorted.length - 1]?.realizedPnlPct)} ({sorted[sorted.length - 1]?.coinSymbol})</span>
                </div>
              </div>
            )}

            {/* Best & worst */}
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: 'En İyi 5 İşlem', icon: CheckCircle2, iconCls: 'text-emerald-400', rows: sorted.slice(0, 5) },
                { title: 'En Kötü 5 İşlem', icon: AlertTriangle, iconCls: 'text-red-400', rows: sorted.slice(-5).reverse() },
              ].map(section => (
                <div key={section.title} className="bg-white/5 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <section.icon size={14} className={section.iconCls} />
                    <span className="text-sm font-medium text-slate-200">{section.title}</span>
                  </div>
                  <div className="space-y-1">
                    {section.rows.map(r => (
                      <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0 text-xs">
                        <span className="font-medium text-slate-200 w-24 truncate">{r.coinSymbol}</span>
                        <span className={cn('font-semibold', (r.realizedPnlPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {fmtPct(r.realizedPnlPct)}
                        </span>
                        <span className="text-slate-600 flex-1 truncate">{r.closeReason}</span>
                        <span className="text-slate-600">{r.closedAt ? fmtDate(r.closedAt) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent trades table */}
            <div className="bg-white/5 rounded-xl border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-200">Son İşlemler</span>
                <span className="text-xs text-slate-600 ml-auto">{recent.length} kayıt</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-white/5">
                      <th className="text-left py-2 font-medium">Coin</th>
                      <th className="text-right py-2 font-medium">Giriş</th>
                      <th className="text-right py-2 font-medium">Çıkış</th>
                      <th className="text-right py-2 font-medium">P&L %</th>
                      <th className="text-right py-2 font-medium">P&L $</th>
                      <th className="text-right py-2 font-medium">En Yüksek</th>
                      <th className="text-left py-2 font-medium px-2">Neden</th>
                      <th className="text-right py-2 font-medium">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(r => {
                      const pct = r.realizedPnlPct ?? 0
                      const isPos = pct >= 0
                      return (
                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 font-medium text-slate-200">{r.coinSymbol}</td>
                          <td className="py-2 text-right text-slate-400">
                            {r.entryPrice?.toFixed(r.entryPrice > 1 ? 4 : 6)}
                          </td>
                          <td className="py-2 text-right text-slate-400">
                            {r.closePrice?.toFixed((r.closePrice ?? 0) > 1 ? 4 : 6) ?? '—'}
                          </td>
                          <td className={cn('py-2 text-right font-medium', isPos ? 'text-emerald-400' : 'text-red-400')}>
                            {fmtPct(r.realizedPnlPct)}
                          </td>
                          <td className={cn('py-2 text-right', isPos ? 'text-emerald-400' : 'text-red-400')}>
                            {r.realizedPnl != null ? fmtUsdt(r.realizedPnl) : '—'}
                          </td>
                          <td className="py-2 text-right text-yellow-400/70">
                            {r.peakPnlPct != null ? fmtPct(r.peakPnlPct) : '—'}
                          </td>
                          <td className="py-2 px-2">
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', reasonColor(r.closeReason ?? ''))}>
                              {r.closeReason ?? '—'}
                            </span>
                          </td>
                          <td className="py-2 text-right text-slate-600">
                            {r.closedAt ? fmtDate(r.closedAt) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                    {recent.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-600">
                          Bu dönem için kapalı işlem bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
