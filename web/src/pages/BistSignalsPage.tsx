import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { bistApi } from '@/api/bist'
import type { BistSignal } from '@/api/bist'
import {
  ArrowUpRight, ArrowDownRight, RefreshCw, Activity,
  TrendingUp, TrendingDown, Trash2, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface VirtualPosition {
  buyId: string
  sellId?: string
  symbol: string
  displayName: string
  strategyName: string
  entryPrice: number
  exitPrice?: number
  entryDate: string
  exitDate?: string
  pnlPct?: number
  isOpen: boolean
}

// ── Signal pairing ────────────────────────────────────────────────────────────
function pairSignals(signals: BistSignal[]): VirtualPosition[] {
  const sorted = [...signals].sort(
    (a, b) => new Date(a.candleTime).getTime() - new Date(b.candleTime).getTime()
  )

  const positions: VirtualPosition[] = []
  const openMap = new Map<string, BistSignal>()

  for (const sig of sorted) {
    const key = `${sig.strategyName}::${sig.symbol}`
    if (sig.direction === 'Buy') {
      openMap.set(key, sig)
    } else if (sig.direction === 'Sell') {
      const buy = openMap.get(key)
      if (buy) {
        const pnlPct = ((sig.price - buy.price) / buy.price) * 100
        positions.push({
          buyId: buy.id,
          sellId: sig.id,
          symbol: sig.symbol,
          displayName: sig.displayName,
          strategyName: sig.strategyName,
          entryPrice: buy.price,
          exitPrice: sig.price,
          entryDate: buy.candleTime,
          exitDate: sig.candleTime,
          pnlPct,
          isOpen: false,
        })
        openMap.delete(key)
      }
    }
  }

  for (const [, buy] of openMap) {
    positions.push({
      buyId: buy.id,
      symbol: buy.symbol,
      displayName: buy.displayName,
      strategyName: buy.strategyName,
      entryPrice: buy.price,
      entryDate: buy.candleTime,
      isOpen: true,
    })
  }

  return positions
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtTime(s: string) {
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

function fmtPrice(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
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

// ── Open Position Row ────────────────────────────────────────────────────────
function OpenPositionRow({ pos, onDelete }: { pos: VirtualPosition; onDelete: () => void }) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-100">{pos.symbol}</p>
        <p className="text-xs text-slate-500 truncate max-w-[120px]">{pos.displayName}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{pos.strategyName}</td>
      <td className="px-4 py-3 text-right font-mono text-emerald-300">{fmtPrice(pos.entryPrice)} ₺</td>
      <td className="px-4 py-3 text-right font-mono text-slate-400">—</td>
      <td className="px-4 py-3 text-right text-slate-400">—</td>
      <td className="px-4 py-3 text-right text-xs text-slate-500">{fmtTime(pos.entryDate)}</td>
      <td className="px-4 py-3 text-right text-slate-400">—</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onDelete}
          title="Sinyali sil"
          className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// ── Closed Position Row ──────────────────────────────────────────────────────
function ClosedPositionRow({ pos, onDelete }: { pos: VirtualPosition; onDelete: () => void }) {
  const pnl = pos.pnlPct ?? 0
  const isWin = pnl >= 0

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-100">{pos.symbol}</p>
        <p className="text-xs text-slate-500 truncate max-w-[120px]">{pos.displayName}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{pos.strategyName}</td>
      <td className="px-4 py-3 text-right font-mono text-slate-300">{fmtPrice(pos.entryPrice)} ₺</td>
      <td className="px-4 py-3 text-right font-mono text-slate-300">{pos.exitPrice != null ? `${fmtPrice(pos.exitPrice)} ₺` : '—'}</td>
      <td className="px-4 py-3 text-right">
        <span className={cn(
          'inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full',
          isWin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        )}>
          {isWin ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {isWin ? '+' : ''}{pnl.toFixed(2)}%
        </span>
      </td>
      <td className="px-4 py-3 text-right text-xs text-slate-500">{fmtTime(pos.entryDate)}</td>
      <td className="px-4 py-3 text-right text-xs text-slate-500">{pos.exitDate ? fmtTime(pos.exitDate) : '—'}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onDelete}
          title="Pozisyonu sil"
          className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// ── Table Wrapper ─────────────────────────────────────────────────────────────
function PositionTable({ children, headers }: { children: React.ReactNode; headers: string[] }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl overflow-x-auto">
      <div className="min-w-[700px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
              {headers.map(h => (
                <th key={h} className={cn('px-4 py-3', h === 'Hisse' || h === 'Strateji' ? 'text-left' : 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', color)}>{count}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BistSignalsPage() {
  const qc = useQueryClient()

  const { data: signals, isLoading, isFetching } = useQuery({
    queryKey: ['bist-signals'],
    queryFn: () => bistApi.signals(500),
    refetchInterval: 60_000,
  })

  const deleteMut = useMutation({
    mutationFn: bistApi.deleteSignal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bist-signals'] }),
  })

  const positions = useMemo(() => pairSignals(signals ?? []), [signals])

  const openPositions = useMemo(
    () => [...positions.filter(p => p.isOpen)].reverse(),
    [positions]
  )
  const closedPositions = useMemo(
    () => positions.filter(p => !p.isOpen).sort(
      (a, b) => new Date(b.exitDate!).getTime() - new Date(a.exitDate!).getTime()
    ),
    [positions]
  )

  const totalPnl = closedPositions.reduce((s, p) => s + (p.pnlPct ?? 0), 0)
  const winCount = closedPositions.filter(p => (p.pnlPct ?? 0) >= 0).length
  const todayCount = (signals ?? []).filter(s => {
    const t = new Date(s.candleTime.endsWith('Z') ? s.candleTime : s.candleTime + 'Z')
    return t.toDateString() === new Date().toDateString()
  }).length

  const refresh = () => qc.invalidateQueries({ queryKey: ['bist-signals'] })

  return (
    <>
      <Header title="BIST Sinyaller" />
      <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-6xl">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="Açık Pozisyon"
            value={openPositions.length.toString()}
            icon={<Activity size={16} className="text-yellow-400" />}
            sub="Bekleyen sinyal"
          />
          <StatCard
            label="Kapanan Pozisyon"
            value={closedPositions.length.toString()}
            icon={<Clock size={16} className="text-slate-400" />}
            sub={`${winCount} kazanç / ${closedPositions.length - winCount} zarar`}
          />
          <StatCard
            label="Ort. K/Z"
            value={closedPositions.length > 0 ? `${(totalPnl / closedPositions.length).toFixed(2)}%` : '—'}
            valueClass={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
            icon={totalPnl >= 0 ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />}
            sub="Ortalama pozisyon K/Z"
          />
          <StatCard
            label="Bugünkü Sinyal"
            value={todayCount.toString()}
            valueClass="text-yellow-400"
            sub="Bugün üretilen sinyal"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Yahoo Finance (~15-20dk gecikmeli) · T3 göstergesiyle üretilir · UTC+3
          </p>
          <button
            onClick={refresh}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 p-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {isLoading && <p className="text-slate-500 text-sm px-1">Yükleniyor…</p>}

        {!isLoading && positions.length === 0 && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-10 text-center">
            <p className="text-slate-500 text-sm">Henüz sinyal yok.</p>
            <p className="text-slate-600 text-xs mt-1">Aktif strateji eklendiğinde burada görünecek.</p>
          </div>
        )}

        {/* Açık Pozisyonlar */}
        {openPositions.length > 0 && (
          <div>
            <SectionHeader
              title="Açık Pozisyonlar"
              count={openPositions.length}
              color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            />
            <PositionTable headers={['Hisse', 'Strateji', 'Giriş Fiyatı', 'Çıkış Fiyatı', 'K/Z %', 'Alış Tarihi', 'Satış Tarihi', '']}>
              {openPositions.map(pos => (
                <OpenPositionRow
                  key={pos.buyId}
                  pos={pos}
                  onDelete={() => {
                    if (confirm(`${pos.symbol} sinyalini kalıcı olarak sil?`))
                      deleteMut.mutate(pos.buyId)
                  }}
                />
              ))}
            </PositionTable>
          </div>
        )}

        {/* Kapanan Pozisyonlar */}
        {closedPositions.length > 0 && (
          <div>
            <SectionHeader
              title="Kapanan Pozisyonlar"
              count={closedPositions.length}
              color="text-slate-400 bg-white/5 border-white/10"
            />
            <PositionTable headers={['Hisse', 'Strateji', 'Giriş Fiyatı', 'Çıkış Fiyatı', 'K/Z %', 'Alış Tarihi', 'Satış Tarihi', '']}>
              {closedPositions.map(pos => (
                <ClosedPositionRow
                  key={pos.buyId}
                  pos={pos}
                  onDelete={() => {
                    if (confirm(`${pos.symbol} pozisyonunu kalıcı olarak sil? (AL ve SAT sinyalleri silinir)`)) {
                      deleteMut.mutate(pos.buyId)
                      if (pos.sellId) deleteMut.mutate(pos.sellId)
                    }
                  }}
                />
              ))}
            </PositionTable>
          </div>
        )}
      </div>
    </>
  )
}
