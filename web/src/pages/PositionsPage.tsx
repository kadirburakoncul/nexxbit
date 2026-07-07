import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { signalRecordsApi } from '@/api/signals'
import type { SignalRecord } from '@/api/signals'
import { formatUsdt, pnlColor } from '@/lib/utils'
import Header from '@/components/layout/Header'
import { usePushNotification } from '@/hooks/usePushNotification'
import { exportCsv } from '@/lib/exportCsv'
import {
  TrendingUp, TrendingDown, Wallet, BarChart2,
  Clock, CheckCircle2, Activity,
  Trophy, ArrowDownRight, ArrowUpRight,
  AlertTriangle, DollarSign, X, Download, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function parseUtc(str: string): Date {
  return new Date(str.endsWith('Z') || str.includes('+') ? str : str + 'Z')
}

function fmtDate(str: string | null | undefined): string {
  if (!str) return '—'
  return parseUtc(str).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

function calcDuration(from: string, to?: string | null): string {
  const ms = (to ? parseUtc(to) : new Date()).getTime() - parseUtc(from).getTime()
  if (ms < 0) return '—'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (h >= 24) return `${Math.floor(h / 24)}g ${h % 24}s`
  if (h > 0) return `${h}s ${m}d`
  if (m > 0) return `${m}d ${s}s`
  return `${s}s`
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  const abs = Math.abs(n)
  let d: number
  if (abs >= 1000) d = 2
  else if (abs >= 1) d = 4
  else if (abs >= 0.001) d = 6
  else d = 8
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const COMM_RATE = 0.001
function calcComm(entryVal: number, closeVal: number) {
  const total = (entryVal + closeVal) * COMM_RATE
  const pct = entryVal > 0 ? (total / entryVal) * 100 : 0
  return { total, pct }
}

function useLivePrice(symbol: string): number | undefined {
  const { data } = useQuery({
    queryKey: ['live-price', symbol],
    queryFn: async () => {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`)
      return parseFloat((await res.json()).price)
    },
    refetchInterval: 5_000,
    staleTime: 4_000,
  })
  return data
}

function useLiveDuration(openedAt: string): string {
  const [, setTick] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    ref.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [])
  return calcDuration(openedAt)
}

// ─── CloseReasonBadge ─────────────────────────────────────────────────────────

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
        {pnl != null && <div className="text-[10px] text-emerald-600 mt-0.5">Hedef fiyata ulaşıldı: +{pnl.toFixed(2)}%</div>}
      </div>
    )
  }

  if (r === 'trailingstop') {
    const peakPnl = record.peakPnlPct
    const pnl = record.realizedPnlPct
    const dropFromPeak = peakPnl != null && pnl != null ? pnl - peakPnl : null
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">
          🔁 Trailing Stop
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {peakPnl != null && (
            <span>Zirve: <span className={peakPnl > 0 ? 'text-emerald-600' : 'text-red-600'}>{peakPnl > 0 ? '+' : ''}{peakPnl.toFixed(2)}%</span></span>
          )}
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
        {pnl != null && <div className="text-[10px] text-red-600 mt-0.5">Zarar kesme: {pnl.toFixed(2)}%</div>}
      </div>
    )
  }

  if (r === 'maxholdtime') {
    const pnl = record.realizedPnlPct
    const openedMs = record.openedAt ? parseUtc(record.openedAt).getTime() : null
    const closedMs = record.closedAt ? parseUtc(record.closedAt).getTime() : null
    const hours = openedMs && closedMs ? (closedMs - openedMs) / 3_600_000 : null
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

  if (r.includes('manual') || r.includes('manuel')) {
    const pnl = record.realizedPnlPct
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
          👤 Manuel Satış
        </span>
        {pnl != null && <div className={cn('text-[10px] mt-0.5', pnl > 0 ? 'text-emerald-600' : 'text-red-600')}>{pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%</div>}
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

  if (r.includes('strateji')) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/25">
          ⛔ Strateji Kapatıldı
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5 max-w-32 truncate" title={reason}>{reason}</div>
      </div>
    )
  }

  if (r.includes('t3') || r.includes('sell') || r.includes('sat')) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/25">
          📉 T3 SAT Sinyali
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">İndikatör SAT sinyali üretti</div>
      </div>
    )
  }

  return <span className="text-slate-500 text-[10px] max-w-28 block truncate" title={reason}>{reason}</span>
}

// ─── Özet kart ────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon, accent = 'slate' }: {
  label: string; value: string; sub?: string
  icon: React.ReactNode; accent?: 'slate' | 'emerald' | 'red' | 'amber'
}) {
  const ring: Record<string, string> = {
    slate: 'border-white/8 bg-white/[0.03]',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    red: 'border-red-500/20 bg-red-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
  }
  const ic: Record<string, string> = {
    slate: 'bg-white/8 text-slate-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-amber-500/20 text-amber-400',
  }
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${ring[accent]}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ic[accent]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-base font-bold text-slate-100 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Manuel Sat paneli ────────────────────────────────────────────────────────

function ManualSellPanel({ position, onDone, onClose }: {
  position: SignalRecord; onDone: () => void; onClose: () => void
}) {
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
      if (body?.belowTarget) setBelowTarget({ currentPrice: body.currentPrice!, diff: body.diff! })
    },
  })

  const err = (sellMut.error as any)?.response?.data?.errors?.[0] ?? (sellMut.error as any)?.message

  if (result) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-xs text-emerald-300 space-y-1">
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
    <div className="bg-white/[0.03] border border-orange-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-orange-300">Manuel Satış — {position.coinSymbol}</p>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={13} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { setMode('market'); setBelowTarget(null) }}
          className={cn('flex items-center gap-2 p-3 rounded-lg border text-left transition-colors',
            mode === 'market' ? 'bg-red-500/15 border-red-500/30 text-red-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}
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
            mode === 'limit' ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}
        >
          <DollarSign size={13} />
          <div>
            <p className="text-xs font-semibold">Belirlenmiş Fiyattan Sat</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Hedef fiyat gir, onay al</p>
          </div>
        </button>
      </div>
      {mode === 'limit' && (
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500">Hedef Satış Fiyatı (USDT)</label>
          <div className="relative">
            <input
              type="number" step="any" value={limitPrice}
              onChange={e => { setLimitPrice(e.target.value); setBelowTarget(null) }}
              placeholder={`Giriş fiyatı: ${fmtPrice(position.entryPrice)}`}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
          </div>
        </div>
      )}
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
            <button onClick={() => setBelowTarget(null)} className="text-xs text-slate-500 hover:text-slate-300 px-2">İptal</button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={11} />{err}</p>}
      {!belowTarget && (
        <button
          onClick={() => {
            if (mode === 'market') sellMut.mutate({ type: 'market' })
            else if (mode === 'limit' && limitPrice) sellMut.mutate({ type: 'limit', limitPrice: parseFloat(limitPrice) })
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

// ─── Açık pozisyon satırı ─────────────────────────────────────────────────────

function OpenPositionRow({ p, onSold }: { p: SignalRecord; onSold: () => void }) {
  const [selling, setSelling] = useState(false)
  const isOrphaned = p.strategyId != null && p.strategyIsActive === false
  const livePrice = useLivePrice(p.coinSymbol)
  const duration = useLiveDuration(p.openedAt)

  const entryVal = p.entryValueUsdt > 0 ? p.entryValueUsdt : p.entryPrice * p.entryQuantity
  const closeEst = livePrice != null && p.entryQuantity > 0 ? livePrice * p.entryQuantity : 0
  const pnlPct = livePrice != null && p.entryPrice > 0 ? ((livePrice - p.entryPrice) / p.entryPrice) * 100 : null
  const comm = entryVal > 0 && closeEst > 0 ? calcComm(entryVal, closeEst) : null
  const netPnlPct = pnlPct != null && comm != null ? pnlPct - comm.pct : null
  const pnlUsdt = pnlPct != null && entryVal > 0 ? (pnlPct / 100) * entryVal : null
  const pnlClass = pnlPct == null ? 'text-slate-600' : pnlPct > 0 ? 'text-emerald-400' : pnlPct < 0 ? 'text-red-400' : 'text-slate-400'

  return (
    <>
      <tr className={cn('hover:bg-white/[0.04] transition-colors', isOrphaned && 'bg-orange-500/[0.04]')}>
        {/* Coin */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0',
              isOrphaned ? 'bg-orange-500/15 text-orange-400' : 'bg-emerald-500/15 text-emerald-400')}>
              {p.coinSymbol.replace('USDT', '').slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">{p.coinSymbol}</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold border',
                  isOrphaned
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/20'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20')}>
                  {isOrphaned ? 'SAHİPSİZ' : 'AÇIK'}
                </span>
              </div>
              {p.strategyName && <p className="text-[10px] text-yellow-400/60 mt-0.5">{p.strategyName}</p>}
              {isOrphaned && <p className="text-[10px] text-orange-400/70 mt-0.5">Strateji kapatıldı</p>}
            </div>
          </div>
        </td>

        {/* Alış fiyatı + tarihi */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          <div className="text-slate-300">{fmtPrice(p.entryPrice)}</div>
          <div className="text-slate-600 text-[10px] mt-0.5">{fmtDate(p.openedAt)}</div>
        </td>

        {/* Yatırılan + Miktar */}
        <td className="px-4 py-3 text-right text-xs">
          <div className="text-slate-300 font-mono">{entryVal > 0 ? formatUsdt(entryVal) : '—'}</div>
          {p.entryQuantity > 0 && (
            <div className="text-slate-600 text-[10px] mt-0.5 font-mono">
              {p.entryQuantity.toLocaleString('en-US', { maximumFractionDigits: 6 })} {p.coinSymbol.replace('USDT', '')}
            </div>
          )}
        </td>

        {/* Anlık fiyat */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          {livePrice != null
            ? <span className="text-slate-100 font-semibold">{fmtPrice(livePrice)}</span>
            : <span className="text-slate-700">—</span>}
        </td>

        {/* En Yüksek */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          {p.peakPrice != null ? (
            <div>
              <div className="text-purple-300 font-semibold">{fmtPrice(p.peakPrice)}</div>
              {p.peakPnlPct != null && (
                <div className={cn('text-[10px] tabular-nums mt-0.5', p.peakPnlPct > 0 ? 'text-emerald-500' : 'text-red-500')}>
                  {p.peakPnlPct > 0 ? '+' : ''}{p.peakPnlPct.toFixed(2)}%
                </div>
              )}
            </div>
          ) : <span className="text-slate-700">—</span>}
        </td>

        {/* SL / TP */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          <div className="space-y-0.5">
            {p.stopLossPrice != null ? (
              <div className="flex items-center justify-end gap-1">
                <ShieldAlert size={9} className="text-red-500" />
                <span className="text-red-400 font-semibold">{fmtPrice(p.stopLossPrice)}</span>
              </div>
            ) : <div className="text-slate-700 text-[10px]">SL yok</div>}
            {p.takeProfitPrice != null ? (
              <div className="flex items-center justify-end gap-1">
                <span className="text-[9px] text-emerald-600">✅</span>
                <span className="text-emerald-400 font-semibold">{fmtPrice(p.takeProfitPrice)}</span>
              </div>
            ) : <div className="text-slate-700 text-[10px]">TP yok</div>}
            {p.trailingStopPct != null && (
              <div className="text-orange-400/70 text-[10px]">↩ {p.trailingStopPct}% trailing</div>
            )}
          </div>
        </td>

        {/* K/Z */}
        <td className="px-4 py-3 text-right">
          <div className={cn('font-mono text-sm font-semibold tabular-nums', pnlClass)}>
            {pnlPct != null ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
          </div>
          {pnlUsdt != null && (
            <div className={cn('text-[10px] font-mono tabular-nums mt-0.5', pnlUsdt > 0 ? 'text-emerald-600' : 'text-red-600')}>
              {pnlUsdt > 0 ? '+' : ''}{formatUsdt(pnlUsdt)}
            </div>
          )}
          {netPnlPct != null && (
            <div className={cn('text-[10px] font-mono tabular-nums mt-0.5', netPnlPct > 0 ? 'text-emerald-700' : 'text-red-700')}>
              {netPnlPct > 0 ? '+' : ''}{netPnlPct.toFixed(2)}% <span className="text-slate-700">net</span>
            </div>
          )}
        </td>

        {/* Süre */}
        <td className="px-4 py-3 text-right text-xs">
          <span className="font-mono text-yellow-400 font-semibold tabular-nums">{duration}</span>
        </td>

        {/* Aksiyon */}
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => setSelling(s => !s)}
            className="flex items-center gap-1 text-xs bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 font-medium px-2.5 py-1.5 rounded-lg transition-colors ml-auto"
          >
            <DollarSign size={11} /> Manuel Sat
          </button>
        </td>
      </tr>

      {selling && (
        <tr>
          <td colSpan={9} className="px-4 pb-3 pt-0">
            <ManualSellPanel position={p} onDone={onSold} onClose={() => setSelling(false)} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Açık pozisyonlar tablo bileşeni ─────────────────────────────────────────

function OpenPositionsTable({ rows, onSold }: { rows: SignalRecord[]; onSold: () => void }) {
  return (
    <div className="bg-white/[0.03] border border-emerald-500/15 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2 bg-white/[0.02]">
        <Activity size={14} className="text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">Açık Pozisyonlar</span>
        <span className="text-xs text-slate-600">({rows.length})</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Canlı izleniyor
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-white/5 text-[10px] text-slate-600 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Coin</th>
              <th className="text-right px-4 py-3">Alış</th>
              <th className="text-right px-4 py-3">Yatırılan</th>
              <th className="text-right px-4 py-3">Anlık</th>
              <th className="text-right px-4 py-3">En Yüksek</th>
              <th className="text-right px-4 py-3">SL / TP</th>
              <th className="text-right px-4 py-3">K/Z</th>
              <th className="text-right px-4 py-3">Süre</th>
              <th className="text-right px-4 py-3">Aksiyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map(r => <OpenPositionRow key={r.id} p={r} onSold={onSold} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Kapalı pozisyonlar tablosu ───────────────────────────────────────────────

function ClosedPositionsTable({ rows }: { rows: SignalRecord[] }) {
  const totalPnl = rows.reduce((s, r) => s + (r.realizedPnl ?? 0), 0)

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
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-white/5 text-[10px] text-slate-600 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Sembol</th>
              <th className="text-right px-4 py-3">Alış</th>
              <th className="text-right px-4 py-3">Satış</th>
              <th className="text-right px-4 py-3">Yatırılan → Çıkış</th>
              <th className="text-right px-4 py-3">En Yüksek</th>
              <th className="text-right px-4 py-3">Net K/Z</th>
              <th className="text-left px-4 py-3">Sebep</th>
              <th className="text-right px-4 py-3">Süre</th>
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
              const netPct = rowComm != null ? pnlPct - rowComm.pct : pnlPct
              const netIsWin = netPct > 0

              return (
                <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                  {/* Sembol */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0',
                        isWin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                        {p.coinSymbol.replace('USDT', '').slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200">{p.coinSymbol}</p>
                        {p.strategyName && <p className="text-[10px] text-yellow-400/60 mt-0.5">{p.strategyName}</p>}
                      </div>
                    </div>
                  </td>

                  {/* Alış fiyatı + tarihi */}
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    <div className="text-slate-300">{fmtPrice(p.entryPrice)}</div>
                    <div className="text-slate-600 text-[10px] mt-0.5">{fmtDate(p.openedAt)}</div>
                  </td>

                  {/* Satış fiyatı + tarihi */}
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {p.closePrice != null ? (
                      <>
                        <div className="text-slate-300">{fmtPrice(p.closePrice)}</div>
                        <div className="text-slate-600 text-[10px] mt-0.5">{fmtDate(p.closedAt)}</div>
                      </>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  {/* Yatırılan → Çıkış değeri */}
                  <td className="px-4 py-3 text-right text-xs">
                    {entryVal > 0 ? (
                      <div>
                        <div className="text-slate-400 font-mono">{formatUsdt(entryVal)}</div>
                        {closeVal > 0 && (
                          <div className={cn('text-[10px] font-mono mt-0.5', isWin ? 'text-emerald-600' : 'text-red-600')}>
                            → {formatUsdt(closeVal)}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  {/* En Yüksek */}
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {p.peakPrice != null ? (
                      <div>
                        <div className="text-purple-400/80">{fmtPrice(p.peakPrice)}</div>
                        {p.peakPnlPct != null && (
                          <div className={cn('text-[10px] tabular-nums mt-0.5',
                            p.peakPnlPct > 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {p.peakPnlPct > 0 ? '+' : ''}{p.peakPnlPct.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  {/* Net K/Z */}
                  <td className="px-4 py-3 text-right">
                    <div className={cn('flex items-center justify-end gap-1 text-xs font-bold',
                      isWin ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-slate-400')}>
                      {isWin ? <ArrowUpRight size={12} /> : pnl < 0 ? <ArrowDownRight size={12} /> : null}
                      {pnl !== 0 ? `${isWin ? '+' : ''}${formatUsdt(pnl)}` : '—'}
                    </div>
                    <div className={cn('text-[10px] font-bold font-mono tabular-nums mt-0.5 px-1.5 py-0.5 rounded-md inline-block',
                      isWin ? 'bg-emerald-500/15 text-emerald-400' : pnl < 0 ? 'bg-red-500/15 text-red-400' : 'text-slate-500')}>
                      {pnlPct !== 0 ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
                    </div>
                    {rowComm != null && (
                      <div className={cn('text-[10px] font-mono tabular-nums mt-0.5',
                        netIsWin ? 'text-emerald-700' : 'text-red-700')}>
                        {netPct > 0 ? '+' : ''}{netPct.toFixed(2)}% <span className="text-slate-700">net</span>
                      </div>
                    )}
                  </td>

                  {/* Sebep */}
                  <td className="px-4 py-3">
                    <CloseReasonBadge record={p} />
                  </td>

                  {/* Süre */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                      <Clock size={10} />
                      {calcDuration(p.openedAt, p.closedAt)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {rows.filter(p => (p.realizedPnl ?? 0) > 0).length} kazanç
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            {rows.filter(p => (p.realizedPnl ?? 0) < 0).length} kayıp
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
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
            <span className="text-slate-600">
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

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

type Tab = 'open' | 'closed' | 'all'

export default function PositionsPage() {
  const [tab, setTab] = useState<Tab>('open')
  const { notify, permission, requestPermission } = usePushNotification()
  const prevClosedIds = useRef<Set<string>>(new Set())
  const qc = useQueryClient()

  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions', 'real'],
    queryFn: () => signalRecordsApi.list({ isVirtual: false }),
    refetchInterval: 5_000,
  })

  const open   = useMemo(() => positions?.filter(p => p.status === 'Open') ?? [], [positions])
  const closed = useMemo(() => positions?.filter(p => p.status !== 'Open') ?? [], [positions])

  useEffect(() => {
    if (!positions) return
    const newlyClosed = closed.filter(p => !prevClosedIds.current.has(p.id))
    newlyClosed.forEach(p => {
      const pnl = p.realizedPnlPct
      const sign = pnl != null && pnl >= 0 ? '+' : ''
      notify(`${p.coinSymbol} Pozisyonu Kapandı`, `${p.closeReason ?? 'Kapandı'} · P&L: ${sign}${pnl?.toFixed(2) ?? '?'}%`)
    })
    prevClosedIds.current = new Set(closed.map(p => p.id))
  }, [closed, notify])

  const shown = tab === 'open' ? open : tab === 'closed' ? closed : (positions ?? [])

  const totalInvested  = open.reduce((s, p) => s + p.entryValueUsdt, 0)
  const totalClosedPnl = closed.reduce((s, p) => s + (p.realizedPnl ?? 0), 0)
  const wins    = closed.filter(p => (p.realizedPnl ?? 0) > 0).length
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : null

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'open',   label: 'Açık',   count: open.length },
    { key: 'closed', label: 'Kapalı', count: closed.length },
    { key: 'all',    label: 'Tümü',   count: positions?.length ?? 0 },
  ]

  const onSold = () => qc.invalidateQueries({ queryKey: ['positions', 'real'] })

  return (
    <>
      <Header title="Pozisyonlar" />
      <div className="p-3 md:p-6 space-y-5">

        {/* Özet Kartları */}
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

        {/* Sekmeler + Araçlar */}
        <div className="flex items-center gap-1.5 flex-wrap">
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
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-600">Her 5sn yenilenir</span>
            {permission !== 'granted' && (
              <button
                onClick={requestPermission}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg text-xs text-yellow-400 hover:bg-yellow-400/20 transition-colors"
              >
                🔔 Bildirimler
              </button>
            )}
            <button
              onClick={() => exportCsv('pozisyonlar', (positions ?? []).map(p => ({
                Coin: p.coinSymbol,
                Strateji: p.strategyName ?? '',
                Durum: p.status,
                AlışFiyatı: p.entryPrice,
                AlışTarihi: p.openedAt,
                SatışFiyatı: p.closePrice ?? '',
                SatışTarihi: p.closedAt ?? '',
                Yatırılan: p.entryValueUsdt,
                ÇıkışDeğeri: p.closeValueUsdt ?? '',
                EnYüksek: p.peakPrice ?? '',
                EnYüksekPct: p.peakPnlPct ?? '',
                'P&L%': p.realizedPnlPct ?? '',
                'P&L USDT': p.realizedPnl ?? '',
                Sebep: p.closeReason ?? '',
                SL: p.stopLossPrice ?? '',
                TP: p.takeProfitPrice ?? '',
                TrailingStop: p.trailingStopPct ?? '',
              })))}
              disabled={!positions?.length}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              <Download size={12} /> CSV
            </button>
          </div>
        </div>

        {/* Yükleniyor */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Activity size={16} className="animate-pulse" />
            <span className="text-sm">Pozisyonlar yükleniyor…</span>
          </div>
        )}

        {/* Boş durum */}
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
                {tab === 'open' ? 'Strateji sinyal ürettiğinde pozisyon otomatik açılır' : 'İşlem kapatıldığında burada görünecek'}
              </p>
            </div>
          </div>
        )}

        {/* Açık pozisyonlar */}
        {!isLoading && (tab === 'open' || tab === 'all') && open.length > 0 && (
          <OpenPositionsTable rows={open} onSold={onSold} />
        )}

        {/* Kapalı pozisyonlar */}
        {!isLoading && (tab === 'closed' || tab === 'all') && shown.filter(p => p.status !== 'Open').length > 0 && (
          <ClosedPositionsTable rows={shown.filter(p => p.status !== 'Open')} />
        )}
      </div>
    </>
  )
}
