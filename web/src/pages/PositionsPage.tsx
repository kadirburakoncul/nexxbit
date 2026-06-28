import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { signalRecordsApi } from '@/api/signals'
import type { SignalRecord } from '@/api/signals'
import { formatUsdt, pnlColor } from '@/lib/utils'
import Header from '@/components/layout/Header'
import { usePushNotification } from '@/hooks/usePushNotification'
import { exportCsv } from '@/lib/exportCsv'
import { Download } from 'lucide-react'
import {
  TrendingUp, TrendingDown, Wallet, BarChart2,
  Clock, CheckCircle2, Activity,
  Trophy, ArrowDownRight, ArrowUpRight,
  AlertTriangle, DollarSign, X, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Yardımcı ────────────────────────────────────────────────────────────────
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

// Binance standart komisyon: %0.1 alış + %0.1 satış
const COMM_RATE = 0.001
function calcComm(entryVal: number, closeVal: number) {
  const total = (entryVal + closeVal) * COMM_RATE
  const pct = entryVal > 0 ? (total / entryVal) * 100 : 0
  return { total, pct }
}

function fmtTR(str: string | null | undefined): string {
  if (!str) return '—'
  const s = str.endsWith('Z') || str.includes('+') ? str : str + 'Z'
  return new Date(s).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

function calcDuration(from: string, to?: string | null): string {
  const ms = (to ? new Date(to.endsWith('Z') ? to : to + 'Z') : new Date()).getTime()
           - new Date(from.endsWith('Z') ? from : from + 'Z').getTime()
  if (ms < 0) return '—'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (h >= 24) return `${Math.floor(h / 24)}g ${h % 24}s`
  if (h > 0)   return `${h}s ${m}d`
  if (m > 0)   return `${m}d ${s}s`
  return `${s}s`
}

// Canlı sayaç — açık pozisyonlar için her saniye güncellenir
function useLiveDuration(openedAt: string, isOpen: boolean): string {
  const [, setTick] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!isOpen) return
    ref.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [isOpen])
  return calcDuration(openedAt)
}

function OpenPositionDuration({ openedAt }: { openedAt: string }) {
  const dur = useLiveDuration(openedAt, true)
  return <span>{dur}</span>
}

function fmtPrice(n: number): string {
  if (n >= 1000)  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
  if (n >= 1)     return n.toLocaleString('tr-TR', { maximumFractionDigits: 4 })
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 8 })
}

// ─── Özet kart ───────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, icon, accent = 'slate' }: {
  label: string; value: string; sub?: string
  icon: React.ReactNode; accent?: 'slate' | 'emerald' | 'red' | 'amber'
}) {
  const ring: Record<string, string> = {
    slate:   'border-white/8 bg-white/[0.03]',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    red:     'border-red-500/20 bg-red-500/5',
    amber:   'border-amber-500/20 bg-amber-500/5',
  }
  const ic: Record<string, string> = {
    slate:   'bg-white/8 text-slate-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    red:     'bg-red-500/20 text-red-400',
    amber:   'bg-amber-500/20 text-amber-400',
  }
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${ring[accent]}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ic[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-base font-bold text-slate-100 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Manuel Sat bileşeni ──────────────────────────────────────────────────────
function ManualSellPanel({ position, onDone }: { position: SignalRecord; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'market' | 'limit' | null>(null)
  const [limitPrice, setLimitPrice] = useState('')
  const [belowTarget, setBelowTarget] = useState<null | { currentPrice: number; diff: number }>(null)
  const [result, setResult] = useState<null | { fillPrice: number; realizedPnl: number | null; realizedPnlPct: number | null }>(null)
  const qc = useQueryClient()

  const sellMut = useMutation({
    mutationFn: (body: { type: 'market' | 'limit'; limitPrice?: number; force?: boolean }) =>
      signalRecordsApi.manualSell(position.id, body),
    onSuccess: (data) => {
      if (data.success) {
        setResult({ fillPrice: data.fillPrice!, realizedPnl: data.realizedPnl ?? null, realizedPnlPct: data.realizedPnlPct ?? null })
        qc.invalidateQueries({ queryKey: ['positions'] })
        onDone()
      }
    },
    onError: (error: any) => {
      const body = error?.response?.data
      if (body?.belowTarget) {
        setBelowTarget({ currentPrice: body.currentPrice!, diff: body.diff! })
      }
    },
  })

  const err = (sellMut.error as any)?.response?.data?.errors?.[0] ?? (sellMut.error as any)?.message

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      >
        <DollarSign size={12} />
        Manuel Sat
        <ChevronDown size={11} />
      </button>
    )
  }

  if (result) {
    return (
      <div className="mt-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-xs text-emerald-300 space-y-1">
        <p className="font-semibold">Satış tamamlandı ✓</p>
        <p>Fiyat: <span className="font-mono">${fmtPrice(result.fillPrice)}</span></p>
        {result.realizedPnl != null && (
          <p>K/Z: <span className={cn('font-bold', result.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {result.realizedPnl >= 0 ? '+' : ''}{formatUsdt(result.realizedPnl)}
            {result.realizedPnlPct != null && ` (${result.realizedPnlPct >= 0 ? '+' : ''}${result.realizedPnlPct.toFixed(2)}%)`}
          </span></p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 bg-white/[0.03] border border-orange-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-orange-300">Manuel Satış — {position.coinSymbol}</p>
        <button onClick={() => { setOpen(false); setMode(null); setBelowTarget(null) }} className="text-slate-500 hover:text-slate-300">
          <X size={13} />
        </button>
      </div>

      {/* Seçenek butonları */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { setMode('market'); setBelowTarget(null) }}
          className={cn('flex items-center gap-2 p-3 rounded-lg border text-left transition-colors',
            mode === 'market'
              ? 'bg-red-500/15 border-red-500/30 text-red-300'
              : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}
        >
          <Activity size={13} />
          <div>
            <p className="text-xs font-semibold">Anlık Fiyattan Sat</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Market emri — anında gerçekleşir</p>
          </div>
        </button>

        <button
          onClick={() => { setMode('limit'); setBelowTarget(null) }}
          className={cn('flex items-center gap-2 p-3 rounded-lg border text-left transition-colors',
            mode === 'limit'
              ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300'
              : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}
        >
          <DollarSign size={13} />
          <div>
            <p className="text-xs font-semibold">Belirlenmiş Fiyattan Sat</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Hedef fiyat gir, onay al</p>
          </div>
        </button>
      </div>

      {/* Limit fiyat girişi */}
      {mode === 'limit' && (
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500">Hedef Satış Fiyatı (USDT)</label>
          <div className="relative">
            <input
              type="number"
              step="any"
              value={limitPrice}
              onChange={e => { setLimitPrice(e.target.value); setBelowTarget(null) }}
              placeholder={`Giriş fiyatı: ${fmtPrice(position.entryPrice)}`}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
          </div>
        </div>
      )}

      {/* Fiyat düşük uyarısı */}
      {belowTarget && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle size={12} />
            <span>Güncel fiyat hedefin <strong>{Math.abs(belowTarget.diff).toFixed(2)}%</strong> altında!</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Güncel: <span className="text-slate-300 font-mono">${fmtPrice(belowTarget.currentPrice)}</span>
            {' · '}Hedef: <span className="text-slate-300 font-mono">${fmtPrice(parseFloat(limitPrice))}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => sellMut.mutate({ type: 'limit', limitPrice: parseFloat(limitPrice), force: true })}
              disabled={sellMut.isPending}
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {sellMut.isPending ? 'Satılıyor…' : 'Yine de Sat (Güncel Fiyattan)'}
            </button>
            <button onClick={() => setBelowTarget(null)} className="text-xs text-slate-500 hover:text-slate-300 px-2">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Hata */}
      {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={11} />{err}</p>}

      {/* Onayla */}
      {!belowTarget && (
        <button
          onClick={() => {
            if (mode === 'market') {
              sellMut.mutate({ type: 'market' })
            } else if (mode === 'limit' && limitPrice) {
              sellMut.mutate({ type: 'limit', limitPrice: parseFloat(limitPrice) })
            }
          }}
          disabled={sellMut.isPending || !mode || (mode === 'limit' && !limitPrice)}
          className="w-full bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          {sellMut.isPending ? 'İşleniyor…' : mode === 'market' ? 'Anlık Fiyattan Sat' : 'Fiyatı Kontrol Et'}
        </button>
      )}
    </div>
  )
}

// ─── Açık pozisyon kartı ─────────────────────────────────────────────────────
function OpenPositionCard({ p }: { p: SignalRecord }) {
  const qc = useQueryClient()
  const isOrphaned = !p.isVirtual && p.strategyId != null && p.strategyIsActive === false
  const livePrice = useLivePrice(p.coinSymbol)

  const entryVal = p.entryValueUsdt > 0 ? p.entryValueUsdt : p.entryPrice * p.entryQuantity
  const closeEst = livePrice != null
    ? (p.entryQuantity > 0 ? livePrice * p.entryQuantity : (p.entryPrice > 0 ? livePrice / p.entryPrice * entryVal : 0))
    : 0
  const pnlPct = livePrice != null && p.entryPrice > 0
    ? ((livePrice - p.entryPrice) / p.entryPrice) * 100
    : null
  const comm = entryVal > 0 && closeEst > 0 ? calcComm(entryVal, closeEst) : null
  const netPnlPct = pnlPct != null && comm != null ? pnlPct - comm.pct : null

  return (
    <div className={cn(
      'bg-white/[0.03] rounded-xl p-4 space-y-3 transition-colors',
      isOrphaned
        ? 'border border-orange-500/30 hover:border-orange-500/50'
        : 'border border-emerald-500/20 hover:border-emerald-500/40'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center',
            isOrphaned ? 'bg-orange-500/15' : 'bg-emerald-500/15')}>
            <span className={cn('text-xs font-bold', isOrphaned ? 'text-orange-400' : 'text-emerald-400')}>
              {p.coinSymbol.replace('USDT', '')}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-100">{p.coinSymbol}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold border',
                isOrphaned
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/20'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20')}>
                {isOrphaned ? 'STRATEJİ KAPALI' : 'AÇIK'}
              </span>
            </div>
            <span className="text-xs text-slate-500">{fmtTR(p.openedAt)} · <OpenPositionDuration openedAt={p.openedAt} /></span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-600">Süre</p>
          <p className="text-sm font-semibold text-slate-300"><OpenPositionDuration openedAt={p.openedAt} /></p>
        </div>
      </div>

      {/* Orphaned uyarısı */}
      {isOrphaned && (
        <div className="flex items-start gap-2 bg-orange-500/8 border border-orange-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-300">
            Bağlı strateji <strong>"{p.strategyName}"</strong> kapatıldı — manuel satış yapılabilir.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-600">Giriş Fiyatı</p>
          <p className="text-xs font-semibold text-slate-200 font-mono">{fmtPrice(p.entryPrice)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-600">Yatırılan</p>
          <p className="text-xs font-semibold text-slate-200 font-mono">
            {p.entryValueUsdt > 0 ? formatUsdt(p.entryValueUsdt) : '—'}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-600">Miktar</p>
          <p className="text-xs font-semibold text-slate-200 font-mono">
            {p.entryQuantity > 0
              ? `${p.entryQuantity.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} ${p.coinSymbol.replace('USDT', '')}`
              : '—'}
          </p>
        </div>
      </div>

      {/* Anlık K/Z + Komisyon satırı */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-600">Anlık Fiyat</p>
          <p className="text-xs font-semibold font-mono text-slate-100">
            {livePrice != null ? fmtPrice(livePrice) : <span className="text-slate-700">—</span>}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-600">Gerç. K/Z</p>
          {pnlPct != null ? (
            <>
              <p className={cn('text-xs font-bold font-mono tabular-nums',
                pnlPct > 0 ? 'text-emerald-400' : pnlPct < 0 ? 'text-red-400' : 'text-slate-400')}>
                {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%
              </p>
              {netPnlPct != null && (
                <p className={cn('text-[10px] font-mono tabular-nums',
                  netPnlPct > 0 ? 'text-emerald-600' : netPnlPct < 0 ? 'text-red-600' : 'text-slate-600')}>
                  {netPnlPct > 0 ? '+' : ''}{netPnlPct.toFixed(2)}% net
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-700">—</p>
          )}
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-600">Tahmini Kom. <span className="text-slate-700">(0.1%×2)</span></p>
          {comm != null ? (
            <>
              <p className="text-xs font-semibold font-mono text-slate-400">~${comm.total.toFixed(2)}</p>
              <p className="text-[10px] font-mono text-slate-600">~%{comm.pct.toFixed(2)}</p>
            </>
          ) : (
            <p className="text-xs text-slate-700">—</p>
          )}
        </div>
      </div>

      {!isOrphaned && (
        <div className="flex items-center gap-2 pt-0.5">
          <Activity size={11} className="text-emerald-500/60" />
          <span className="text-xs text-slate-600">Trailing stop takibinde · gerçek zamanlı izleniyor</span>
        </div>
      )}
      <ManualSellPanel
        position={p}
        onDone={() => qc.invalidateQueries({ queryKey: ['positions', 'real'] })}
      />
    </div>
  )
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────
type Tab = 'open' | 'closed' | 'all'

export default function PositionsPage() {
  const [tab, setTab] = useState<Tab>('open')
  const { notify, permission, requestPermission } = usePushNotification()
  const prevClosedIds = useRef<Set<string>>(new Set())

  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions', 'real'],
    queryFn: () => signalRecordsApi.list({ isVirtual: false }),
    refetchInterval: 15_000,
  })

  const open   = useMemo(() => positions?.filter(p => p.status === 'Open') ?? [], [positions])
  const closed = useMemo(() => positions?.filter(p => p.status !== 'Open') ?? [], [positions])

  // Push notification: yeni kapanan pozisyon tespit et
  useEffect(() => {
    if (!positions) return
    const newlyClosed = closed.filter(p => !prevClosedIds.current.has(p.id))
    newlyClosed.forEach(p => {
      const pnl = p.realizedPnlPct
      const sign = pnl != null && pnl >= 0 ? '+' : ''
      notify(
        `${p.coinSymbol} Pozisyonu Kapandı`,
        `${p.closeReason ?? 'Kapandı'} · P&L: ${sign}${pnl?.toFixed(2) ?? '?'}%`
      )
    })
    prevClosedIds.current = new Set(closed.map(p => p.id))
  }, [closed, notify])
  const shown  = tab === 'open' ? open : tab === 'closed' ? closed : (positions ?? [])

  // Özet istatistikler
  const totalInvested  = open.reduce((s, p) => s + p.entryValueUsdt, 0)
  const totalClosedPnl = closed.reduce((s, p) => s + (p.realizedPnl ?? 0), 0)
  const wins           = closed.filter(p => (p.realizedPnl ?? 0) > 0).length
  const winRate        = closed.length > 0 ? (wins / closed.length) * 100 : null

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'open',   label: 'Açık',   count: open.length },
    { key: 'closed', label: 'Kapalı', count: closed.length },
    { key: 'all',    label: 'Tümü',   count: positions?.length ?? 0 },
  ]

  return (
    <>
      <Header title="Pozisyonlar" />
      <div className="p-3 md:p-6 space-y-5">

        {/* Araçlar */}
        <div className="flex items-center gap-2 justify-end -mb-2">
          {permission !== 'granted' && (
            <button
              onClick={requestPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg text-xs text-yellow-400 hover:bg-yellow-400/20 transition-colors"
            >
              🔔 Kapanış bildirimleri
            </button>
          )}
          <button
            onClick={() => exportCsv('pozisyonlar', (positions ?? []).map(p => ({
              Coin: p.coinSymbol,
              Strateji: p.strategyName ?? '',
              Durum: p.status,
              Giriş: p.entryPrice,
              Çıkış: p.closePrice ?? '',
              'P&L%': p.realizedPnlPct ?? '',
              'P&L USDT': p.realizedPnl ?? '',
              Sebep: p.closeReason ?? '',
              AçılışTarihi: p.openedAt,
              KapanışTarihi: p.closedAt ?? '',
            })))}
            disabled={!positions?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <Download size={12} /> CSV
          </button>
        </div>

        {/* ── Özet Kartları ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Açık Pozisyon"
            value={String(open.length)}
            sub={open.length > 0 ? `${formatUsdt(totalInvested)} yatırıldı` : 'Aktif işlem yok'}
            icon={<Activity size={15} />}
            accent={open.length > 0 ? 'emerald' : 'slate'}
          />
          <SummaryCard
            label="Toplam Gerçekleşen K/Z"
            value={totalClosedPnl !== 0 ? `${totalClosedPnl >= 0 ? '+' : ''}${formatUsdt(totalClosedPnl)}` : '—'}
            sub={`${closed.length} kapalı pozisyon`}
            icon={totalClosedPnl >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            accent={totalClosedPnl > 0 ? 'emerald' : totalClosedPnl < 0 ? 'red' : 'slate'}
          />
          <SummaryCard
            label="Başarı Oranı"
            value={winRate !== null ? `${winRate.toFixed(1)}%` : '—'}
            sub={winRate !== null ? `${wins}K / ${closed.length - wins}K` : 'Henüz kapalı pozisyon yok'}
            icon={<Trophy size={15} />}
            accent={winRate !== null && winRate >= 55 ? 'emerald' : winRate !== null && winRate < 40 ? 'red' : 'amber'}
          />
          <SummaryCard
            label="Toplam Yatırılan (Açık)"
            value={totalInvested > 0 ? formatUsdt(totalInvested) : '—'}
            sub="Anlık açık pozisyonlar"
            icon={<Wallet size={15} />}
            accent="slate"
          />
        </div>

        {/* ── Sekmeler ── */}
        <div className="flex items-center gap-1.5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/8 border border-transparent'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                tab === t.key ? 'bg-yellow-400/20 text-yellow-300' : 'bg-white/8 text-slate-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-600">Her 15 saniyede yenilenir</span>
        </div>

        {/* ── Yükleniyor ── */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Activity size={16} className="animate-pulse" />
            <span className="text-sm">Pozisyonlar yükleniyor…</span>
          </div>
        )}

        {/* ── Boş durum ── */}
        {!isLoading && shown.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
              {tab === 'open' ? <Activity size={22} className="text-slate-700" /> : <CheckCircle2 size={22} className="text-slate-700" />}
            </div>
            <div>
              <p className="text-slate-400 font-medium">
                {tab === 'open' ? 'Açık pozisyon bulunmuyor' : tab === 'closed' ? 'Kapalı pozisyon bulunmuyor' : 'Henüz pozisyon açılmamış'}
              </p>
              <p className="text-slate-600 text-sm mt-1">
                {tab === 'open'
                  ? 'Strateji sinyal ürettiğinde pozisyon otomatik açılır'
                  : 'İşlem kapatıldığında burada görünecek'}
              </p>
            </div>
          </div>
        )}

        {/* ── Açık pozisyon kartları ── */}
        {!isLoading && tab === 'open' && open.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {open.map(p => <OpenPositionCard key={p.id} p={p} />)}
          </div>
        )}

        {/* ── Kapalı pozisyonlar tablosu ── */}
        {!isLoading && (tab === 'closed' || tab === 'all') && shown.filter(p => p.status !== 'Open').length > 0 && (
          <ClosedPositionsTable rows={shown.filter(p => p.status !== 'Open')} />
        )}

        {/* ── Tümü sekmesinde açık + kapalı birlikte ── */}
        {!isLoading && tab === 'all' && open.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Açık Pozisyonlar
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {open.map(p => <OpenPositionCard key={p.id} p={p} />)}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Kapalı pozisyonlar tablosu ──────────────────────────────────────────────
function ClosedPositionsTable({ rows }: { rows: SignalRecord[] }) {
  const totalPnl = rows.reduce((s, r) => s + (r.realizedPnl ?? 0), 0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-200">Kapalı Pozisyonlar</span>
          <span className="text-xs text-slate-600">({rows.length})</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-600">Toplam K/Z:</span>
          <span className={`font-bold ${pnlColor(totalPnl)}`}>
            {totalPnl >= 0 ? '+' : ''}{formatUsdt(totalPnl)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[750px]">
          <thead>
            <tr className="border-b border-white/5 text-[10px] text-slate-600 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Sembol</th>
              <th className="text-right px-4 py-3">Giriş</th>
              <th className="text-right px-4 py-3">Çıkış</th>
              <th className="text-right px-4 py-3">Yatırılan</th>
              <th className="text-right px-4 py-3">Net P&L</th>
              <th className="text-right px-4 py-3">P&L %</th>
              <th className="text-left px-4 py-3">Sebep</th>
              <th className="text-right px-5 py-3">Süre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map(p => {
              const pnl = p.realizedPnl ?? 0
              const pnlPct = p.realizedPnlPct ?? 0
              const isWin = pnl > 0
              const entryVal = p.entryValueUsdt > 0 ? p.entryValueUsdt : 0
              const closeVal = p.closeValueUsdt ?? 0
              const rowComm = entryVal > 0 && closeVal > 0 ? calcComm(entryVal, closeVal) : null
              const netPct = rowComm != null ? pnlPct - rowComm.pct : null
              const netIsWin = (netPct ?? 0) > 0
              return (
                <React.Fragment key={p.id}>
                <tr
                  className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isWin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {p.coinSymbol.replace('USDT', '').slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200">{p.coinSymbol}</p>
                        {p.strategyName && <p className="text-[10px] text-yellow-400/60">{p.strategyName}</p>}
                        <p className="text-[10px] text-slate-600">{fmtTR(p.openedAt)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="text-xs font-mono text-slate-300">{fmtPrice(p.entryPrice)}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="text-xs font-mono text-slate-400">
                      {p.closePrice != null ? fmtPrice(p.closePrice) : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="text-xs font-mono text-slate-400">
                      {p.entryValueUsdt > 0 ? formatUsdt(p.entryValueUsdt) : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className={`flex items-center justify-end gap-1 text-xs font-bold ${pnlColor(pnl)}`}>
                      {isWin ? <ArrowUpRight size={12} /> : pnl < 0 ? <ArrowDownRight size={12} /> : null}
                      {pnl !== 0 ? `${isWin ? '+' : ''}${formatUsdt(pnl)}` : '—'}
                    </div>
                    {rowComm != null && (
                      <div className="text-[10px] font-mono text-slate-700 text-right mt-0.5">
                        ~${rowComm.total.toFixed(2)} kom.
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className={`text-xs font-bold px-2 py-0.5 rounded-md inline-block ${
                      isWin ? 'bg-emerald-500/15 text-emerald-400'
                        : pnl < 0 ? 'bg-red-500/15 text-red-400'
                        : 'text-slate-500'
                    }`}>
                      {pnlPct !== 0 ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
                    </div>
                    {netPct != null && (
                      <div className={cn('text-[10px] font-mono tabular-nums mt-0.5',
                        netIsWin ? 'text-emerald-600' : 'text-red-600')}>
                        {netPct > 0 ? '+' : ''}{netPct.toFixed(2)}% <span className="text-slate-700">net</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      p.closeReason?.toLowerCase().includes('trailing')
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : p.closeReason?.toLowerCase().includes('stop')
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : p.closeReason?.toLowerCase().includes('manuel')
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-white/5 text-slate-500 border-white/10'
                    }`}>
                      {p.closeReason ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                      <Clock size={10} />
                      {calcDuration(p.openedAt, p.closedAt)}
                    </div>
                  </td>
                </tr>
                {expandedId === p.id && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={8} className="px-6 py-3 border-b border-white/5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <p className="text-slate-600 mb-0.5">Pozisyon ID</p>
                          <p className="text-slate-400 font-mono text-[10px] break-all">{p.id}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 mb-0.5">Açılış</p>
                          <p className="text-slate-300 font-mono">{new Date(p.openedAt).toLocaleString('tr-TR')}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 mb-0.5">Kapanış</p>
                          <p className="text-slate-300 font-mono">{p.closedAt ? new Date(p.closedAt).toLocaleString('tr-TR') : '—'}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 mb-0.5">Tahmini Komisyon</p>
                          <p className="text-slate-300 font-mono">{rowComm != null ? `~$${rowComm.total.toFixed(3)}` : '—'}</p>
                        </div>
                        {p.closePrice != null && (
                          <div>
                            <p className="text-slate-600 mb-0.5">Çıkış Değeri</p>
                            <p className="text-slate-300 font-mono">{formatUsdt(p.closeValueUsdt ?? 0)}</p>
                          </div>
                        )}
                        {netPct != null && (
                          <div>
                            <p className="text-slate-600 mb-0.5">Net P&L (kom. sonrası)</p>
                            <p className={cn('font-mono font-bold', netIsWin ? 'text-emerald-400' : 'text-red-400')}>
                              {netPct > 0 ? '+' : ''}{netPct.toFixed(3)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {rows.filter(p => (p.realizedPnl ?? 0) > 0).length} kazanç
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            {rows.filter(p => (p.realizedPnl ?? 0) < 0).length} kayıp
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {rows.filter(p => (p.realizedPnl ?? 0) > 0).length > 0 && (
            <span className="text-slate-600">
              Ort. kazanç:{' '}
              <span className="text-emerald-400 font-semibold">
                {formatUsdt(
                  rows.filter(p => (p.realizedPnl ?? 0) > 0).reduce((s, p) => s + (p.realizedPnl ?? 0), 0) /
                  rows.filter(p => (p.realizedPnl ?? 0) > 0).length
                )}
              </span>
            </span>
          )}
          {rows.filter(p => (p.realizedPnl ?? 0) < 0).length > 0 && (
            <span className="text-slate-600 ml-3">
              Ort. kayıp:{' '}
              <span className="text-red-400 font-semibold">
                {formatUsdt(
                  rows.filter(p => (p.realizedPnl ?? 0) < 0).reduce((s, p) => s + (p.realizedPnl ?? 0), 0) /
                  rows.filter(p => (p.realizedPnl ?? 0) < 0).length
                )}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
