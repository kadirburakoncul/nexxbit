import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tradesApi } from '@/api/trades'
import { coinsApi } from '@/api/coins'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Header from '@/components/layout/Header'
import EmptyState from '@/components/EmptyState'
import { SkeletonTable } from '@/components/Skeleton'
import { TrendingUp, TrendingDown, AlertTriangle, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { formatUsdt, pnlColor } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useTableSort } from '@/hooks/useTableSort'
import { exportCsv } from '@/lib/exportCsv'
import { useHotkey } from '@/hooks/useHotkey'

const ORDER_SIDE: Record<number, { label: string; color: string; icon: React.ElementType }> = {
  0: { label: 'AL',  color: 'text-emerald-400', icon: TrendingUp },
  1: { label: 'SAT', color: 'text-red-400',     icon: TrendingDown },
}

const ORDER_STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Bekliyor',   cls: 'bg-slate-500/20 text-slate-400' },
  1: { label: 'Dolduruldu', cls: 'bg-emerald-500/20 text-emerald-400' },
  2: { label: 'İptal',      cls: 'bg-red-500/20 text-red-400' },
  3: { label: 'Hata',       cls: 'bg-orange-500/20 text-orange-400' },
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
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

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
    mode: 'onBlur',
    defaultValues: { side: 0, quoteQty: 100, symbol: '', coinId: 0 },
  })

  const placeOrder = useMutation({
    mutationFn: tradesApi.placeManual,
    onSuccess: () => {
      toast.success('Emir başarıyla gönderildi')
      refetch()
    },
  })

  const watchCoinId = watch('coinId')
  const watchSide = watch('side')

  useEffect(() => {
    const coin = coins?.find(c => c.id === Number(watchCoinId))
    if (coin) setValue('symbol', coin.symbol)
  }, [watchCoinId, coins, setValue])

  // Shortcut: R → sayfayı yenile
  useHotkey('r', () => refetch(), [refetch])

  // Sort
  const { sorted, toggle, indicator } = useTableSort(orders, 'createdAt')

  // Özet istatistikler
  const filled = orders?.filter(o => o.status === 1) ?? []
  const totalPnl = filled.reduce((s, o) => s + (o.realizedPnl ?? 0), 0)

  function handleExport() {
    if (!orders?.length) return
    exportCsv('emirler', orders.map(o => ({
      Coin: o.coinSymbol,
      Yön: ORDER_SIDE[o.side]?.label ?? o.side,
      Kaynak: o.isAutomatic ? 'Otomatik' : 'Manuel',
      Adet: o.quantity,
      Fiyat: o.price,
      'P&L': o.realizedPnl ?? '',
      Durum: ORDER_STATUS[o.status]?.label ?? o.status,
      Tarih: o.createdAt,
    })))
    toast.success('CSV indirildi')
  }

  const thCls = 'text-left px-4 py-3 cursor-pointer select-none hover:text-slate-300 transition-colors'

  return (
    <>
      <Header title="İşlem Günlüğü" />
      <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-5xl">

        {/* Özet kartlar */}
        {filled.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Toplam Emir', value: filled.length.toString() },
              { label: 'Al', value: filled.filter(o => o.side === 0).length.toString(), cls: 'text-emerald-400' },
              { label: 'Sat', value: filled.filter(o => o.side === 1).length.toString(), cls: 'text-red-400' },
              { label: 'Otomatik', value: filled.filter(o => o.isAutomatic).length.toString(), cls: 'text-yellow-400' },
              { label: 'Net P&L', value: (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(2) + ' $', cls: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(c => (
              <div key={c.label} className="bg-white/5 border border-white/5 rounded-xl p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</p>
                <p className={`text-base font-bold mt-1 ${c.cls ?? 'text-slate-200'}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Manuel Emir Formu */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Manuel Emir</h2>
          <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-4">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              Yalnızca Spot Market emri verilir. Kaldıraç veya withdrawal işlemi kesinlikle yapılmaz.
            </p>
          </div>
          <form
            onSubmit={handleSubmit(d => placeOrder.mutate({ ...d, side: Number(d.side), coinId: Number(d.coinId), quoteQty: Number(d.quoteQty) }))}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-slate-400 mb-1">Coin</label>
              <select {...register('coinId')} className={inputCls}>
                <option value="">Seçin…</option>
                {coins?.filter(c => c.isInWatchlist).map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
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
          </form>
        </div>

        {/* Filters + Export */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterCoin}
            onChange={e => { setFilterCoin(e.target.value === '' ? '' : Number(e.target.value)); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
          >
            <option value="">Tüm Coinler</option>
            {coins?.filter(c => c.isInWatchlist).map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
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
          <button
            onClick={handleExport}
            disabled={!orders?.length}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <Download size={14} /> CSV İndir
          </button>
        </div>

        {/* Orders table */}
        {isLoading ? (
          <SkeletonTable rows={6} cols={8} />
        ) : !orders?.length ? (
          <EmptyState
            icon={TrendingUp}
            title="Emir bulunamadı"
            description="Filtre kriterlerinizi değiştirin veya henüz işlem yapılmamış."
          />
        ) : (
          <div className="bg-white/5 border border-white/5 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                  <th className="w-6 px-2 py-3" />
                  <th className={thCls} onClick={() => toggle('coinSymbol')}>Coin{indicator('coinSymbol')}</th>
                  <th className={thCls} onClick={() => toggle('side')}>Yön{indicator('side')}</th>
                  <th className="text-left px-4 py-3">Kaynak</th>
                  <th className={cn(thCls, 'text-right')} onClick={() => toggle('quantity')}>Adet{indicator('quantity')}</th>
                  <th className={cn(thCls, 'text-right')} onClick={() => toggle('price')}>Fiyat{indicator('price')}</th>
                  <th className={cn(thCls, 'text-right')} onClick={() => toggle('realizedPnl')}>P&L{indicator('realizedPnl')}</th>
                  <th className="text-left px-4 py-3">Durum</th>
                  <th className={cn(thCls, 'text-right')} onClick={() => toggle('createdAt')}>Tarih{indicator('createdAt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sorted.map(o => {
                  const side = ORDER_SIDE[o.side] ?? ORDER_SIDE[0]
                  const status = ORDER_STATUS[o.status] ?? ORDER_STATUS[0]
                  const SideIcon = side.icon
                  const isExpanded = expandedRow === o.id
                  return (
                    <>
                      <tr
                        key={o.id}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(isExpanded ? null : o.id)}
                      >
                        <td className="px-2 py-3 text-slate-600">
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">{o.coinSymbol}</td>
                        <td className="px-4 py-3">
                          <span className={cn('flex items-center gap-1.5 font-medium', side.color)}>
                            <SideIcon size={12} />{side.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium',
                            o.isAutomatic
                              ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                              : 'bg-slate-500/20 text-slate-400 border-slate-500/20')}>
                            {o.isAutomatic ? 'Otomatik' : 'Manuel'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{o.quantity.toFixed(6)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{formatUsdt(o.price)}</td>
                        <td className={cn('px-4 py-3 text-right font-medium', pnlColor(o.realizedPnl))}>
                          {o.realizedPnl != null ? formatUsdt(o.realizedPnl) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', status.cls)}>{status.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">
                          {format(new Date(o.createdAt), 'dd MMM yy HH:mm', { locale: tr })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${o.id}-detail`} className="bg-white/[0.02]">
                          <td colSpan={9} className="px-6 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-slate-500 mb-0.5">Order ID</p>
                                <p className="text-slate-300 font-mono">{o.id}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 mb-0.5">USDT Değeri</p>
                                <p className="text-slate-300">{formatUsdt(o.quantity * (o.price ?? 0))}</p>
                              </div>
                              {o.realizedPnl != null && (
                                <div>
                                  <p className="text-slate-500 mb-0.5">Gerçekleşen P&L</p>
                                  <p className={cn('font-semibold', pnlColor(o.realizedPnl))}>
                                    {o.realizedPnl >= 0 ? '+' : ''}{o.realizedPnl.toFixed(4)} USDT
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-slate-500 mb-0.5">Tam Zaman</p>
                                <p className="text-slate-300">{format(new Date(o.createdAt), 'dd MMM yyyy HH:mm:ss', { locale: tr })}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(orders?.length ?? 0) > 0 && (
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
        )}

        <p className="text-xs text-slate-700 pb-2">💡 İpucu: <kbd className="px-1 bg-white/5 rounded text-slate-600">R</kbd> tuşu sayfayı yeniler</p>
      </div>
    </>
  )
}
