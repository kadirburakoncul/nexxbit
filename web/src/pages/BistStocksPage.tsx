import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { bistApi } from '@/api/bist'
import type { BistCatalogStock } from '@/api/bist'
import { Search, BookmarkPlus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

function StockRow({
  stock, inWatchlist, onAdd, onRemove, loading,
}: {
  stock: BistCatalogStock
  inWatchlist: boolean
  onAdd: () => void
  onRemove: () => void
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
        <span className="text-yellow-400 text-xs font-bold">{stock.symbol.slice(0, 2)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-100">{stock.symbol}</p>
        <p className="text-xs text-slate-500 truncate">{stock.displayName}</p>
      </div>

      {stock.sector && (
        <span className="hidden sm:inline text-[10px] text-slate-600 bg-white/5 border border-white/8 rounded-full px-2 py-0.5 shrink-0">
          {stock.sector}
        </span>
      )}

      <button
        onClick={inWatchlist ? onRemove : onAdd}
        disabled={loading}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border',
          inWatchlist
            ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
            : 'bg-white/5 border-white/10 text-slate-500 hover:bg-yellow-400/10 hover:border-yellow-400/20 hover:text-yellow-400 opacity-0 group-hover:opacity-100',
          loading && 'opacity-50 cursor-not-allowed'
        )}
        title={inWatchlist ? 'Listeden Çıkar' : 'Listeye Ekle'}
      >
        {inWatchlist ? (
          <>
            <Check size={12} />
            <span className="hidden sm:inline">Kayıtlı</span>
          </>
        ) : (
          <>
            <BookmarkPlus size={12} />
            <span className="hidden sm:inline">Kaydet</span>
          </>
        )}
      </button>
    </div>
  )
}

export default function BistStocksPage() {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['bist-catalog'],
    queryFn: bistApi.catalog,
  })

  const { data: watchlist } = useQuery({
    queryKey: ['bist-watchlist'],
    queryFn: bistApi.watchlist,
  })

  const watchlistIds = useMemo(
    () => new Set((watchlist ?? []).map(w => w.id)),
    [watchlist]
  )

  const addMut = useMutation({
    mutationFn: bistApi.addToWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bist-watchlist'] }),
  })

  const removeMut = useMutation({
    mutationFn: bistApi.removeFromWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bist-watchlist'] }),
  })

  const sectors = useMemo(() => {
    const s = new Set((catalog ?? []).map(c => c.sector).filter(Boolean) as string[])
    return [...s].sort()
  }, [catalog])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return (catalog ?? []).filter(c => {
      const matchQuery = !q || c.symbol.toLowerCase().includes(q) || c.displayName.toLowerCase().includes(q)
      const matchSector = !sectorFilter || c.sector === sectorFilter
      return matchQuery && matchSector
    })
  }, [catalog, query, sectorFilter])

  const watchlistStocks = useMemo(
    () => (catalog ?? []).filter(c => watchlistIds.has(c.id)),
    [catalog, watchlistIds]
  )

  const pendingId = addMut.isPending
    ? (addMut.variables as number)
    : removeMut.isPending ? (removeMut.variables as number) : null

  return (
    <>
      <Header title="BIST Hisseler" />
      <div className="p-3 md:p-6 max-w-3xl space-y-4">

        {/* Özet */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500">Toplam Hisse</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{catalog?.length ?? '—'}</p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500">Kayıtlı Hisse</p>
            <p className="text-2xl font-bold text-yellow-400 mt-0.5">{watchlist?.length ?? 0}</p>
          </div>
        </div>

        {/* Kayıtlı hisseler */}
        {watchlistStocks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2 px-1">Kayıtlı Hisseler ({watchlistStocks.length})</p>
            <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
              {watchlistStocks.map(stock => (
                <StockRow
                  key={stock.id}
                  stock={stock}
                  inWatchlist={true}
                  onAdd={() => addMut.mutate(stock.id)}
                  onRemove={() => removeMut.mutate(stock.id)}
                  loading={pendingId === stock.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Arama ve filtreleme */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sembol veya şirket adı ara…"
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400/50"
            />
          </div>
          {sectors.length > 0 && (
            <select
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-400 focus:outline-none focus:border-yellow-400/50"
            >
              <option value="">Tüm Sektörler</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {/* Sonuçlar */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-600 mb-2 px-1">{filtered.length} hisse bulundu</p>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-sm">Eşleşen hisse bulunamadı</div>
              ) : (
                filtered.map(stock => (
                  <StockRow
                    key={stock.id}
                    stock={stock}
                    inWatchlist={watchlistIds.has(stock.id)}
                    onAdd={() => addMut.mutate(stock.id)}
                    onRemove={() => removeMut.mutate(stock.id)}
                    loading={pendingId === stock.id}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-700">
          Hisse listesi BIST'teki borsa kayıtlı şirketleri içerir. Kayıtlı hisseler strateji oluşturma ekranında "Kayıtlı" butonuyla kolayca seçilebilir.
        </p>
      </div>
    </>
  )
}
