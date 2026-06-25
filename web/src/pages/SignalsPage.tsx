import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { signalRecordsApi } from '@/api/signals'
import type { SignalRecord } from '@/api/signals'
import Header from '@/components/layout/Header'
import { TrendingUp, TrendingDown, RefreshCw, Activity, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

function useLivePrice(symbol: string): number | undefined {
  const { data } = useQuery({
    queryKey: ['live-price', symbol],
    queryFn: async () => {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`)
      const json = await res.json()
      return parseFloat(json.price)
    },
    refetchInterval: 5_000,
    staleTime: 4_000,
  })
  return data
}

function parseUtc(str: string): Date {
  const s = str.endsWith('Z') || str.includes('+') ? str : str + 'Z'
  return new Date(s)
}

function fmtDate(str: string | null | undefined): string {
  if (!str) return '—'
  return parseUtc(str).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

function useLiveAgo(str: string): string {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const diffSec = Math.max(0, Math.floor((Date.now() - parseUtc(str).getTime()) / 1000))
  if (diffSec < 60) return `${diffSec}sn`
  const m = Math.floor(diffSec / 60), s = diffSec % 60
  if (m < 60) return `${m}dk ${s}sn`
  return `${Math.floor(m / 60)}sa ${m % 60}dk`
}

export default function SignalsPage() {
  const qc = useQueryClient()

  // Sanal pozisyonlar: AL sinyali gelince açılır, SAT sinyali gelince kapanır
  const { data: records, isLoading } = useQuery({
    queryKey: ['virtual-positions'],
    queryFn: () => signalRecordsApi.list({ isVirtual: true }),
    refetchInterval: 10_000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['virtual-positions'] })

  const clearMut = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      await signalRecordsApi.bulkDelete(ids)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['virtual-positions'] }),
  })

  const open = records?.filter(r => r.status === 'Open') ?? []
  const closed = records?.filter(r => r.status === 'Closed') ?? []

  const closedWins = closed.filter(r => r.realizedPnlPct != null && r.realizedPnlPct > 0).length
  const closedLosses = closed.filter(r => r.realizedPnlPct != null && r.realizedPnlPct < 0).length
  const validClosed = closedWins + closedLosses
  const winRate = validClosed > 0 ? (closedWins / validClosed) * 100 : 0

  return (
    <>
      <Header title="Sinyaller" />
      <div className="p-6 space-y-5 max-w-6xl">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Açık Pozisyon"
            value={open.length.toString()}
            valueClass="text-yellow-400"
            icon={<Activity size={16} className="text-yellow-400" />}
            sub="AL sinyali verildi"
          />
          <StatCard
            label="Tamamlanan"
            value={closed.length.toString()}
            sub={`${closedWins} kazanç · ${closedLosses} kayıp`}
          />
          <StatCard
            label="Başarı Oranı"
            value={validClosed > 0 ? `${winRate.toFixed(1)}%` : '—'}
            valueClass={validClosed === 0 ? undefined : winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
            icon={validClosed > 0 ? (winRate >= 50 ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />) : undefined}
            sub={validClosed > 0 ? `${closedWins} kazanç · ${closedLosses} kayıp` : 'Henüz kapanan yok'}
          />
          <StatCard
            label="Toplam"
            value={(records?.length ?? 0).toString()}
            sub="AL + SAT çiftleri"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">
            AL sinyali geldiğinde giriş oluşur, SAT sinyalinde kapanır. Saat: UTC+3.
          </p>
          <div className="flex items-center gap-2">
            {open.length > 0 && (
              <button
                onClick={() => { if (confirm(`${open.length} açık pozisyon silinsin mi?`)) clearMut.mutate(open.map(r => r.id)) }}
                disabled={clearMut.isPending}
                className="flex items-center gap-1.5 text-xs text-yellow-500/70 hover:text-yellow-400 border border-yellow-500/20 hover:border-yellow-400/30 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> Açıkları Temizle
              </button>
            )}
            {closed.length > 0 && (
              <button
                onClick={() => { if (confirm(`${closed.length} kapanan sinyal silinsin mi?`)) clearMut.mutate(closed.map(r => r.id)) }}
                disabled={clearMut.isPending}
                className="flex items-center gap-1.5 text-xs text-slate-500/70 hover:text-slate-400 border border-slate-500/20 hover:border-slate-400/30 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> Kapananları Temizle
              </button>
            )}
            <button onClick={refresh} className="text-slate-500 hover:text-slate-300 p-1.5">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Açık pozisyonlar */}
        {open.length > 0 && (
          <Section title="Açık Pozisyonlar" count={open.length} accent="yellow">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Coin</th>
                  <th className="text-right px-4 py-3">Alış Fiyatı</th>
                  <th className="text-right px-4 py-3">Anlık Fiyat</th>
                  <th className="text-right px-4 py-3">Gerç. K/Z</th>
                  <th className="text-right px-4 py-3">Alış Tarihi</th>
                  <th className="text-right px-4 py-3">Ne Zaman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {open.map(r => <OpenRow key={r.id} record={r} />)}
              </tbody>
            </table>
          </Section>
        )}

        {/* Kapalı pozisyonlar */}
        {isLoading && <p className="text-slate-500 text-sm px-1">Yükleniyor…</p>}

        {!isLoading && records?.length === 0 && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-10 text-center">
            <p className="text-slate-500 text-sm">Henüz sinyal yok.</p>
            <p className="text-slate-600 text-xs mt-1">Strateji aktive edildikten sonra AL sinyali geldiğinde burada görünür.</p>
          </div>
        )}

        {closed.length > 0 && (
          <Section title="Kapanan Pozisyonlar" count={closed.length} accent="slate">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Coin</th>
                  <th className="text-right px-4 py-3">Alış</th>
                  <th className="text-right px-4 py-3">Satış</th>
                  <th className="text-right px-4 py-3">K/Z %</th>
                  <th className="text-left px-4 py-3">Sebep</th>
                  <th className="text-right px-4 py-3">Alış Tarihi</th>
                  <th className="text-right px-4 py-3">Satış Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {closed.map(r => <ClosedRow key={r.id} record={r} />)}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, count, accent, children }: {
  title: string; count: number; accent: 'yellow' | 'slate'; children: React.ReactNode
}) {
  const accentCls = accent === 'yellow'
    ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    : 'text-slate-400 bg-white/5 border-white/10'
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
        <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', accentCls)}>{count}</span>
      </div>
      <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, valueClass, icon }: {
  label: string; value: string; sub?: string; valueClass?: string; icon?: React.ReactNode
}) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        {icon}
        <p className={cn('text-xl font-bold text-slate-100', valueClass)}>{value}</p>
      </div>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}

// ─── OpenRow ──────────────────────────────────────────────────────────────────
function OpenRow({ record }: { record: SignalRecord }) {
  const liveAgo = useLiveAgo(record.openedAt)
  const livePrice = useLivePrice(record.coinSymbol)

  const pnlPct = livePrice != null
    ? ((livePrice - record.entryPrice) / record.entryPrice) * 100
    : null
  const pnlClass = pnlPct == null
    ? 'text-slate-600'
    : pnlPct > 0 ? 'text-emerald-400' : pnlPct < 0 ? 'text-red-400' : 'text-slate-400'

  return (
    <tr className="hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{record.coinSymbol}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 flex items-center gap-1">
            <Clock size={10} /> Açık
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">
        {record.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {livePrice != null
          ? <span className="text-slate-100 font-semibold">{livePrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}</span>
          : <span className="text-slate-700">—</span>}
      </td>
      <td className={cn('px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums', pnlClass)}>
        {pnlPct != null
          ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%`
          : '—'}
      </td>
      <td className="px-4 py-3 text-right text-slate-500 text-xs">
        {fmtDate(record.openedAt)}
      </td>
      <td className="px-4 py-3 text-right text-xs">
        <span className="font-mono text-yellow-400 font-semibold tabular-nums">{liveAgo}</span>
        <span className="text-slate-600 ml-1">önce</span>
      </td>
    </tr>
  )
}

// ─── ClosedRow ────────────────────────────────────────────────────────────────
function ClosedRow({ record }: { record: SignalRecord }) {
  const pnlPct = record.realizedPnlPct
  const isWin = (pnlPct ?? 0) > 0
  const isLoss = (pnlPct ?? 0) < 0
  const pnlClass = isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-slate-500'

  return (
    <tr className="hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 font-semibold text-slate-200">{record.coinSymbol}</td>
      <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">
        {record.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}
      </td>
      <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">
        {record.closePrice != null
          ? record.closePrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })
          : <span className="text-slate-700">—</span>}
      </td>
      <td className={cn('px-4 py-3 text-right font-mono text-sm font-semibold', pnlClass)}>
        {pnlPct != null
          ? `${isWin ? '+' : ''}${pnlPct.toFixed(2)}%`
          : <span className="text-slate-700">—</span>}
      </td>
      <td className="px-4 py-3 text-left text-slate-600 text-xs max-w-36 truncate">
        {record.closeReason ?? '—'}
      </td>
      <td className="px-4 py-3 text-right text-slate-600 text-xs">
        {fmtDate(record.openedAt)}
      </td>
      <td className="px-4 py-3 text-right text-slate-500 text-xs">
        {fmtDate(record.closedAt)}
      </td>
    </tr>
  )
}
