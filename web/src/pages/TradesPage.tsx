import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { tradesApi } from '@/api/trades'
import { coinsApi } from '@/api/coins'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Header from '@/components/layout/Header'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { formatUsdt, pnlColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

const ORDER_SIDE: Record<number, { label: string; color: string; icon: React.ElementType }> = {
  0: { label: 'AL',  color: 'text-emerald-400', icon: TrendingUp },
  1: { label: 'SAT', color: 'text-red-400',     icon: TrendingDown },
}

const ORDER_STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Bekliyor', cls: 'bg-slate-500/20 text-slate-400' },
  1: { label: 'Dolduruldu', cls: 'bg-emerald-500/20 text-emerald-400' },
  2: { label: 'İptal',   cls: 'bg-red-500/20 text-red-400' },
  3: { label: 'Hata',    cls: 'bg-orange-500/20 text-orange-400' },
}

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50'

const manualSchema = z.object({
  coinId: z.coerce.number().min(1, 'Coin seçiniz'),
  symbol: z.string().min(1),
  side: z.coerce.number(),
  quoteQty: z.coerce.number().min(1, 'Min. 1 USDT'),
})
type ManualFormData = z.infer<typeof manualSchema>

export default function TradesPage() {
  const [filterStatus, setFilterStatus] = useState<number | ''>('')
  const [filterCoin, setFilterCoin] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [manualResult, setManualResult] = useState<string | null>(null)

  const { data: coins } = useQuery({ queryKey: ['coins'], queryFn: coinsApi.list })

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['orders', filterStatus, filterCoin, page],
    queryFn: () => tradesApi.getOrders({
      status: filterStatus !== '' ? Number(filterStatus) : undefined,
      coinId: filterCoin !== '' ? Number(filterCoin) : undefined,
      pageNumber: page,
      pageSize: 20,
    }),
  })

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema) as any,
    defaultValues: { side: 0, quoteQty: 100, symbol: '', coinId: 0 },
  })

  const placeOrder = useMutation({
    mutationFn: tradesApi.placeManual,
    onSuccess: () => {
      setManualResult('Emir başarıyla gönderildi.')
      refetch()
      setTimeout(() => setManualResult(null), 5000)
    },
    onError: () => setManualResult('Emir gönderilemedi — API hatası.'),
  })

  const watchCoinId = watch('coinId')
  const selectedCoin = coins?.find(c => c.id === Number(watchCoinId))
  if (selectedCoin) setValue('symbol', selectedCoin.symbol)

  const watchSide = watch('side')

  return (
    <>
      <Header title="Emir Geçmişi" />
      <div className="p-6 space-y-6 max-w-5xl">

        {/* Manuel Emir Formu */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Manuel Emir</h2>

          {/* Withdrawal uyarısı */}
          <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-4">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              Yalnızca Spot Market emri verilir. Kaldıraç veya withdrawal işlemi kesinlikle yapılmaz.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(d => placeOrder.mutate({ ...d, side: Number(d.side), coinId: Number(d.coinId), quoteQty: Number(d.quoteQty) }))}
            className="grid grid-cols-4 gap-4 items-end"
          >
            <div>
              <label className="block text-xs text-slate-400 mb-1">Coin</label>
              <select {...register('coinId')} className={inputCls}>
                <option value="">Seçin…</option>
                {coins?.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
              {errors.coinId && <p className="text-xs text-red-400 mt-1">{errors.coinId.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Yön</label>
              <select {...register('side')} className={inputCls}>
                <option value={0}>AL (Buy)</option>
                <option value={1}>SAT (Sell)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tutar (USDT)</label>
              <input {...register('quoteQty')} type="number" step="1" min="1" className={inputCls} />
              {errors.quoteQty && <p className="text-xs text-red-400 mt-1">{errors.quoteQty.message}</p>}
            </div>
            <div>
              <button
                type="submit"
                disabled={isSubmitting || placeOrder.isPending}
                className={cn(
                  'w-full flex items-center justify-center gap-2 font-semibold py-2 rounded-lg text-sm transition-colors disabled:opacity-50',
                  Number(watchSide) === 0
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                    : 'bg-red-500 hover:bg-red-400 text-white',
                )}
              >
                {Number(watchSide) === 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {placeOrder.isPending ? 'Gönderiliyor…' : Number(watchSide) === 0 ? 'AL' : 'SAT'}
              </button>
            </div>
          </form>
          {manualResult && (
            <p className={cn('text-sm mt-3', manualResult.includes('başarıyla') ? 'text-emerald-400' : 'text-red-400')}>
              {manualResult}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={filterCoin}
            onChange={e => { setFilterCoin(e.target.value === '' ? '' : Number(e.target.value)); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
          >
            <option value="">Tüm Coinler</option>
            {coins?.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value === '' ? '' : Number(e.target.value)); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
          >
            <option value="">Tüm Durumlar</option>
            {Object.entries(ORDER_STATUS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        {/* Orders table */}
        <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                <th className="text-left px-5 py-3">Coin</th>
                <th className="text-left px-5 py-3">Yön</th>
                <th className="text-right px-5 py-3">Adet</th>
                <th className="text-right px-5 py-3">Fiyat</th>
                <th className="text-right px-5 py-3">P&L</th>
                <th className="text-left px-5 py-3">Durum</th>
                <th className="text-right px-5 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Yükleniyor…</td></tr>
              )}
              {!isLoading && orders?.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Emir bulunamadı.</td></tr>
              )}
              {orders?.map(o => {
                const side = ORDER_SIDE[o.side] ?? ORDER_SIDE[0]
                const status = ORDER_STATUS[o.status] ?? ORDER_STATUS[0]
                const SideIcon = side.icon
                return (
                  <tr key={o.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-200">{o.coinSymbol}</td>
                    <td className="px-5 py-3">
                      <span className={cn('flex items-center gap-1.5 font-medium', side.color)}>
                        <SideIcon size={12} />{side.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">{o.quantity.toFixed(6)}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">{formatUsdt(o.price)}</td>
                    <td className={cn('px-5 py-3 text-right font-medium', pnlColor(o.realizedPnl))}>
                      {o.realizedPnl != null ? formatUsdt(o.realizedPnl) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', status.cls)}>{status.label}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-500">
                      {format(new Date(o.createdAt), 'dd MMM yy HH:mm', { locale: tr })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-3 justify-end text-sm">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg disabled:opacity-40 text-slate-300 hover:bg-white/10 transition-colors"
          >
            ← Önceki
          </button>
          <span className="text-slate-500">Sayfa {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(orders?.length ?? 0) < 20}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg disabled:opacity-40 text-slate-300 hover:bg-white/10 transition-colors"
          >
            Sonraki →
          </button>
        </div>
      </div>
    </>
  )
}
