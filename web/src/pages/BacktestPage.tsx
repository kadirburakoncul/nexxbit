import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { backtestApi } from '@/api/backtest'
import type { BacktestResult } from '@/api/backtest'
import { strategiesApi } from '@/api/strategies'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { formatUsdt, pnlColor, cn } from '@/lib/utils'
import {
  Play, TrendingUp, TrendingDown, Trash2,
  Info, FlaskConical, BarChart2, Layers,
} from 'lucide-react'
import Header from '@/components/layout/Header'

const STATUS_BG: Record<string, string> = {
  Pending: 'bg-slate-500/20 text-slate-400',
  Running: 'bg-yellow-500/20 text-yellow-400',
  Completed: 'bg-emerald-500/20 text-emerald-400',
  Failed: 'bg-red-500/20 text-red-400',
}

const schema = z.object({
  name: z.string().min(1, 'İsim gerekli'),
  strategyId: z.string().min(1, 'Strateji seçin'),
  startDate: z.string().min(1, 'Başlangıç tarihi gerekli'),
  endDate: z.string().min(1, 'Bitiş tarihi gerekli'),
  initialCapital: z.coerce.number().min(10),
  commissionRate: z.coerce.number().min(0),
})
type FormData = z.infer<typeof schema>

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50'

export default function BacktestPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<BacktestResult | null>(null)
  const [polling, setPolling] = useState<string | null>(null)

  const { data: runs, isLoading } = useQuery({
    queryKey: ['backtests'],
    queryFn: backtestApi.list,
    refetchInterval: polling ? 3000 : false,
  })

  const { data: strategies } = useQuery({ queryKey: ['strategies'], queryFn: strategiesApi.list })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '', strategyId: '',
      startDate: '', endDate: '',
      initialCapital: 1000, commissionRate: 0.001,
    },
  })

  const selectedStrategyId = watch('strategyId')
  const selectedStrategy = strategies?.find(s => s.id === selectedStrategyId)

  // Strateji seçilince name'i otomatik öner
  useEffect(() => {
    if (selectedStrategy) {
      const today = new Date().toISOString().split('T')[0]
      setValue('name', `${selectedStrategy.name} - ${today}`)
    }
  }, [selectedStrategyId, selectedStrategy, setValue])

  const deleteMut = useMutation({
    mutationFn: (id: string) => backtestApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backtests'] })
      setSelected(s => s?.id === undefined ? null : s)
    },
    onError: (e: any) => alert(`Silinemedi: ${e?.response?.data?.message ?? e.message}`),
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
        stopLossPct: strat?.stopLossPct ?? null,
        takeProfitPct: null,
      })
    },
    onSuccess: (data) => {
      setPolling(data.runId)
      qc.invalidateQueries({ queryKey: ['backtests'] })
      setTimeout(() => setPolling(null), 120_000)
    },
    onError: (e: any) => alert(`Başlatılamadı: ${e?.response?.data?.message ?? e.message}`),
  })

  const loadResult = async (runId: string) => {
    const res = await backtestApi.getResult(runId)
    setSelected(res)
  }

  return (
    <>
      <Header title="Backtest" />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Form */}
        <div className="lg:col-span-1 space-y-4">

          {/* Açıklama */}
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-400">
              <Info size={15} />
              <span className="text-sm font-semibold">Backtest Nedir?</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Seçtiğiniz stratejiyi <span className="text-slate-200">geçmiş Binance verisi</span> üzerinde simüle ederek
              gerçek işlem yapmadan performansını ölçer. T3 indikatörünün AL/SAT sinyalleri çalıştırılır;
              stratejinizdeki Trailing Stop ve Stop Loss değerleri otomatik uygulanır.
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-start gap-2">
                <Layers size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500"><span className="text-slate-300">Strateji seçin</span> → coinler, zaman dilimi ve stop ayarları otomatik alınır.</p>
              </div>
              <div className="flex items-start gap-2">
                <FlaskConical size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500"><span className="text-slate-300">Tarih aralığı</span> ve başlangıç sermayesini girin, başlatın.</p>
              </div>
              <div className="flex items-start gap-2">
                <BarChart2 size={12} className="text-purple-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500">Sonuçlarda <span className="text-slate-300">Net P&L, Win Rate, Max Drawdown</span> ve tüm işlemler görünür.</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">Yeni Backtest</h2>
            <form onSubmit={handleSubmit(d => start.mutate(d))} className="space-y-3">

              {/* Strateji seçici */}
              <div>
                <label className="text-xs text-slate-400">Strateji</label>
                <select {...register('strategyId')} className={inputCls}>
                  <option value="">— Strateji seçin —</option>
                  {strategies?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.strategyId && <p className="text-xs text-red-400 mt-0.5">{errors.strategyId.message}</p>}
              </div>

              {/* Strateji ayarları özeti */}
              {selectedStrategy && (
                <div className="bg-white/5 border border-white/8 rounded-lg p-3 space-y-1.5 text-xs">
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">Strateji Ayarları (otomatik)</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-slate-500">Zaman dilimi</span>
                    <span className="text-slate-200 font-mono">{selectedStrategy.timeframe}</span>
                    <span className="text-slate-500">Trailing Stop</span>
                    <span className="text-yellow-400 font-mono">%{selectedStrategy.trailingStopPct}</span>
                    <span className="text-slate-500">Stop Loss</span>
                    <span className="text-red-400 font-mono">%{selectedStrategy.stopLossPct}</span>
                    <span className="text-slate-500">Coinler</span>
                    <span className="text-slate-200">{selectedStrategy.coins.map(c => c.symbol).join(', ') || '—'}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400">Test Adı</label>
                <input {...register('name')} className={inputCls} placeholder="BTC 1h Ocak 2025" />
                {errors.name && <p className="text-xs text-red-400 mt-0.5">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Başlangıç</label>
                  <input {...register('startDate')} type="date" className={inputCls} />
                  {errors.startDate && <p className="text-xs text-red-400 mt-0.5">{errors.startDate.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-400">Bitiş</label>
                  <input {...register('endDate')} type="date" className={inputCls} />
                  {errors.endDate && <p className="text-xs text-red-400 mt-0.5">{errors.endDate.message}</p>}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Başlangıç Sermaye (USDT)</label>
                <input {...register('initialCapital')} type="number" className={inputCls} />
                {errors.initialCapital && <p className="text-xs text-red-400 mt-0.5">{errors.initialCapital.message}</p>}
              </div>

              <div>
                <label className="text-xs text-slate-400">Komisyon Oranı</label>
                <input {...register('commissionRate')} type="number" step="0.0001" className={inputCls} />
                <p className="text-[10px] text-slate-600 mt-0.5">Binance Spot varsayılan: 0.001 (%0.1)</p>
              </div>

              {start.error && (
                <p className="text-xs text-red-400">{(start.error as any)?.response?.data?.message ?? 'Hata oluştu'}</p>
              )}

              <button type="submit" disabled={start.isPending || !selectedStrategy}
                className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold py-2 rounded-lg text-sm transition-colors"
              >
                <Play size={14} /> {start.isPending ? 'Başlatılıyor…' : 'Çalıştır'}
              </button>
            </form>
          </div>
        </div>

        {/* Run List + Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* List */}
          <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 text-sm font-semibold text-slate-200">
              Geçmiş Backtest'ler
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                  <th className="text-left px-5 py-3">İsim</th>
                  <th className="text-left px-5 py-3">Durum</th>
                  <th className="text-right px-5 py-3">Net P&L</th>
                  <th className="text-right px-5 py-3">Win Rate</th>
                  <th className="text-right px-5 py-3">Tarih</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading && <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500">Yükleniyor…</td></tr>}
                {!isLoading && runs?.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500">Henüz backtest yok</td></tr>}
                {runs?.map(r => (
                  <>
                    <tr key={r.id} className={cn('hover:bg-white/5 cursor-pointer transition-colors', selected?.id === r.id && 'bg-yellow-400/5')} onClick={() => loadResult(r.id)}>
                      <td className="px-5 py-3 font-medium text-slate-200 max-w-[180px] truncate" title={r.name}>{r.name || r.timeframe}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BG[r.status] ?? STATUS_BG.Pending}`}>{r.status}</span>
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${pnlColor(r.netPnl)}`}>
                        {r.netPnl != null ? formatUsdt(r.netPnl) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-300">
                        {r.winRate != null ? `${(r.winRate * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500 text-xs">
                        {format(new Date(r.createdAt), 'dd MMM yy', { locale: tr })}
                      </td>
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { if (confirm(`"${r.name || r.timeframe}" silinsin mi?`)) deleteMut.mutate(r.id) }}
                          disabled={deleteMut.isPending}
                          title="Sil"
                          className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {r.status === 'Failed' && r.errorMessage && (
                      <tr key={`${r.id}-err`}>
                        <td colSpan={6} className="px-5 pb-3 text-xs text-red-400 bg-red-500/5">
                          ⚠ {r.errorMessage}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail */}
          {selected && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-200">{selected.name || selected.timeframe}</h3>
                <button onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-slate-300">Kapat</button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Başlangıç', val: formatUsdt(selected.initialCapital) },
                  { label: 'Final', val: selected.finalCapital != null ? formatUsdt(selected.finalCapital) : '—' },
                  { label: 'Net P&L', val: selected.netPnl != null ? formatUsdt(selected.netPnl) : '—', pnl: selected.netPnl },
                  { label: 'P&L %', val: selected.netPnlPct != null ? `${(selected.netPnlPct * 100).toFixed(2)}%` : '—', pnl: selected.netPnlPct },
                  { label: 'Win Rate', val: selected.winRate != null ? `${(selected.winRate * 100).toFixed(1)}%` : '—' },
                  { label: 'Toplam İşlem', val: String(selected.totalTrades ?? '—') },
                  { label: 'Max Drawdown', val: selected.maxDrawdown != null ? `${(selected.maxDrawdown * 100).toFixed(2)}%` : '—' },
                  { label: 'Sharpe', val: selected.sharpeRatio?.toFixed(2) ?? '—' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-sm font-semibold mt-0.5 ${s.pnl !== undefined ? pnlColor(s.pnl) : 'text-slate-100'}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {selected.trades.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-500 uppercase">
                        <th className="text-left py-2 px-2">Coin</th>
                        <th className="text-left py-2 px-2">Yön</th>
                        <th className="text-right py-2 px-2">Giriş</th>
                        <th className="text-right py-2 px-2">Çıkış</th>
                        <th className="text-right py-2 px-2">P&L</th>
                        <th className="text-right py-2 px-2">Sebep</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selected.trades.map(t => (
                        <tr key={t.id} className="hover:bg-white/5">
                          <td className="py-1.5 px-2 text-slate-300">{t.coinSymbol}</td>
                          <td className="py-1.5 px-2">
                            {t.side === 'Buy'
                              ? <span className="flex items-center gap-1 text-emerald-400"><TrendingUp size={10} />AL</span>
                              : <span className="flex items-center gap-1 text-red-400"><TrendingDown size={10} />SAT</span>}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-300">{t.entryPrice.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-400">{t.exitPrice?.toLocaleString() ?? '—'}</td>
                          <td className={`py-1.5 px-2 text-right font-medium ${pnlColor(t.pnlUsdt)}`}>
                            {t.pnlUsdt != null ? formatUsdt(t.pnlUsdt) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-500">{t.exitReason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
