import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi, type AnalyticsData, type CoinPerformance, type TopTrade, type ExitReasonStat } from '../api/analytics'

// ───────── helpers ─────────
const fmt = (n: number, d = 2) => n.toFixed(d)
const fmtUsdt = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n, 2)} $`
const pct = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n, 2)}%`

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4 flex flex-col gap-1">
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

// ───────── mini bar chart ─────────
function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => Math.abs(d.value)), 0.01)
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-24 text-xs text-gray-400 truncate text-right">{d.label}</div>
          <div className="flex-1 flex items-center gap-1">
            {d.value >= 0 ? (
              <>
                <div className="w-1/2 flex justify-end">
                  <div className="h-5 rounded-l" style={{ width: `${(d.value / max) * 50}%`, backgroundColor: d.color }} />
                </div>
                <div className="w-1/2" />
              </>
            ) : (
              <>
                <div className="w-1/2" />
                <div className="flex items-center">
                  <div className="h-5 rounded-r" style={{ width: `${(Math.abs(d.value) / max) * 50}%`, backgroundColor: d.color }} />
                </div>
              </>
            )}
          </div>
          <div className={`text-xs tabular-nums w-20 ${d.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtUsdt(d.value)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ───────── sparkline (daily P&L) ─────────
function Sparkline({ data }: { data: { date: string; cumulativePnl: number }[] }) {
  if (data.length < 2) return <div className="text-gray-500 text-sm">Yeterli veri yok</div>

  const values = data.map(d => d.cumulativePnl)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 600, H = 120, pad = 8

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - 2 * pad)
    const y = H - pad - ((d.cumulativePnl - min) / range) * (H - 2 * pad)
    return `${x},${y}`
  })

  const zeroY = H - pad - ((0 - min) / range) * (H - 2 * pad)
  const lastVal = values[values.length - 1]
  const color = lastVal >= 0 ? '#10b981' : '#ef4444'

  return (
    <div className="overflow-hidden rounded-lg bg-[#111827] p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        {/* zero line */}
        {min < 0 && max > 0 && (
          <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />
        )}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* area fill */}
        <polygon
          points={`${pad},${H - pad} ${points.join(' ')} ${W - pad},${H - pad}`}
          fill={color}
          opacity="0.1"
        />
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  )
}

// ───────── Trade row ─────────
function TradeRow({ t, rank }: { t: TopTrade; rank: number }) {
  const isWin = t.pnlPct > 0
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#2a3045] last:border-0">
      <div className="text-gray-500 text-xs w-5">#{rank}</div>
      <div className="font-semibold text-sm w-16">{t.symbol}</div>
      <div className="flex-1">
        <div className="text-xs text-gray-400">
          {new Date(t.openedAt).toLocaleDateString('tr-TR')}
          {t.closedAt && ` → ${new Date(t.closedAt).toLocaleDateString('tr-TR')}`}
        </div>
        <div className="text-xs text-gray-500">{t.closeReason ?? '—'}</div>
      </div>
      <div className={`text-sm font-bold tabular-nums ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
        {pct(t.pnlPct)}
      </div>
      <div className={`text-xs tabular-nums w-20 text-right ${isWin ? 'text-emerald-300' : 'text-red-300'}`}>
        {fmtUsdt(t.pnlUsdt)}
      </div>
    </div>
  )
}

// ───────── Exit reason pills ─────────
const EXIT_COLORS: Record<string, string> = {
  'Take Profit':   'bg-emerald-900 text-emerald-300',
  'Trailing Stop': 'bg-blue-900 text-blue-300',
  'Stop Loss':     'bg-red-900 text-red-300',
  'Max Süre':      'bg-yellow-900 text-yellow-300',
  'Manuel':        'bg-purple-900 text-purple-300',
  'Momentum':      'bg-orange-900 text-orange-300',
}
function ExitPill({ r }: { r: ExitReasonStat }) {
  const cls = EXIT_COLORS[r.reason] ?? 'bg-gray-800 text-gray-300'
  const isPos = r.totalPnlUsdt >= 0
  return (
    <div className="flex items-center justify-between bg-[#111827] rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{r.reason}</span>
        <span className="text-gray-500 text-xs">{r.count} işlem ({fmt(r.pct, 1)}%)</span>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
        {fmtUsdt(r.totalPnlUsdt)}
      </span>
    </div>
  )
}

// ───────── Drawdown line ─────────
function DrawdownChart({ data }: { data: { date: string; drawdownPct: number }[] }) {
  if (data.length < 2) return null
  const values = data.map(d => d.drawdownPct)
  const min = Math.min(...values, 0)
  const W = 600, H = 80, pad = 6

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - 2 * pad)
    const y = pad + ((d.drawdownPct - 0) / (min - 0)) * (H - 2 * pad)
    return `${x},${y}`
  })

  return (
    <div className="overflow-hidden rounded-lg bg-[#111827] p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        <line x1={pad} y1={pad} x2={W - pad} y2={pad} stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />
        <polyline points={points.join(' ')} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
        <polygon
          points={`${pad},${pad} ${points.join(' ')} ${W - pad},${pad}`}
          fill="#ef4444" opacity="0.15"
        />
      </svg>
    </div>
  )
}

// ───────── Main page ─────────
export default function AnalyticsPage() {
  const [virtualOnly, setVirtualOnly] = useState(false)

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', virtualOnly],
    queryFn: () => analyticsApi.get(virtualOnly),
    refetchInterval: 60_000,
  })

  const s = data?.summary

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Performans Analitikleri</h1>
          <p className="text-sm text-gray-400">Tüm kapalı pozisyonların detaylı istatistikleri</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-400">Yalnızca Sanal</span>
          <div
            onClick={() => setVirtualOnly(v => !v)}
            className={`w-10 h-6 rounded-full transition-colors ${virtualOnly ? 'bg-indigo-600' : 'bg-gray-700'} relative`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${virtualOnly ? 'left-5' : 'left-1'}`} />
          </div>
        </label>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-gray-400">Yükleniyor…</div>
      )}

      {data && s && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Toplam İşlem" value={s.totalTrades.toString()} />
            <MetricCard
              label="Kazanma Oranı"
              value={`${fmt(s.winRate, 1)}%`}
              sub={`${s.winCount}W / ${s.lossCount}L`}
              color={s.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
            />
            <MetricCard
              label="Toplam K/Z"
              value={`${fmtUsdt(s.totalPnlUsdt)}`}
              color={s.totalPnlUsdt >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <MetricCard
              label="Kâr Faktörü"
              value={s.profitFactor === 999 ? '∞' : fmt(s.profitFactor, 2)}
              sub="Brüt Kâr / Brüt Zarar"
              color={s.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400'}
            />
            <MetricCard
              label="Max Drawdown"
              value={`${fmt(s.maxDrawdownPct, 2)}%`}
              color="text-red-400"
            />
          </div>

          <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
            <MetricCard label="Ort. Kazanç" value={pct(s.avgWinPct)} color="text-emerald-400" />
            <MetricCard label="Ort. Kayıp" value={pct(s.avgLossPct)} color="text-red-400" />
            <MetricCard label="Ort. Tutma" value={`${fmt(s.avgHoldHours, 1)} sa`} />
          </div>

          {/* Cumulative P&L */}
          <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Kümülatif K/Z Grafiği</h2>
            <Sparkline data={data.dailyPnl} />
          </div>

          {/* Drawdown */}
          {data.drawdown.some(d => d.drawdownPct < 0) && (
            <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Drawdown</h2>
              <DrawdownChart data={data.drawdown} />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* By Coin */}
            <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Coin Bazlı Performans</h2>
              {data.byCoin.length === 0
                ? <div className="text-gray-500 text-sm">Veri yok</div>
                : <BarChart
                    data={data.byCoin.map((c: CoinPerformance) => ({
                      label: c.symbol,
                      value: c.totalPnlUsdt,
                      color: c.totalPnlUsdt >= 0 ? '#10b981' : '#ef4444',
                    }))}
                  />
              }
              {data.byCoin.length > 0 && (
                <div className="mt-4 space-y-1">
                  {data.byCoin.map((c: CoinPerformance) => (
                    <div key={c.symbol} className="flex text-xs text-gray-400 gap-2">
                      <span className="w-16 font-medium text-white">{c.symbol}</span>
                      <span>{c.trades} işlem</span>
                      <span className={c.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
                        {fmt(c.winRate, 1)}% kazanma
                      </span>
                      <span className="ml-auto">{pct(c.avgPnlPct)} ort</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exit Reasons */}
            <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Çıkış Nedenleri</h2>
              {data.exitReasons.length === 0
                ? <div className="text-gray-500 text-sm">Veri yok</div>
                : <div className="space-y-2">
                    {data.exitReasons.map((r: ExitReasonStat) => <ExitPill key={r.reason} r={r} />)}
                  </div>
              }
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Best Trades */}
            <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-emerald-400 mb-3">En İyi İşlemler</h2>
              {data.bestTrades.length === 0
                ? <div className="text-gray-500 text-sm">Veri yok</div>
                : data.bestTrades.map((t: TopTrade, i: number) => <TradeRow key={i} t={t} rank={i + 1} />)
              }
            </div>

            {/* Worst Trades */}
            <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-red-400 mb-3">En Kötü İşlemler</h2>
              {data.worstTrades.length === 0
                ? <div className="text-gray-500 text-sm">Veri yok</div>
                : data.worstTrades.map((t: TopTrade, i: number) => <TradeRow key={i} t={t} rank={i + 1} />)
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}
