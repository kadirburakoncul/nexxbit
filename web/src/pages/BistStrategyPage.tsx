import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { bistApi } from '@/api/bist'
import type { BistStrategy, BistCatalogStock } from '@/api/bist'
import { Plus, Pencil, Trash2, Power, X, Check, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEFRAMES = ['5m', '15m', '30m', '1h', '1d']

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50'

// ── BIST endeks listeleri (semboller catalog ile eşleştirilecek) ───────────────
const BIST30_SYMBOLS = new Set([
  'AKBNK', 'ARCLK', 'ASELS', 'BIMAS', 'EKGYO', 'ENKAI', 'EREGL', 'FROTO',
  'GARAN', 'HALKB', 'ISCTR', 'KCHOL', 'KOZAL', 'KRDMD', 'PETKM', 'PGSUS',
  'SAHOL', 'SASA', 'SISE', 'TAVHL', 'TCELL', 'THYAO', 'TKFEN', 'TOASO',
  'TTKOM', 'TUPRS', 'VAKBN', 'YKBNK', 'KOZAA', 'AGHOL',
])

const BIST50_EXTRA = new Set([
  'AEFES', 'AKSEN', 'ALKIM', 'ANACM', 'BRSAN', 'CCOLA', 'CIMSA', 'DOHOL',
  'HEKTS', 'MAVI', 'MGROS', 'OTKAR', 'SKBNK', 'SNGYO', 'SOKM', 'SUNTR',
  'TRKCM', 'YKGYO', 'ZRGYO', 'ALBRK',
])

const BIST100_EXTRA = new Set([
  'AGESA', 'AHGAZ', 'AKCNS', 'AKGRT', 'AKSA', 'ALARK', 'ASUZU', 'ATAKP',
  'AVOD', 'AYEN', 'BAGFS', 'BERA', 'BIOEN', 'BLCYT', 'BUCIM', 'BURCE',
  'CANTES', 'CEMTS', 'CRFSA', 'CUSAN', 'DEVA', 'DOAS', 'ECZYT', 'EGEEN',
  'ELKAR', 'EMKEL', 'ENJSA', 'EPLAS', 'ESCOM', 'ETILR', 'FONET', 'GLYHO',
  'GOLTS', 'GSDHO', 'GUBRF', 'GUSGR', 'IHLGM', 'INDES', 'IPEKE', 'ISDMR',
  'IZMDC', 'JANTS', 'KARSN', 'KATMR', 'KMPUR', 'KONYA', 'KORDS', 'KTLEV',
  'LUKSK', 'NTHOL',
])

const BIST50_SYMBOLS = new Set([...BIST30_SYMBOLS, ...BIST50_EXTRA])
const BIST100_SYMBOLS = new Set([...BIST50_SYMBOLS, ...BIST100_EXTRA])

function fmtUtc3(str: string | null | undefined): string {
  if (!str) return '—'
  const s = str.endsWith('Z') || str.includes('+') ? str : str + 'Z'
  return new Date(s).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

export default function BistStrategyPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<BistStrategy | null>(null)
  const [creating, setCreating] = useState(false)
  const showForm = creating || !!editing

  const { data: strategies, isLoading } = useQuery({
    queryKey: ['bist-strategies'],
    queryFn: bistApi.strategies,
  })
  const { data: catalog } = useQuery({
    queryKey: ['bist-catalog'],
    queryFn: bistApi.catalog,
  })
  const { data: watchlist } = useQuery({
    queryKey: ['bist-watchlist'],
    queryFn: bistApi.watchlist,
  })

  const createMut = useMutation({
    mutationFn: bistApi.createStrategy,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bist-strategies'] }); setCreating(false) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, req }: { id: string; req: Parameters<typeof bistApi.updateStrategy>[1] }) =>
      bistApi.updateStrategy(id, req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bist-strategies'] }); setEditing(null) },
  })
  const toggleMut = useMutation({
    mutationFn: bistApi.toggleStrategy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bist-strategies'] }),
  })
  const deleteMut = useMutation({
    mutationFn: bistApi.deleteStrategy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bist-strategies'] }),
  })

  const closeForm = () => { setCreating(false); setEditing(null) }

  return (
    <>
      <Header title="BIST Strateji Yönetimi" />
      <div className="p-3 md:p-6 max-w-4xl space-y-4 md:space-y-6">

        {!showForm && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} /> Yeni Strateji
          </button>
        )}

        {showForm && (
          <BistStrategyForm
            key={editing?.id ?? 'new'}
            catalog={catalog ?? []}
            watchlist={watchlist ?? []}
            initialName={editing?.name ?? ''}
            initialTimeframe={editing?.timeframe ?? '15m'}
            initialStockIds={editing?.stocks.map(s => s.stockId) ?? []}
            initialRsiEnabled={editing?.isRsiFilterEnabled ?? false}
            initialRsiPeriod={editing?.rsiPeriod ?? 14}
            initialRsiBuyThreshold={editing?.rsiBuyThreshold ?? 50}
            isEditing={!!editing}
            isLoading={createMut.isPending || updateMut.isPending}
            error={
              (createMut.error as any)?.response?.data?.errors?.[0]
              ?? (createMut.error as any)?.response?.data?.message
              ?? (updateMut.error as any)?.response?.data?.errors?.[0]
              ?? (updateMut.error as any)?.response?.data?.message
            }
            onSubmit={({ name, timeframe, stockIds, isRsiFilterEnabled, rsiPeriod, rsiBuyThreshold }) => {
              const req = { name, timeframe, stockIds, isRsiFilterEnabled, rsiPeriod, rsiBuyThreshold }
              if (editing) updateMut.mutate({ id: editing.id, req })
              else createMut.mutate(req)
            }}
            onCancel={closeForm}
          />
        )}

        {isLoading && <p className="text-slate-500 text-sm">Yükleniyor…</p>}
        {!isLoading && strategies?.length === 0 && !showForm && (
          <p className="text-slate-500 text-sm">Henüz strateji yok. "Yeni Strateji" ile oluşturun.</p>
        )}

        <div className="space-y-4">
          {strategies?.map(s => (
            <StrategyCard
              key={s.id}
              strategy={s}
              onEdit={() => { setCreating(false); setEditing(s) }}
              onToggle={() => toggleMut.mutate(s.id)}
              onDelete={() => { if (confirm(`"${s.name}" stratejisini sil?`)) deleteMut.mutate(s.id) }}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ─── StrategyCard ─────────────────────────────────────────────────────────────
function StrategyCard({
  strategy, onEdit, onToggle, onDelete,
}: {
  strategy: BistStrategy
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className={cn(
      'bg-white/5 border rounded-xl p-5 space-y-4 transition-colors',
      strategy.isActive ? 'border-emerald-500/25' : 'border-white/5 opacity-60',
    )}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-100">{strategy.name}</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
              strategy.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/20 text-slate-500')}>
              {strategy.isActive ? 'Aktif' : 'Pasif'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-white/5 text-slate-400 border-white/10">
              {strategy.timeframe}
            </span>
            {strategy.isRsiFilterEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                RSI {strategy.rsiBuyThreshold}+
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {strategy.stocks.length} hisse
            {strategy.activatedAt && (
              <>{' · '}Aktive: <span className="text-slate-400">{fmtUtc3(strategy.activatedAt)}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            title={strategy.isActive ? 'Durdur' : 'Başlat'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              strategy.isActive
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
            )}
          >
            <Power size={13} />
            {strategy.isActive ? 'Durdur' : 'Başlat'}
          </button>
          <button onClick={onEdit} title="Düzenle"
            className="p-1.5 text-slate-400 hover:text-yellow-400 transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete} title="Sil"
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {strategy.stocks.length === 0 ? (
        <p className="text-xs text-slate-600">Hisse eklenmemiş</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {strategy.stocks.map(st => (
            <div key={st.stockId} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-sm font-medium text-slate-200">{st.symbol}</span>
              {st.lastT3UpDirection != null && (
                <span className={cn('text-xs', st.lastT3UpDirection ? 'text-emerald-400' : 'text-red-400')}>
                  {st.lastT3UpDirection ? <ArrowUpRight size={11} className="inline" /> : <ArrowDownRight size={11} className="inline" />}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BistStrategyForm ─────────────────────────────────────────────────────────
function BistStrategyForm({
  catalog, watchlist, initialName, initialTimeframe, initialStockIds,
  initialRsiEnabled, initialRsiPeriod, initialRsiBuyThreshold,
  isEditing, isLoading, error, onSubmit, onCancel,
}: {
  catalog: BistCatalogStock[]
  watchlist: BistCatalogStock[]
  initialName: string
  initialTimeframe: string
  initialStockIds: number[]
  initialRsiEnabled: boolean
  initialRsiPeriod: number
  initialRsiBuyThreshold: number
  isEditing: boolean
  isLoading: boolean
  error?: string
  onSubmit: (d: {
    name: string; timeframe: string; stockIds: number[]
    isRsiFilterEnabled: boolean; rsiPeriod: number; rsiBuyThreshold: number
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [timeframe, setTimeframe] = useState(initialTimeframe)
  const [stockIds, setStockIds] = useState<number[]>(initialStockIds)
  const [search, setSearch] = useState('')
  const [isRsiEnabled, setIsRsiEnabled] = useState(initialRsiEnabled)
  const [rsiPeriod, setRsiPeriod] = useState(initialRsiPeriod)
  const [rsiBuyThreshold, setRsiBuyThreshold] = useState(initialRsiBuyThreshold)

  const filtered = catalog.filter(c =>
    c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.displayName.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: number) =>
    setStockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const applyIndex = (symbols: Set<string>) => {
    const ids = catalog.filter(c => symbols.has(c.symbol)).map(c => c.id)
    setStockIds(ids)
  }

  const applyWatchlist = () => {
    const ids = watchlist.map(w => w.id)
    setStockIds(ids)
  }

  const handleSubmit = () => {
    if (!name.trim() || stockIds.length === 0) return
    onSubmit({ name: name.trim(), timeframe, stockIds, isRsiFilterEnabled: isRsiEnabled, rsiPeriod, rsiBuyThreshold })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          {isEditing ? 'Stratejiyi Düzenle' : 'Yeni BIST Stratejisi'}
        </h2>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2.5">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div>
        <label className="text-xs text-slate-400">Strateji Adı</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Örn: BIST30 15dk"
          className={inputCls + ' mt-1'}
        />
      </div>

      <div>
        <label className="text-xs text-slate-400">Zaman Dilimi</label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {TIMEFRAMES.map(tf => (
            <button key={tf} type="button"
              onClick={() => setTimeframe(tf)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                timeframe === tf
                  ? 'bg-yellow-400/20 border-yellow-400/30 text-yellow-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* RSI Filtresi */}
      <div className="bg-white/[0.03] border border-white/8 rounded-lg p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer w-fit select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={isRsiEnabled}
              onChange={e => setIsRsiEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-yellow-400/80 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
          </div>
          <div>
            <span className={cn('text-sm font-medium', isRsiEnabled ? 'text-yellow-400' : 'text-slate-300')}>
              RSI Filtresi
            </span>
            <p className="text-xs text-slate-500">AL sinyalini RSI eşiğinin üzerinde olanlarla sınırla</p>
          </div>
        </label>

        {isRsiEnabled && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
            <div>
              <label className="text-xs text-slate-400 block mb-1">RSI Periyodu</label>
              <input
                type="number" min={2} max={50} value={rsiPeriod}
                onChange={e => setRsiPeriod(+e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">AL Eşiği</label>
              <input
                type="number" min={0} max={100} value={rsiBuyThreshold}
                onChange={e => setRsiBuyThreshold(+e.target.value)}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-600 mt-1">RSI bu değerin altındayken AL sinyali bloklanır</p>
            </div>
          </div>
        )}
      </div>

      {/* Hisse Seçimi */}
      <div>
        <label className="text-xs text-slate-400 block mb-2">
          Hisseler <span className="text-slate-600">({stockIds.length} seçili)</span>
        </label>

        {/* Endeks hızlı seç */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => applyIndex(BIST30_SYMBOLS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/5 border-white/10 text-slate-400 hover:border-yellow-400/30 hover:text-yellow-400 transition-colors">
            BIST30
          </button>
          <button type="button" onClick={() => applyIndex(BIST50_SYMBOLS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/5 border-white/10 text-slate-400 hover:border-yellow-400/30 hover:text-yellow-400 transition-colors">
            BIST50
          </button>
          <button type="button" onClick={() => applyIndex(BIST100_SYMBOLS)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/5 border-white/10 text-slate-400 hover:border-yellow-400/30 hover:text-yellow-400 transition-colors">
            BIST100
          </button>
          {watchlist.length > 0 && (
            <button type="button" onClick={applyWatchlist}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/5 border-white/10 text-slate-400 hover:border-yellow-400/30 hover:text-yellow-400 transition-colors">
              Kayıtlı ({watchlist.length})
            </button>
          )}
          {stockIds.length > 0 && (
            <button type="button" onClick={() => setStockIds([])}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
              Temizle
            </button>
          )}
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hisse ara…"
          className={inputCls + ' mb-2'}
        />
        <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-1">
          {filtered.map(c => {
            const sel = stockIds.includes(c.id)
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  sel
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}>
                {sel && <Check size={12} />}
                {c.symbol}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isLoading || !name.trim() || stockIds.length === 0}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {isLoading ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors">
          İptal
        </button>
      </div>
    </div>
  )
}
