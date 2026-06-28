import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { backtestApi } from '@/api/backtest'
import type { BacktestResult } from '@/api/backtest'
import { strategiesApi } from '@/api/strategies'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { formatUsdt, pnlColor, cn } from '@/lib/utils'
import {
  Play, TrendingUp, TrendingDown, Trash2, ChevronRight,
  FlaskConical, Layers, Clock, Target, Shield, BarChart3,
  CheckCircle2, XCircle, Loader2, AlertTriangle, Trophy,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useSignalR } from '@/hooks/useSignalR'

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  Pending:   { label: 'Kuyrukta', cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/20', icon: <Clock size={10} /> },
  Running:   { label: 'Çalışıyor', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20', icon: <Loader2 size={10} className="animate-spin" /> },
  Completed: { label: 'Tamamlandı', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20', icon: <CheckCircle2 size={10} /> },
  Failed:    { label: 'Hata', cls: 'bg-red-500/20 text-red-400 border border-red-500/20', icon: <XCircle size={10} /> },
}

const schema = z.object({
  name: z.string().min(1, 'İsim gerekli'),
  strategyId: z.string().min(1, 'Strateji seçin'),
  startDate: z.string().min(1, 'Başlangıç tarihi gerekli'),
  endDate: z.string().min(1, 'Bitiş tarihi gerekli'),
  initialCapital: z.coerce.number().min(10, 'En az 10 USDT'),
  commissionRate: z.coerce.number().min(0),
  slippagePct: z.coerce.number().min(0).max(5),
})
type FormData = z.infer<typeof schema>

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 transition-colors'
const labelCls = 'block text-xs text-slate-500 mb-1'

function StatCard({ label, value, sub, pnl }: { label: string; value: string; sub?: string; pnl?: number | null }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-base font-bold tracking-tight ${pnl !== undefined ? pnlColor(pnl) : 'text-slate-100'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function WinRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-slate-600">—</span>
  const color = rate >= 60 ? 'text-emerald-400' : rate >= 45 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`font-semibold ${color}`}>{rate.toFixed(1)}%</span>
}

export default function BacktestPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<BacktestResult | null>(null)
  const [polling, setPolling] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareResults, setCompareResults] = useState<BacktestResult[]>([])
  const [comparing, setComparing] = useState(false)
  const [tab, setTab] = useState<'runs' | 'compare'>('runs')
  const connRef = useRef<import('@microsoft/signalr').HubConnection | null>(null)

  const { connRef: signalRRef } = useSignalR({
    hubUrl: '/hubs/backtest',
    enabled: true,
    events: {
      Progress: useCallback((...args: unknown[]) => {
        const data = args[0] as { runId: string; pct: number }
        setProgress(prev => ({ ...prev, [data.runId]: data.pct }))
      }, []),
      Done: useCallback((...args: unknown[]) => {
        const data = args[0] as { runId: string }
        setProgress(prev => { const n = { ...prev }; delete n[data.runId]; return n })
        qc.invalidateQueries({ queryKey: ['backtests'] })
        setPolling(null)
      }, [qc]),
    },
  })
  connRef.current = signalRRef.current

  const { data: runs, isLoading } = useQuery({
    queryKey: ['backtests'],
    queryFn: backtestApi.list,
    refetchInterval: polling ? 3000 : false,
  })

  const { data: strategies } = useQuery({ queryKey: ['strategies'], queryFn: strategiesApi.list })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: '', strategyId: '', startDate: '', endDate: '', initialCapital: 1000, commissionRate: 0.001, slippagePct: 0.05 },
  })

  const selectedStrategyId = watch('strategyId')
  const selectedStrategy = strategies?.find(s => s.id === selectedStrategyId)

  useEffect(() => {
    if (selectedStrategy) {
      const today = new Date().toISOString().split('T')[0]
      setValue('name', `${selectedStrategy.name} — ${today}`)
    }
  }, [selectedStrategyId, selectedStrategy, setValue])

  const deleteMut = useMutation({
    mutationFn: (id: string) => backtestApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['backtests'] })
      if (selected?.id === id) setSelected(null)
    },
  })

  const start = useMutation({
    mutationFn: (d: FormData) => {
      const strat = strategies?.find(s => s.id === d.strategyId)
      return backtestApi.start({
        name: d.name,
        coinIds: strat?.coins.map(c => c.coinId) ?? [],
        timeframe: strat?.timeframe ?? '1h',
        startDate: new Date(d.startDate).toISOString(),
        endDate: new Date(d.endDate).toISOString(),
        initialCapital: d.initialCapital,
        commissionRate: d.commissionRate,
        slippagePct: d.slippagePct,
        stopLossPct: strat?.stopLossPct ?? null,
        takeProfitPct: null,
      })
    },
    onSuccess: (data) => {
      setPolling(data.runId)
      qc.invalidateQueries({ queryKey: ['backtests'] })
      // SignalR group join
      connRef.current?.invoke('JoinRun', data.runId).catch(() => {})
      setTimeout(() => setPolling(null), 300_000)
    },
  })

  const loadResult = async (runId: string) => {
    const res = await backtestApi.getResult(runId)
    setSelected(res)
  }

  const runCount = runs?.length ?? 0

  return (
    <>
      <Header title="Backtest Simülatörü" />
      <div className="p-3 md:p-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">

        {/* ── Sol panel: Form ── */}
        <div className="space-y-4">

          {/* Bilgi kartı */}
          <div className="bg-gradient-to-br from-indigo-500/8 to-purple-500/5 border border-indigo-500/15 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <FlaskConical size={14} className="text-indigo-400" />
              </div>
              <span className="text-sm font-semibold text-slate-200">Backtest Simülatörü</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Seçtiğiniz strateji ve aktif indikatör konfigürasyonunuzu{' '}
              <span className="text-slate-200 font-medium">geçmiş Binance kline verisi</span>{' '}
              üzerinde simüle ederek gerçek işlem yapmadan performansını ölçer.
            </p>
            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
              {[
                { icon: <Layers size={11} className="text-yellow-400" />, text: 'Strateji seçin → coinler, zaman dilimi ve stop ayarları otomatik alınır.' },
                { icon: <Shield size={11} className="text-emerald-400" />, text: 'Trailing Stop ve Stop Loss simülasyona dahil edilir.' },
                { icon: <BarChart3 size={11} className="text-purple-400" />, text: 'Net P&L, Win Rate, Max Drawdown ve tüm işlem detayları hesaplanır.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{item.icon}</span>
                  <p className="text-xs text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form kartı */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200">Yeni Simülasyon</h2>
              <span className="text-xs text-slate-600 tabular-nums">{runCount} / 10</span>
            </div>

            <form onSubmit={handleSubmit(d => start.mutate(d))} className="space-y-3.5">

              <div>
                <label className={labelCls}>Strateji</label>
                <select {...register('strategyId')} className={inputCls}>
                  <option value="">— Strateji seçin —</option>
                  {strategies?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.strategyId && <p className="text-xs text-red-400 mt-1">{errors.strategyId.message}</p>}
              </div>

              {selectedStrategy && (
                <div className="bg-white/5 border border-white/8 rounded-lg p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-600">Strateji Özeti</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <span className="text-slate-500">Zaman dilimi</span>
                    <span className="text-slate-100 font-mono font-medium">{selectedStrategy.timeframe}</span>
                    <span className="text-slate-500">Trailing Stop</span>
                    <span className="text-amber-400 font-mono">%{selectedStrategy.trailingStopPct}</span>
                    <span className="text-slate-500">Stop Loss</span>
                    <span className="text-red-400 font-mono">%{selectedStrategy.stopLossPct}</span>
                    <span className="text-slate-500">Coinler</span>
                    <span className="text-slate-300 break-all">{selectedStrategy.coins.map(c => c.symbol).join(', ') || '—'}</span>
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Simülasyon Adı</label>
                <input {...register('name')} className={inputCls} placeholder="Örn: AVAX Ocak 2025" />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Başlangıç Tarihi</label>
                  <input {...register('startDate')} type="date" className={inputCls} />
                  {errors.startDate && <p className="text-xs text-red-400 mt-1">{errors.startDate.message}</p>}
                </div>
                <div>
                  <label className={labelCls}>Bitiş Tarihi</label>
                  <input {...register('endDate')} type="date" className={inputCls} />
                  {errors.endDate && <p className="text-xs text-red-400 mt-1">{errors.endDate.message}</p>}
                </div>
              </div>

              <div>
                <label className={labelCls}>Başlangıç Sermayesi (USDT)</label>
                <input {...register('initialCapital')} type="number" className={inputCls} />
                {errors.initialCapital && <p className="text-xs text-red-400 mt-1">{errors.initialCapital.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Komisyon Oranı</label>
                  <input {...register('commissionRate')} type="number" step="0.0001" className={inputCls} />
                  <p className="text-[10px] text-slate-600 mt-1">Varsayılan: 0.001 (%0.1)</p>
                </div>
                <div>
                  <label className={labelCls}>Slippage %</label>
                  <input {...register('slippagePct')} type="number" step="0.01" min="0" max="5" className={inputCls} />
                  <p className="text-[10px] text-slate-600 mt-1">Varsayılan: 0.05 (%0.05)</p>
                </div>
              </div>

              {start.error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} />
                  {(start.error as any)?.response?.data?.message ?? 'Backtest başlatılamadı'}
                </div>
              )}

              <button
                type="submit"
                disabled={start.isPending || !selectedStrategy || runCount >= 10}
                className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2.5 rounded-lg text-sm transition-colors"
              >
                {start.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Başlatılıyor…</>
                  : <><Play size={14} /> Simülasyonu Çalıştır</>}
              </button>
              {runCount >= 10 && (
                <p className="text-xs text-slate-500 text-center">Limit: 10 backtest. Yeni eklemek için eskilerini silin.</p>
              )}
            </form>
          </div>
        </div>

        {/* ── Sağ panel: Listesi + Detay ── */}
        <div className="space-y-5 min-w-0">

          {/* Sekmeler */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
            <button
              onClick={() => setTab('runs')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === 'runs' ? 'bg-yellow-400 text-black' : 'text-slate-400 hover:text-slate-200')}
            >
              <FlaskConical size={13} /> Simülasyonlar
            </button>
            <button
              onClick={() => setTab('compare')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === 'compare' ? 'bg-yellow-400 text-black' : 'text-slate-400 hover:text-slate-200')}
            >
              <Layers size={13} /> Karşılaştır {compareIds.length > 0 && `(${compareIds.length})`}
            </button>
          </div>

          {/* Karşılaştırma tablosu */}
          {tab === 'compare' && (
            <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">Strateji Karşılaştırma</span>
                <div className="flex items-center gap-3">
                  {compareIds.length > 0 && (
                    <button
                      disabled={comparing}
                      onClick={async () => {
                        setComparing(true)
                        const results = await Promise.all(compareIds.map(id => backtestApi.getResult(id)))
                        setCompareResults(results)
                        setComparing(false)
                      }}
                      className="text-xs bg-yellow-400 text-black px-3 py-1.5 rounded-lg font-medium hover:bg-yellow-300 disabled:opacity-50 transition-colors"
                    >
                      {comparing ? 'Yükleniyor…' : 'Karşılaştır'}
                    </button>
                  )}
                  {compareIds.length > 0 && (
                    <button onClick={() => { setCompareIds([]); setCompareResults([]) }}
                      className="text-xs text-slate-500 hover:text-slate-300">Temizle</button>
                  )}
                </div>
              </div>
              {compareIds.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-10">
                  Simülasyonlar sekmesinden karşılaştırmak istediğiniz run'ları seçin (checkbox).
                </p>
              )}
              {compareResults.length >= 2 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 text-xs text-slate-500">
                        <th className="text-left px-5 py-3">Metrik</th>
                        {compareResults.map(r => (
                          <th key={r.id} className="text-right px-5 py-3 truncate max-w-[120px]">{r.name || r.id.slice(0, 8)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[
                        { label: 'Net P&L', key: 'netPnl', fmt: (v: number | null) => v != null ? formatUsdt(v) : '—', winMax: true },
                        { label: 'Net P&L %', key: 'netPnlPct', fmt: (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—', winMax: true },
                        { label: 'Win Rate', key: 'winRate', fmt: (v: number | null) => v != null ? `${v.toFixed(1)}%` : '—', winMax: true },
                        { label: 'Toplam İşlem', key: 'totalTrades', fmt: (v: number | null) => v?.toString() ?? '—', winMax: false },
                        { label: 'Max Drawdown', key: 'maxDrawdown', fmt: (v: number | null) => v != null ? `${v.toFixed(2)}%` : '—', winMax: false },
                        { label: 'Sharpe Ratio', key: 'sharpeRatio', fmt: (v: number | null) => v?.toFixed(3) ?? '—', winMax: true },
                      ].map(({ label, key, fmt, winMax }) => {
                        const vals = compareResults.map(r => (r as any)[key] as number | null)
                        const numVals = vals.filter(v => v != null) as number[]
                        const best = numVals.length > 0 ? (winMax ? Math.max(...numVals) : Math.min(...numVals)) : null
                        return (
                          <tr key={key} className="hover:bg-white/5">
                            <td className="px-5 py-3 text-slate-400 font-medium text-xs">{label}</td>
                            {vals.map((v, i) => (
                              <td key={i} className={cn('px-5 py-3 text-right font-mono text-xs',
                                v != null && best != null && v === best ? 'text-emerald-400 font-bold' : 'text-slate-300')}>
                                {fmt(v)}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Liste */}
          {tab === 'runs' && <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Geçmiş Simülasyonlar</span>
              <span className="text-xs text-slate-600">{runCount} kayıt · max 10, max 30 gün</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Yükleniyor…
              </div>
            ) : runs?.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  <FlaskConical size={20} className="text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">Henüz simülasyon çalıştırılmadı</p>
                <p className="text-slate-600 text-xs">Bir strateji seçip başlatın</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {runs?.map(r => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.Pending
                  const isSelected = selected?.id === r.id
                  const isChecked = compareIds.includes(r.id)
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        'flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-white/5 group',
                        isSelected && 'bg-yellow-400/5 border-l-2 border-yellow-400 pl-[18px]'
                      )}
                      onClick={() => r.status === 'Completed' ? loadResult(r.id) : undefined}
                    >
                      {/* Checkbox karşılaştırma için */}
                      {r.status === 'Completed' && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            e.stopPropagation()
                            setCompareIds(prev => isChecked
                              ? prev.filter(id => id !== r.id)
                              : [...prev, r.id])
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 accent-yellow-400 shrink-0"
                        />
                      )}
                      {/* Sol: isim + tarih */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{r.name || r.timeframe}</p>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${meta.cls}`}>
                            {meta.icon}{meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {format(new Date(r.createdAt), 'd MMM yyyy, HH:mm', { locale: tr })}
                          {' · '}
                          {formatDistanceToNow(new Date(r.createdAt), { locale: tr, addSuffix: true })}
                        </p>
                        {r.status === 'Running' && progress[r.id] !== undefined && (
                          <div className="mt-1.5">
                            <div className="w-full bg-white/10 rounded-full h-1.5">
                              <div
                                className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${progress[r.id]}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-yellow-400/70 mt-0.5">{progress[r.id]}% tamamlandı</p>
                          </div>
                        )}
                        {r.status === 'Failed' && r.errorMessage && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle size={10} />{r.errorMessage}
                          </p>
                        )}
                      </div>

                      {/* Orta: metrikler */}
                      {r.status === 'Completed' && (
                        <div className="flex items-center gap-5 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-600">Net P&L</p>
                            <p className={`text-sm font-bold ${pnlColor(r.netPnl)}`}>
                              {r.netPnl != null ? formatUsdt(r.netPnl) : '—'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-600">Win Rate</p>
                            <WinRateBadge rate={r.winRate} />
                          </div>
                        </div>
                      )}

                      {/* Sağ: aksiyonlar */}
                      <div className="flex items-center gap-1 shrink-0">
                        {r.status === 'Completed' && (
                          <ChevronRight size={14} className={cn('transition-colors', isSelected ? 'text-yellow-400' : 'text-slate-700 group-hover:text-slate-500')} />
                        )}
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (confirm(`"${r.name}" simülasyonu silinsin mi?`)) deleteMut.mutate(r.id)
                          }}
                          disabled={deleteMut.isPending}
                          className="p-1.5 text-slate-700 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>} {/* tab === 'runs' bitiş */}

          {/* Detay paneli */}
          {selected && tab === 'runs' && <ResultDetail result={selected} onClose={() => setSelected(null)} />}
        </div>
      </div>
    </>
  )
}

// ─── Sonuç detayı ────────────────────────────────────────────────────────────
function ResultDetail({ result, onClose }: { result: BacktestResult; onClose: () => void }) {
  const wins = result.trades.filter(t => (t.pnlUsdt ?? 0) > 0).length
  const losses = result.trades.filter(t => (t.pnlUsdt ?? 0) < 0).length
  const avgWin = wins > 0
    ? result.trades.filter(t => (t.pnlUsdt ?? 0) > 0).reduce((s, t) => s + (t.pnlUsdt ?? 0), 0) / wins
    : 0
  const avgLoss = losses > 0
    ? result.trades.filter(t => (t.pnlUsdt ?? 0) < 0).reduce((s, t) => s + (t.pnlUsdt ?? 0), 0) / losses
    : 0

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
      {/* Başlık */}
      <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between bg-white/[0.02]">
        <div>
          <h3 className="font-semibold text-slate-100">{result.name || result.timeframe}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {result.timeframe} · {result.totalTrades ?? 0} işlem
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-slate-600 hover:text-slate-400 px-2 py-1 rounded hover:bg-white/5 transition-colors">
          Kapat ✕
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Ana metrikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Net P&L"
            value={result.netPnl != null ? formatUsdt(result.netPnl) : '—'}
            sub={result.netPnlPct != null ? `${(result.netPnlPct >= 0 ? '+' : '')}${result.netPnlPct.toFixed(2)}%` : undefined}
            pnl={result.netPnl}
          />
          <StatCard label="Başlangıç Sermayesi" value={formatUsdt(result.initialCapital)} />
          <StatCard
            label="Final Sermaye"
            value={result.finalCapital != null ? formatUsdt(result.finalCapital) : '—'}
            pnl={result.netPnl}
          />
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Win Rate</p>
            <div className="text-base font-bold">
              <WinRateBadge rate={result.winRate} />
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{wins}K / {losses}K</p>
          </div>
        </div>

        {/* İkincil metrikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Toplam İşlem" value={String(result.totalTrades ?? '—')} />
          <StatCard label="Max Drawdown" value={result.maxDrawdown != null ? `${result.maxDrawdown.toFixed(2)}%` : '—'} pnl={result.maxDrawdown ? -1 : null} />
          <StatCard label="Ortalama Kazanç" value={avgWin !== 0 ? formatUsdt(avgWin) : '—'} pnl={avgWin} />
          <StatCard label="Ortalama Kayıp" value={avgLoss !== 0 ? formatUsdt(avgLoss) : '—'} pnl={avgLoss} />
        </div>

        {/* İşlem tablosu */}
        {result.trades.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target size={13} className="text-slate-500" />
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">İşlem Geçmişi ({result.trades.length})</h4>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/8">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/8 text-slate-600 uppercase tracking-wider">
                    <th className="text-left py-2.5 px-3">Coin</th>
                    <th className="text-left py-2.5 px-3">Yön</th>
                    <th className="text-right py-2.5 px-3">Giriş</th>
                    <th className="text-right py-2.5 px-3">Çıkış</th>
                    <th className="text-right py-2.5 px-3">P&L</th>
                    <th className="text-right py-2.5 px-3 hidden sm:table-cell">P&L %</th>
                    <th className="text-right py-2.5 px-3 hidden sm:table-cell">Sebep</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.trades.map(t => {
                    const pnl = t.pnlUsdt ?? 0
                    const isWin = pnl > 0
                    return (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-200">{t.coinSymbol}</td>
                        <td className="py-2 px-3">
                          {t.side === 'Buy'
                            ? <span className="inline-flex items-center gap-1 text-emerald-400 font-medium"><TrendingUp size={10} />AL</span>
                            : <span className="inline-flex items-center gap-1 text-red-400 font-medium"><TrendingDown size={10} />SAT</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">{t.entryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400">
                          {t.exitPrice != null ? t.exitPrice.toLocaleString('tr-TR', { maximumFractionDigits: 6 }) : <span className="text-slate-700">—</span>}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${pnlColor(pnl)}`}>
                          {pnl !== 0
                            ? <span className="inline-flex items-center gap-1">{isWin ? <Trophy size={9} /> : null}{formatUsdt(pnl)}</span>
                            : '—'}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium hidden sm:table-cell ${pnlColor(pnl)}`}>
                          {t.pnlPct != null ? `${(t.pnlPct >= 0 ? '+' : '')}${t.pnlPct.toFixed(2)}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 hidden sm:table-cell">{t.exitReason ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
