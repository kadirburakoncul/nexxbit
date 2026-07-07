import { useQuery, useQueries, useQueryClient, useMutation } from '@tanstack/react-query'
import { signalRecordsApi, multiTimeframeApi } from '@/api/signals'
import type { SignalRecord } from '@/api/signals'
import Header from '@/components/layout/Header'
import { TrendingUp, TrendingDown, RefreshCw, Activity, Clock, Trash2, DollarSign, X, AlertTriangle, Layers, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
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

// $100 sanal simülasyon bazı — her işlem sanki 100$ yatırılmış gibi gösterilir
const SIM = 100

// Kapanış sebebi → renkli badge + detay
function CloseReasonBadge({ record }: { record: SignalRecord }) {
  const reason = record.closeReason
  if (!reason) return <span className="text-slate-700">—</span>

  const r = reason.toLowerCase()

  if (r === 'takeprofit') {
    const pnl = record.realizedPnlPct
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
          ✅ Kar Al (TP)
        </span>
        {pnl != null && (
          <div className="text-[10px] text-emerald-600 mt-0.5">Hedef fiyata ulaşıldı: +{pnl.toFixed(2)}%</div>
        )}
      </div>
    )
  }

  if (r === 'trailingstop') {
    const peakPnl = record.peakPnlPct
    const pnl = record.realizedPnlPct
    const dropFromPeak = (peakPnl != null && pnl != null) ? (pnl - peakPnl) : null
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">
          🔁 Trailing Stop
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {peakPnl != null && <span>Zirve: <span className={cn(peakPnl > 0 ? 'text-emerald-600' : 'text-red-600')}>{peakPnl > 0 ? '+' : ''}{peakPnl.toFixed(2)}%</span></span>}
          {dropFromPeak != null && <span className="ml-1 text-orange-600">→ {dropFromPeak.toFixed(2)}% geri çekildi</span>}
        </div>
      </div>
    )
  }

  if (r === 'stoploss') {
    const pnl = record.realizedPnlPct
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
          🛑 Stop Loss
        </span>
        {pnl != null && (
          <div className="text-[10px] text-red-600 mt-0.5">Zarar kesme: {pnl.toFixed(2)}%</div>
        )}
      </div>
    )
  }

  if (r === 'maxholdtime') {
    const openedMs = record.openedAt ? parseUtc(record.openedAt).getTime() : null
    const closedMs = record.closedAt ? parseUtc(record.closedAt).getTime() : null
    const hours = (openedMs && closedMs) ? ((closedMs - openedMs) / 3_600_000) : null
    const pnl = record.realizedPnlPct
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/25">
          ⏰ Süre Sınırı
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {hours != null && <span>{hours.toFixed(1)}sa açık kaldı</span>}
          {pnl != null && <span className={cn('ml-1', pnl > 0 ? 'text-emerald-600' : 'text-red-600')}>{pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%</span>}
        </div>
      </div>
    )
  }

  if (r.includes('manual') || r.includes('manualsell')) {
    const pnl = record.realizedPnlPct
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
          👤 Manuel Satış
        </span>
        {pnl != null && (
          <div className={cn('text-[10px] mt-0.5', pnl > 0 ? 'text-emerald-600' : 'text-red-600')}>{pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%</div>
        )}
      </div>
    )
  }

  if (r.includes('momentum')) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/25">
          📊 Momentum Kaybı
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">Coin artık momentum listesinde değil</div>
      </div>
    )
  }

  if (r.includes('t3') || r.includes('sat') || r.includes('sell')) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/25">
          📉 T3 SAT Sinyali
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">İndikatör SAT sinyali üretti</div>
      </div>
    )
  }

  return (
    <span className="text-slate-500 text-[10px] truncate max-w-28 block" title={reason}>{reason}</span>
  )
}

function useLivePrice(symbol: string): number | undefined {
  const { data } = useQuery({
    queryKey: ['live-price', symbol],
    queryFn: async () => {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`)
      const json = await res.json()
      return parseFloat(json.price)
    },
    refetchInterval: 2_000,
    staleTime: 1_500,
  })
  return data
}

function fmtPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return '—'
  const abs = Math.abs(price)
  let decimals: number
  if (abs >= 10000) decimals = 2
  else if (abs >= 1000) decimals = 2
  else if (abs >= 10) decimals = 4
  else if (abs >= 1) decimals = 4
  else if (abs >= 0.1) decimals = 6
  else if (abs >= 0.001) decimals = 6
  else decimals = 8
  return price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// $100 simülasyon USDT kazanç/kayıp gösterimi
function SimPnl({ pnlPct }: { pnlPct: number | null }) {
  if (pnlPct == null) return null
  const usdt = (pnlPct / 100) * SIM
  const isPos = usdt >= 0
  return (
    <div className={cn('text-[10px] font-mono tabular-nums mt-0.5',
      isPos ? 'text-emerald-600' : 'text-red-600')}>
      {isPos ? '+' : ''}${usdt.toFixed(2)}
      <span className="text-slate-700 ml-0.5">/{SIM}$</span>
    </div>
  )
}

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

  const { data: mtfData, isLoading: mtfLoading } = useQuery({
    queryKey: ['multi-timeframe-signals'],
    queryFn: () => multiTimeframeApi.get(24),
    refetchInterval: 60_000,
    enabled: tab === 'mtf',
  })

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

  const livePriceQueries = useQueries({
    queries: open.map(r => ({
      queryKey: ['live-price', r.coinSymbol],
      queryFn: async () => {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(r.coinSymbol)}`)
        return parseFloat((await res.json()).price)
      },
      refetchInterval: 2_000,
      staleTime: 1_500,
    })),
  })

  const openPnlItems = open
    .map((r, i) => ({ r, price: livePriceQueries[i]?.data as number | undefined }))
    .filter(x => x.price != null && x.r.entryPrice > 0)
    .map(({ r, price }) => {
      const pct = ((price! - r.entryPrice) / r.entryPrice) * 100
      const simUsdt = (pct / 100) * SIM
      return { pct, simUsdt }
    })

  const hasLivePrice     = openPnlItems.length > 0
  const openTotalPct     = hasLivePrice ? openPnlItems.reduce((s, x) => s + x.pct, 0) : null
  const openTotalSimUsdt = hasLivePrice ? openPnlItems.reduce((s, x) => s + x.simUsdt, 0) : null

  const COMM_PCT = 0.2
  const closedWithPnl = closed.filter(r => r.realizedPnlPct != null)
  const closedWins    = closedWithPnl.filter(r => (r.realizedPnlPct ?? 0) > 0).length
  const closedLosses  = closedWithPnl.filter(r => (r.realizedPnlPct ?? 0) < 0).length
  const hasPnl        = closedWithPnl.length > 0
  const totalPnlPct   = closedWithPnl.reduce((s, r) => s + (r.realizedPnlPct ?? 0), 0)
  const totalNetPnlPct = totalPnlPct - COMM_PCT * closedWithPnl.length
  // Her işlem $100 baz: totalSimUsdt = sum(pnlPct_i * $1)
  const totalSimUsdt  = totalPnlPct  // numerically equal when base=$100

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

        {/* Multi-Timeframe */}
        {tab === 'mtf' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Son 24 saatte coin başına üretilen sinyallerin timeframe konfigürasyonu.</p>
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

        {/* $100 simülasyon açıklama bandı */}
        <div className="flex items-center gap-2 bg-yellow-400/5 border border-yellow-400/15 rounded-xl px-4 py-2.5">
          <DollarSign size={13} className="text-yellow-400 shrink-0" />
          <p className="text-xs text-slate-400">
            Her işlem <span className="text-yellow-400 font-semibold">$100</span> yatırılmış gibi simüle edilir.
            K/Z kısmındaki <span className="text-emerald-400">+$X.XX</span> değerleri bu baza göre hesaplanmıştır.
            Gerçek modda risk ayarlarınızdaki pozisyon boyutu geçerli olur.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="Açık Pozisyon"
            value={open.length.toString()}
            valueClass="text-yellow-400"
            icon={<Activity size={16} className="text-yellow-400" />}
            sub="AL sinyali verildi"
          />
          <StatCard
            label="Açık K/Z"
            value={openTotalPct != null
              ? `${openTotalPct >= 0 ? '+' : ''}${openTotalPct.toFixed(2)}%`
              : open.length > 0 && !hasLivePrice ? '…' : '—'}
            valueClass={openTotalPct == null ? undefined : openTotalPct > 0 ? 'text-emerald-400' : openTotalPct < 0 ? 'text-red-400' : 'text-slate-400'}
            icon={openTotalPct != null ? (openTotalPct >= 0 ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />) : undefined}
            sub={openTotalSimUsdt != null
              ? `$100/işlem → ${openTotalSimUsdt >= 0 ? '+' : ''}$${Math.abs(openTotalSimUsdt).toFixed(2)} toplam`
              : open.length > 0 ? `${open.length} açık pozisyon` : 'Açık pozisyon yok'}
          />
          <StatCard
            label="Tamamlanan"
            value={closed.length.toString()}
            sub={`${closedWins} kazanç · ${closedLosses} kayıp`}
          />
          <StatCard
            label="Kapanan K/Z"
            value={hasPnl ? `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%` : '—'}
            valueClass={!hasPnl ? undefined : totalPnlPct > 0 ? 'text-emerald-400' : totalPnlPct < 0 ? 'text-red-400' : 'text-slate-400'}
            icon={hasPnl ? (totalPnlPct >= 0 ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />) : undefined}
            sub={hasPnl
              ? `$100/işlem → ${totalSimUsdt >= 0 ? '+' : ''}$${Math.abs(totalSimUsdt).toFixed(2)} · net: ${totalNetPnlPct.toFixed(2)}%`
              : 'Henüz kapanan yok'}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">
            AL sinyali geldiğinde giriş oluşur. TP/SL/Trailing/Momentum çıkışında kapanır. Saat: UTC+3.
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
                  <th className="text-right px-4 py-3">Alış</th>
                  <th className="text-right px-4 py-3">Anlık</th>
                  <th className="text-right px-4 py-3">En Yüksek</th>
                  <th className="text-right px-4 py-3">SL / TP</th>
                  <th className="text-right px-4 py-3">K/Z ($100)</th>
                  <th className="text-right px-4 py-3">Süre</th>
                  <th className="text-right px-4 py-3">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {open.map(r => <OpenRow key={r.id} record={r} onSold={() => qc.invalidateQueries({ queryKey: ['virtual-positions'] })} />)}
              </tbody>
            </table>
          </Section>
        )}

        {isLoading && <p className="text-slate-500 text-sm px-1">Yükleniyor…</p>}

        {!isLoading && records?.length === 0 && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-10 text-center">
            <p className="text-slate-500 text-sm">Henüz sinyal yok.</p>
            <p className="text-slate-600 text-xs mt-1">Strateji aktive edildikten sonra AL sinyali geldiğinde burada görünür.</p>
          </div>
        )}

        {/* Kapalı pozisyonlar */}
        {closed.length > 0 && (
          <Section title="Kapanan Pozisyonlar" count={closed.length} accent="slate">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Coin</th>
                  <th className="text-right px-4 py-3">Alış</th>
                  <th className="text-right px-4 py-3">Satış</th>
                  <th className="text-right px-4 py-3">En Yüksek</th>
                  <th className="text-right px-4 py-3">K/Z ($100)</th>
                  <th className="text-left px-4 py-3">Kapanış</th>
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
        <div className="min-w-[640px]">
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
        {/* Coin */}
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

        {/* Alış fiyatı + tarihi */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          <div className="text-slate-300">{fmtPrice(record.entryPrice)}</div>
          <div className="text-slate-600 text-[10px] mt-0.5">{fmtDate(record.openedAt)}</div>
        </td>

        {/* Anlık fiyat */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          {livePrice != null
            ? <span className="text-slate-100 font-semibold">{fmtPrice(livePrice)}</span>
            : <span className="text-slate-700">—</span>}
        </td>

        {/* En Yüksek */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          {record.peakPrice != null ? (
            <div>
              <div className="text-purple-300 font-semibold">{fmtPrice(record.peakPrice)}</div>
              {record.peakPnlPct != null && (
                <div className={cn('text-[10px] tabular-nums mt-0.5',
                  record.peakPnlPct > 0 ? 'text-emerald-500' : 'text-red-500')}>
                  {record.peakPnlPct > 0 ? '+' : ''}{record.peakPnlPct.toFixed(2)}%
                </div>
              )}
            </div>
          ) : <span className="text-slate-700">—</span>}
        </td>

        {/* SL / TP — strateji koruma seviyeleri */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          <div className="space-y-0.5">
            {record.stopLossPrice != null ? (
              <div className="flex items-center justify-end gap-1">
                <ShieldAlert size={9} className="text-red-500" />
                <span className="text-red-400 font-semibold">{fmtPrice(record.stopLossPrice)}</span>
              </div>
            ) : <div className="text-slate-700 text-[10px]">SL yok</div>}
            {record.takeProfitPrice != null ? (
              <div className="flex items-center justify-end gap-1">
                <span className="text-[9px] text-emerald-600">✅</span>
                <span className="text-emerald-400 font-semibold">{fmtPrice(record.takeProfitPrice)}</span>
              </div>
            ) : <div className="text-slate-700 text-[10px]">TP yok</div>}
            {record.trailingStopPct != null && (
              <div className="text-orange-400/70 text-[10px]">↩ {record.trailingStopPct}% trailing</div>
            )}
          </div>
        </td>

        {/* K/Z — % + $100 sim */}
        <td className="px-4 py-3 text-right">
          <div className={cn('font-mono text-sm font-semibold tabular-nums', pnlClass)}>
            {pnlPct != null ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
          </div>
          <SimPnl pnlPct={pnlPct} />
        </td>

        {/* Süre */}
        <td className="px-4 py-3 text-right text-xs">
          <span className="font-mono text-yellow-400 font-semibold tabular-nums">{liveAgo}</span>
        </td>

        {/* Aksiyon */}
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

      {/* Satış paneli */}
      {selling && (
        <tr>
          <td colSpan={8} className="px-4 pb-3 pt-0">
            <div className="bg-white/[0.03] border border-orange-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-orange-300">
                  Manuel Satış — {record.coinSymbol}
                  <span className="text-slate-500 font-normal ml-2">(Sanal pozisyon — Binance emri gönderilmez)</span>
                </p>
                <button onClick={() => { setSelling(false); setMode(null); setBelowTarget(null) }}
                  className="text-slate-500 hover:text-slate-300"><X size={13} /></button>
              </div>
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
                    Güncel fiyat hedefin <strong>{Math.abs(belowTarget.diff).toFixed(2)}%</strong> altında
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
  const pnlPct  = record.realizedPnlPct
  const isWin   = (pnlPct ?? 0) > 0
  const isLoss  = (pnlPct ?? 0) < 0
  const pnlClass = isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-slate-500'

  // Komisyon tahmini ($100 sim bazında)
  const simEntry = SIM
  const simClose = pnlPct != null ? SIM * (1 + pnlPct / 100) : 0
  const comm = simClose > 0 ? calcComm(simEntry, simClose) : null
  const netPnlPct = pnlPct != null && comm != null ? pnlPct - comm.pct : null
  const netIsWin  = (netPnlPct ?? 0) > 0
  const netIsLoss = (netPnlPct ?? 0) < 0

  return (
    <tr className="hover:bg-white/5 transition-colors">
      {/* Coin */}
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-200">{record.coinSymbol}</div>
        {record.strategyName && (
          <div className="text-[10px] text-slate-500 mt-0.5">{record.strategyName}</div>
        )}
      </td>

      {/* Alış fiyatı + tarihi */}
      <td className="px-4 py-3 text-right font-mono text-xs">
        <div className="text-slate-400">{fmtPrice(record.entryPrice)}</div>
        <div className="text-slate-600 text-[10px] mt-0.5">{fmtDate(record.openedAt)}</div>
      </td>

      {/* Satış fiyatı + tarihi */}
      <td className="px-4 py-3 text-right font-mono text-xs">
        {record.closePrice != null
          ? <>
              <div className="text-slate-400">{fmtPrice(record.closePrice)}</div>
              <div className="text-slate-600 text-[10px] mt-0.5">{fmtDate(record.closedAt)}</div>
            </>
          : <span className="text-slate-700">—</span>}
      </td>

      {/* En Yüksek */}
      <td className="px-4 py-3 text-right font-mono text-xs">
        {record.peakPrice != null ? (
          <div>
            <div className="text-purple-400/80">{fmtPrice(record.peakPrice)}</div>
            {record.peakPnlPct != null && (
              <div className={cn('text-[10px] tabular-nums mt-0.5',
                record.peakPnlPct > 0 ? 'text-emerald-600' : 'text-red-600')}>
                {record.peakPnlPct > 0 ? '+' : ''}{record.peakPnlPct.toFixed(2)}%
              </div>
            )}
          </div>
        ) : <span className="text-slate-700">—</span>}
      </td>

      {/* K/Z — % + $100 sim + partial TP */}
      <td className="px-4 py-3 text-right">
        <div className={cn('font-mono text-sm font-semibold', pnlClass)}>
          {pnlPct != null
            ? `${isWin ? '+' : ''}${pnlPct.toFixed(2)}%`
            : <span className="text-slate-700">—</span>}
        </div>
        <SimPnl pnlPct={pnlPct} />
        {netPnlPct != null && (
          <div className={cn('text-[10px] font-mono tabular-nums mt-0.5',
            netIsWin ? 'text-emerald-700' : netIsLoss ? 'text-red-700' : 'text-slate-600')}>
            {netPnlPct > 0 ? '+' : ''}{netPnlPct.toFixed(2)}% <span className="text-slate-700">net</span>
          </div>
        )}
        {/* Kısmi TP bilgisi */}
        {record.isPartialTpHit && record.partialRealizedPnlPct != null && (
          <div className="text-[10px] text-emerald-700 mt-0.5">
            Kısmi TP: +{record.partialRealizedPnlPct.toFixed(2)}%
          </div>
        )}
      </td>

      {/* Kapanış sebebi — renkli badge + detay */}
      <td className="px-4 py-3 text-left">
        <CloseReasonBadge record={record} />
      </td>
    </tr>
  )
}
