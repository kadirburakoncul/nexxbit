import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { signalRecordsApi, multiTimeframeApi } from '@/api/signals'
import type { SignalRecord } from '@/api/signals'
import Header from '@/components/layout/Header'
import { TrendingUp, TrendingDown, RefreshCw, Activity, Clock, Trash2, DollarSign, X, AlertTriangle, Layers } from 'lucide-react'
import { cn, formatUsdt } from '@/lib/utils'
import { useState, useEffect } from 'react'

const CONFLUENCE_META = {
  STRONG_BUY:  { label: 'Güçlü AL',  cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  BUY:         { label: 'AL',         cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  NEUTRAL:     { label: 'Nötr',       cls: 'bg-slate-500/20 text-slate-400 border-slate-500/20' },
  SELL:        { label: 'SAT',        cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  STRONG_SELL: { label: 'Güçlü SAT', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
}

const DIR_CLS: Record<string, string> = {
  Buy: 'bg-emerald-500/20 text-emerald-400',
  Sell: 'bg-red-500/20 text-red-400',
  StrongSell: 'bg-red-600/30 text-red-300',
  Hold: 'bg-slate-500/20 text-slate-400',
}

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

// Binance standart komisyon: %0.1 alış + %0.1 satış = %0.2 toplam
const COMM_RATE = 0.001
function calcComm(entryVal: number, closeVal: number) {
  const total = (entryVal + closeVal) * COMM_RATE
  const pct = entryVal > 0 ? (total / entryVal) * 100 : 0
  return { total, pct }
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
  const [tab, setTab] = useState<'positions' | 'mtf'>('positions')

  // Multi-timeframe confluence
  const { data: mtfData, isLoading: mtfLoading } = useQuery({
    queryKey: ['multi-timeframe-signals'],
    queryFn: () => multiTimeframeApi.get(24),
    refetchInterval: 60_000,
    enabled: tab === 'mtf',
  })

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['virtual-positions'] })
      qc.invalidateQueries({ queryKey: ['positions', 'dashboard-all'] })
    },
  })

  const open = records?.filter(r => r.status === 'Open') ?? []
  const closed = records?.filter(r => r.status === 'Closed') ?? []

  const closedWins = closed.filter(r => (r.realizedPnl ?? 0) > 0).length
  const closedLosses = closed.filter(r => (r.realizedPnl ?? 0) < 0).length
  const closedWithPnl = closed.filter(r => r.realizedPnl != null && r.entryValueUsdt > 0)

  // Toplam K/Z: sum(realizedPnl USDT) / sum(yatırılan USDT) — yüzde toplamı değil
  const totalRealizedUsdt = closedWithPnl.reduce((s, r) => s + (r.realizedPnl ?? 0), 0)
  const totalInvestedUsdt = closedWithPnl.reduce((s, r) => s + r.entryValueUsdt, 0)
  const totalPnlPct = totalInvestedUsdt > 0 ? (totalRealizedUsdt / totalInvestedUsdt) * 100 : 0
  const hasPnl = closedWithPnl.length > 0

  return (
    <>
      <Header title="Sinyaller" />
      <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-6xl">

        {/* Sekmeler */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
          <button
            onClick={() => setTab('positions')}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'positions' ? 'bg-yellow-400 text-black' : 'text-slate-400 hover:text-slate-200')}
          >
            <Activity size={14} /> Pozisyonlar
          </button>
          <button
            onClick={() => setTab('mtf')}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'mtf' ? 'bg-yellow-400 text-black' : 'text-slate-400 hover:text-slate-200')}
          >
            <Layers size={14} /> Multi-Timeframe
          </button>
        </div>

        {/* Multi-Timeframe İçeriği */}
        {tab === 'mtf' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Son 24 saatte coin başına üretilen sinyallerin timeframe konfigürasyonu. Güçlü confluencelı coinler üstte gösterilir.</p>
            {mtfLoading && <div className="text-slate-500 text-sm py-8 text-center">Yükleniyor…</div>}
            {!mtfLoading && (!mtfData || mtfData.length === 0) && (
              <div className="text-slate-500 text-sm py-8 text-center">Son 24 saatte sinyal bulunamadı.</div>
            )}
            <div className="grid gap-3">
              {mtfData?.map(coin => {
                const meta = CONFLUENCE_META[coin.confluence] ?? CONFLUENCE_META.NEUTRAL
                return (
                  <div key={coin.coinId} className="bg-white/5 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-bold text-slate-100">{coin.coinSymbol}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', meta.cls)}>{meta.label}</span>
                      <span className="text-xs text-slate-600 ml-auto">{coin.timeframes.length} timeframe</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {coin.timeframes.map(tf => (
                        <div key={tf.timeframe} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-slate-500 font-mono">{tf.timeframe}</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', DIR_CLS[tf.direction] ?? DIR_CLS.Hold)}>
                            {tf.direction === 'Buy' ? 'AL' : tf.direction === 'Sell' || tf.direction === 'StrongSell' ? 'SAT' : '—'}
                          </span>
                          <span className="text-[10px] text-slate-600">{tf.score.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pozisyon İçeriği */}
        {tab === 'positions' && <>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
            label="Toplam K/Z"
            value={hasPnl ? `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}
            valueClass={!hasPnl ? undefined : totalPnlPct > 0 ? 'text-emerald-400' : totalPnlPct < 0 ? 'text-red-400' : 'text-slate-400'}
            icon={hasPnl ? (totalPnlPct >= 0 ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />) : undefined}
            sub={hasPnl
              ? `${totalRealizedUsdt >= 0 ? '+' : ''}${formatUsdt(totalRealizedUsdt)} · ${closedWins} K / ${closedLosses} Z`
              : 'Henüz kapanan yok'}
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
                  <th className="text-right px-4 py-3">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {open.map(r => <OpenRow key={r.id} record={r} onSold={() => qc.invalidateQueries({ queryKey: ['virtual-positions'] })} />)}
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
        </> /* positions tab */}
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
      <div className="bg-white/5 border border-white/5 rounded-xl overflow-x-auto">
        <div className="min-w-[560px]">
          {children}
        </div>
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
function OpenRow({ record, onSold }: { record: SignalRecord; onSold: () => void }) {
  const liveAgo = useLiveAgo(record.openedAt)
  const livePrice = useLivePrice(record.coinSymbol)
  const [selling, setSelling] = useState(false)
  const [mode, setMode] = useState<'market' | 'limit' | null>(null)
  const [limitPrice, setLimitPrice] = useState('')
  const [belowTarget, setBelowTarget] = useState<null | { currentPrice: number; diff: number }>(null)

  const pnlPct = livePrice != null
    ? ((livePrice - record.entryPrice) / record.entryPrice) * 100
    : null
  const pnlClass = pnlPct == null
    ? 'text-slate-600'
    : pnlPct > 0 ? 'text-emerald-400' : pnlPct < 0 ? 'text-red-400' : 'text-slate-400'

  const entryVal = record.entryValueUsdt > 0
    ? record.entryValueUsdt
    : record.entryPrice * record.entryQuantity
  const closeEst = livePrice != null
    ? (record.entryQuantity > 0 ? livePrice * record.entryQuantity : (record.entryPrice > 0 ? livePrice / record.entryPrice * entryVal : 0))
    : 0
  const comm = entryVal > 0 && closeEst > 0 ? calcComm(entryVal, closeEst) : null
  const netPnlPct = pnlPct != null && comm != null ? pnlPct - comm.pct : null

  const sellMut = useMutation({
    mutationFn: (body: { type: 'market' | 'limit'; limitPrice?: number; force?: boolean }) =>
      signalRecordsApi.manualSell(record.id, body),
    onSuccess: (data) => {
      if (data.success) onSold()
    },
    onError: (error: any) => {
      const body = error?.response?.data
      if (body?.belowTarget) {
        setBelowTarget({ currentPrice: body.currentPrice!, diff: body.diff! })
      }
    },
  })

  const err = (sellMut.error as any)?.response?.data?.errors?.[0] ?? (sellMut.error as any)?.message

  return (
    <>
      <tr className="hover:bg-white/5 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{record.coinSymbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 flex items-center gap-1">
              <Clock size={10} /> Açık
            </span>
          </div>
          {record.strategyName && (
            <span className="text-[10px] text-slate-500 mt-0.5 block">{record.strategyName}</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">
          {record.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs">
          {livePrice != null
            ? <span className="text-slate-100 font-semibold">{livePrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}</span>
            : <span className="text-slate-700">—</span>}
        </td>
        <td className="px-4 py-3 text-right">
          <div className={cn('font-mono text-sm font-semibold tabular-nums', pnlClass)}>
            {pnlPct != null ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
          </div>
          {netPnlPct != null && (
            <div className={cn('text-[10px] font-mono tabular-nums mt-0.5',
              netPnlPct > 0 ? 'text-emerald-600' : netPnlPct < 0 ? 'text-red-600' : 'text-slate-600')}>
              {netPnlPct > 0 ? '+' : ''}{netPnlPct.toFixed(2)}% <span className="text-slate-700">net</span>
            </div>
          )}
          {comm != null && (
            <div className="text-[10px] font-mono text-slate-700 mt-0.5">
              ~${comm.total.toFixed(2)} <span className="text-slate-800">kom.</span>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-right text-slate-500 text-xs">
          {fmtDate(record.openedAt)}
        </td>
        <td className="px-4 py-3 text-right text-xs">
          <span className="font-mono text-yellow-400 font-semibold tabular-nums">{liveAgo}</span>
          <span className="text-slate-600 ml-1">önce</span>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => { setSelling(s => !s); setMode(null); setBelowTarget(null) }}
            className="flex items-center gap-1 text-xs bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 font-medium px-2.5 py-1.5 rounded-lg transition-colors ml-auto"
          >
            <DollarSign size={11} />
            Manuel Sat
          </button>
        </td>
      </tr>

      {/* Satış paneli — ayrı satır olarak genişler */}
      {selling && (
        <tr>
          <td colSpan={7} className="px-4 pb-3 pt-0">
            <div className="bg-white/[0.03] border border-orange-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-orange-300">
                  Manuel Satış — {record.coinSymbol}
                  <span className="text-slate-500 font-normal ml-2">(Sanal pozisyon — Binance emri gönderilmez)</span>
                </p>
                <button onClick={() => { setSelling(false); setMode(null); setBelowTarget(null) }}
                  className="text-slate-500 hover:text-slate-300"><X size={13} /></button>
              </div>

              {/* Seçenekler */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setMode('market'); setBelowTarget(null) }}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors',
                    mode === 'market'
                      ? 'bg-red-500/15 border-red-500/30 text-red-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}
                >
                  <Activity size={11} /> Anlık Fiyattan Kapat
                </button>
                <button
                  onClick={() => { setMode('limit'); setBelowTarget(null) }}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors',
                    mode === 'limit'
                      ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}
                >
                  <DollarSign size={11} /> Belirlenmiş Fiyattan Kapat
                </button>
              </div>

              {mode === 'limit' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="any" value={limitPrice}
                    onChange={e => { setLimitPrice(e.target.value); setBelowTarget(null) }}
                    placeholder="Hedef fiyat (USDT)"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 w-48"
                  />
                  <span className="text-slate-500 text-xs">$</span>
                </div>
              )}

              {belowTarget && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-2.5 space-y-2">
                  <p className="text-xs text-red-300 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    Güncel fiyat hedefin <strong>{Math.abs(belowTarget.diff).toFixed(2)}%</strong> altında (Güncel: ${belowTarget.currentPrice.toLocaleString('tr-TR', { maximumFractionDigits: 6 })})
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => sellMut.mutate({ type: 'limit', limitPrice: parseFloat(limitPrice), force: true })}
                      disabled={sellMut.isPending}
                      className="text-xs bg-red-500/20 border border-red-500/30 text-red-300 px-3 py-1 rounded-lg disabled:opacity-50"
                    >
                      {sellMut.isPending ? '…' : 'Yine de Kapat'}
                    </button>
                    <button onClick={() => setBelowTarget(null)} className="text-xs text-slate-500">İptal</button>
                  </div>
                </div>
              )}

              {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={11} />{err}</p>}

              {!belowTarget && mode && (
                <button
                  onClick={() => {
                    if (mode === 'market') sellMut.mutate({ type: 'market' })
                    else if (mode === 'limit' && limitPrice) sellMut.mutate({ type: 'limit', limitPrice: parseFloat(limitPrice) })
                  }}
                  disabled={sellMut.isPending || (mode === 'limit' && !limitPrice)}
                  className="bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  {sellMut.isPending ? 'Kapatılıyor…' : mode === 'market' ? 'Anlık Fiyattan Kapat' : 'Fiyatı Kontrol Et ve Kapat'}
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── ClosedRow ────────────────────────────────────────────────────────────────
function ClosedRow({ record }: { record: SignalRecord }) {
  const pnlPct = record.realizedPnlPct
  const isWin = (pnlPct ?? 0) > 0
  const isLoss = (pnlPct ?? 0) < 0
  const pnlClass = isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-slate-500'

  const entryVal = record.entryValueUsdt > 0 ? record.entryValueUsdt : 0
  const closeVal = record.closeValueUsdt ?? 0
  const comm = entryVal > 0 && closeVal > 0 ? calcComm(entryVal, closeVal) : null
  const netPnlPct = pnlPct != null && comm != null ? pnlPct - comm.pct : null
  const netIsWin = (netPnlPct ?? 0) > 0
  const netIsLoss = (netPnlPct ?? 0) < 0

  return (
    <tr className="hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-200">{record.coinSymbol}</div>
        {record.strategyName && (
          <div className="text-[10px] text-slate-500 mt-0.5">{record.strategyName}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">
        {record.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })}
      </td>
      <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">
        {record.closePrice != null
          ? record.closePrice.toLocaleString('tr-TR', { maximumFractionDigits: 8 })
          : <span className="text-slate-700">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className={cn('font-mono text-sm font-semibold', pnlClass)}>
          {pnlPct != null
            ? `${isWin ? '+' : ''}${pnlPct.toFixed(2)}%`
            : <span className="text-slate-700">—</span>}
        </div>
        {netPnlPct != null && (
          <div className={cn('text-[10px] font-mono tabular-nums mt-0.5',
            netIsWin ? 'text-emerald-600' : netIsLoss ? 'text-red-600' : 'text-slate-600')}>
            {netPnlPct > 0 ? '+' : ''}{netPnlPct.toFixed(2)}% <span className="text-slate-700">net</span>
          </div>
        )}
        {comm != null && (
          <div className="text-[10px] font-mono text-slate-700 mt-0.5">
            ~${comm.total.toFixed(2)} <span className="text-slate-800">kom.</span>
          </div>
        )}
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
