import { useQuery } from '@tanstack/react-query'
import { signalRecordsApi } from '@/api/signals'
import { pnlColor } from '@/lib/utils'
import Header from '@/components/layout/Header'
import { useState } from 'react'

function fmtUtc3(str: string | null | undefined): string {
  if (!str) return '—'
  const s = str.endsWith('Z') || str.includes('+') ? str : str + 'Z'
  return new Date(s).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

type Filter = 'all' | 'Open' | 'Closed'

export default function PositionsPage() {
  const [filter, setFilter] = useState<Filter>('all')

  const { data: allPositions, isLoading } = useQuery({
    queryKey: ['positions', 'real'],
    queryFn: () => signalRecordsApi.list({ isVirtual: false }),
    refetchInterval: 15_000,
  })

  const positions = filter === 'all'
    ? allPositions
    : allPositions?.filter(p => p.status === filter)

  return (
    <>
      <Header title="Pozisyonlar" />
      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          {(['all', 'Open', 'Closed'] as Filter[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-yellow-400/20 text-yellow-400'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {s === 'all' ? 'Tümü' : s === 'Open' ? 'Açık' : 'Kapalı'}
            </button>
          ))}
        </div>

        <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                <th className="text-left px-5 py-3">Sembol</th>
                <th className="text-left px-5 py-3">Durum</th>
                <th className="text-right px-5 py-3">Giriş</th>
                <th className="text-right px-5 py-3">Çıkış</th>
                <th className="text-right px-5 py-3">P&amp;L</th>
                <th className="text-right px-5 py-3">P&amp;L %</th>
                <th className="text-left px-5 py-3">Kapanma Sebebi</th>
                <th className="text-right px-5 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Yükleniyor…</td></tr>
              )}
              {!isLoading && (!positions || positions.length === 0) && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">Pozisyon bulunamadı</td></tr>
              )}
              {positions?.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-200">{p.coinSymbol}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.status === 'Open'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {p.status === 'Open' ? 'Açık' : 'Kapalı'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-slate-300 text-xs">
                    {p.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-slate-400 text-xs">
                    {p.closePrice != null
                      ? p.closePrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono text-xs ${pnlColor(p.realizedPnl)}`}>
                    {p.realizedPnl != null
                      ? `${p.realizedPnl >= 0 ? '+' : ''}${p.realizedPnl.toFixed(4)}`
                      : '—'}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono text-xs ${pnlColor(p.realizedPnlPct)}`}>
                    {p.realizedPnlPct != null
                      ? `${p.realizedPnlPct >= 0 ? '+' : ''}${p.realizedPnlPct.toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-left text-slate-600 text-xs">
                    {p.closeReason ?? <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500 text-xs">
                    {fmtUtc3(p.openedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
