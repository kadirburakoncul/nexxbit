import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategiesApi, RE_ENTRY_LABEL } from '@/api/strategies'
import type { Strategy, UpsertStrategyRequest } from '@/api/strategies'
import { coinsApi } from '@/api/coins'
import { indicatorsApi } from '@/api/indicators'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Header from '@/components/layout/Header'
import { Plus, Pencil, Trash2, Power, X, Check, AlertCircle, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d']

const schema = z.object({
  name: z.string().min(1, 'İsim gerekli'),
  indicatorId: z.number({ message: 'İndikatör seçin' }).int(),
  coinIds: z.array(z.number()).min(1, 'En az 1 coin seçin'),
  timeframe: z.string(),
  trailingStopPct: z.coerce.number().min(0.01).max(10),
  stopLossPct: z.coerce.number().min(0.01).max(10),
})
type FormData = z.infer<typeof schema>

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50'

const DEFAULT_VALUES = (indicatorId?: number): FormData => ({
  name: 'Easy Strateji',
  indicatorId: indicatorId ?? 0,
  coinIds: [],
  timeframe: '5m',
  trailingStopPct: 0.30,
  stopLossPct: 0.30,
})

const RE_ENTRY_COLOR: Record<number, string> = {
  0: 'text-emerald-400',
  1: 'text-yellow-400',
  2: 'text-blue-400',
}

export default function StrategyPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [creating, setCreating] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const { data: strategies, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: strategiesApi.list,
  })
  const { data: coins } = useQuery({ queryKey: ['coins'], queryFn: coinsApi.list })
  const { data: indicators } = useQuery({ queryKey: ['indicators'], queryFn: () => indicatorsApi.list() })

  const showForm = creating || !!editing

  const createMut = useMutation({
    mutationFn: (req: UpsertStrategyRequest) => strategiesApi.create(req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategies'] }); setCreating(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpsertStrategyRequest }) => strategiesApi.update(id, req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategies'] }); setEditing(null) },
  })

  const toggleMut = useMutation({
    mutationFn: (id: string) => strategiesApi.toggle(id),
    onSuccess: () => {
      setToggleError(null)
      qc.invalidateQueries({ queryKey: ['strategies'] })
      qc.invalidateQueries({ queryKey: ['strategy-monitor'] })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.errors?.[0] ?? e?.response?.data?.message ?? 'Hata oluştu'
      setToggleError(msg)
    },
  })

  const toggleRealTradeMut = useMutation({
    mutationFn: (id: string) => strategiesApi.toggleRealTrade(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => strategiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })

  const closeForm = () => { setCreating(false); setEditing(null) }

  return (
    <>
      <Header title="Strateji Yönetimi" />
      <div className="p-6 max-w-4xl space-y-6">

        {/* Toggle uyarısı */}
        {toggleError && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300 flex-1">{toggleError}</p>
            <button onClick={() => setToggleError(null)} className="text-red-400/60 hover:text-red-400"><X size={14} /></button>
          </div>
        )}

        {/* Create button */}
        {!showForm && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} /> Yeni Strateji
          </button>
        )}

        {/* Form */}
        {showForm && (
          <StrategyForm
            key={editing?.id ?? 'new'}
            coins={coins ?? []}
            indicators={(indicators ?? []).filter(i => i.isEnabled)}
            initialValues={editing
              ? {
                  name: editing.name,
                  indicatorId: editing.indicatorId ?? (indicators?.[0]?.indicatorId ?? 0),
                  coinIds: editing.coins.map(c => c.coinId),
                  timeframe: editing.timeframe,
                  trailingStopPct: editing.trailingStopPct,
                  stopLossPct: editing.stopLossPct,
                }
              : DEFAULT_VALUES(indicators?.[0]?.indicatorId)}
            isEditing={!!editing}
            isLoading={createMut.isPending || updateMut.isPending}
            error={createMut.error?.message || updateMut.error?.message}
            onSubmit={data => {
              const req: UpsertStrategyRequest = { ...data }
              if (editing) updateMut.mutate({ id: editing.id, req })
              else createMut.mutate(req)
            }}
            onCancel={closeForm}
          />
        )}

        {/* Strategy list */}
        {isLoading && <p className="text-slate-500 text-sm">Yükleniyor…</p>}
        {!isLoading && strategies?.length === 0 && !showForm && (
          <p className="text-slate-500 text-sm">Henüz strateji yok. "Yeni Strateji" ile oluşturun.</p>
        )}

        <div className="space-y-4">
          {strategies?.map(s => (
            <StrategyCard
              key={s.id}
              strategy={s}
              onEdit={() => {
                if (s.isActive) {
                  alert(`"${s.name}" stratejisi şu an aktif çalışıyor.\nDüzenlemek için önce "Durdur" butonuna basın.`)
                  return
                }
                setCreating(false)
                setEditing(s)
              }}
              onToggle={() => toggleMut.mutate(s.id)}
              onToggleRealTrade={() => toggleRealTradeMut.mutate(s.id)}
              onDelete={() => { if (confirm(`"${s.name}" stratejisini sil?`)) deleteMut.mutate(s.id) }}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// UTC → UTC+3 formatter
function fmtUtc3(str: string | null | undefined): string {
  if (!str) return '—'
  const s = str.endsWith('Z') || str.includes('+') ? str : str + 'Z'
  return new Date(s).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

// ─── StrategyCard ────────────────────────────────────────────────────────────
function StrategyCard({
  strategy,
  onEdit,
  onToggle,
  onToggleRealTrade,
  onDelete,
}: {
  strategy: Strategy
  onEdit: () => void
  onToggle: () => void
  onToggleRealTrade: () => void
  onDelete: () => void
}) {
  return (
    <div className={cn(
      'bg-white/5 border rounded-xl p-5 space-y-4 transition-colors',
      strategy.isActive ? 'border-emerald-500/25' : 'border-white/5 opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-100">{strategy.name}</h3>
            {/* Aktif/Pasif badge */}
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
              strategy.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/20 text-slate-500')}>
              {strategy.isActive ? 'Aktif' : 'Pasif'}
            </span>
            {/* Gerçek işlem badge */}
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border',
              strategy.isRealTradeEnabled
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                : 'bg-slate-500/10 text-slate-500 border-white/5')}>
              {strategy.isRealTradeEnabled ? 'Gerçek İşlem Açık' : 'Gerçek İşlem Kapalı'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {strategy.indicatorDisplayName && (
              <><span className="text-blue-400">{strategy.indicatorDisplayName}</span>{' · '}</>
            )}
            Zaman dilimi: <span className="text-slate-300">{strategy.timeframe}</span>
            {' · '}Trailing: <span className="text-yellow-400">%{strategy.trailingStopPct}</span>
            {' · '}Stop Loss: <span className="text-red-400">%{strategy.stopLossPct}</span>
            {strategy.activatedAt && (
              <>{' · '}Aktive: <span className="text-slate-400">{fmtUtc3(strategy.activatedAt)}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Sinyal toggle */}
          <button
            onClick={onToggle}
            title={strategy.isActive ? 'Sinyalleri Durdur' : 'Sinyalleri Başlat'}
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
          {/* Gerçek işlem toggle */}
          <button
            onClick={onToggleRealTrade}
            title={strategy.isRealTradeEnabled ? 'Gerçek İşlemi Kapat' : 'Gerçek İşlemi Aç'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              strategy.isRealTradeEnabled
                ? 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25'
                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
            )}
          >
            <DollarSign size={13} />
            {strategy.isRealTradeEnabled ? 'Gerçek: Açık' : 'Gerçek: Kapalı'}
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

      {/* Coins */}
      {strategy.coins.length === 0 ? (
        <p className="text-xs text-slate-600">Coin eklenmemiş</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {strategy.coins.map(c => (
            <div key={c.coinId} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-sm font-medium text-slate-200">{c.symbol}</span>
              {c.reEntryState !== 0 && (
                <span className={cn('text-xs font-medium', RE_ENTRY_COLOR[c.reEntryState])}>
                  · {RE_ENTRY_LABEL[c.reEntryState]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── StrategyForm ────────────────────────────────────────────────────────────
function StrategyForm({
  coins,
  indicators,
  initialValues,
  isLoading,
  error,
  isEditing,
  onSubmit,
  onCancel,
}: {
  coins: { id: number; symbol: string; displayName: string }[]
  indicators: { indicatorId: number; displayName: string; name: string }[]
  initialValues: FormData
  isLoading: boolean
  error?: string
  isEditing?: boolean
  onSubmit: (data: UpsertStrategyRequest) => void
  onCancel: () => void
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) as any, defaultValues: initialValues })

  const selectedCoinIds = watch('coinIds')

  const toggleCoin = (id: number) => {
    const current = selectedCoinIds ?? []
    setValue('coinIds', current.includes(id) ? current.filter(c => c !== id) : [...current, id], { shouldValidate: true })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          {isEditing ? 'Stratejiyi Düzenle' : 'Yeni Strateji'}
        </h2>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
      </div>

      <form onSubmit={handleSubmit(d => onSubmit({
        name: d.name,
        indicatorId: d.indicatorId ?? null,
        coinIds: d.coinIds,
        timeframe: d.timeframe,
        trailingStopPct: d.trailingStopPct,
        stopLossPct: d.stopLossPct,
      }))} className="space-y-4">

        {/* Indicator */}
        <div>
          <label className="text-xs text-slate-400 block mb-2">İndikatör Seçin</label>
          {indicators.length === 0 ? (
            <p className="text-xs text-yellow-400 bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-3">
              Aktif indikatör bulunamadı. İndikatör sayfasından bir indikatörü aktif edin.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {indicators.map(ind => {
                const sel = watch('indicatorId') === ind.indicatorId
                return (
                  <button key={ind.indicatorId} type="button"
                    onClick={() => setValue('indicatorId', ind.indicatorId, { shouldValidate: true })}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors',
                      sel
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}>
                    <TrendingUp size={13} />
                    {ind.displayName}
                    {sel && <Check size={12} />}
                  </button>
                )
              })}
            </div>
          )}
          {errors.indicatorId && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.indicatorId.message}</p>}
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-slate-400">Strateji Adı</label>
          <input {...register('name')} className={inputCls} placeholder="Easy Strateji" />
          {errors.name && <p className="text-xs text-red-400 mt-0.5">{errors.name.message}</p>}
        </div>

        {/* Timeframe */}
        <div>
          <label className="text-xs text-slate-400">Zaman Dilimi</label>
          <div className="flex gap-2 mt-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf} type="button"
                onClick={() => setValue('timeframe', tf)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                  watch('timeframe') === tf
                    ? 'bg-yellow-400/20 border-yellow-400/30 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Stop settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Trailing Stop % (tepeden düşüş)</label>
            <div className="relative mt-1">
              <input {...register('trailingStopPct')} type="number" step="0.01" min="0.01" max="10"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            {errors.trailingStopPct && <p className="text-xs text-red-400 mt-0.5">{errors.trailingStopPct.message}</p>}
          </div>
          <div>
            <label className="text-xs text-slate-400">Stop Loss % (girişten düşüş)</label>
            <div className="relative mt-1">
              <input {...register('stopLossPct')} type="number" step="0.01" min="0.01" max="10"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            {errors.stopLossPct && <p className="text-xs text-red-400 mt-0.5">{errors.stopLossPct.message}</p>}
          </div>
        </div>

        {/* Coin selection */}
        <div>
          <label className="text-xs text-slate-400 block mb-2">
            Coinler <span className="text-slate-600">(bir coin tek stratejide kullanılabilir)</span>
          </label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
            {coins.map(c => {
              const sel = selectedCoinIds?.includes(c.id)
              return (
                <button key={c.id} type="button" onClick={() => toggleCoin(c.id)}
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
          {errors.coinIds && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.coinIds.message}</p>}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-400 flex items-center gap-1"><AlertCircle size={14} />{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={isLoading}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
            {isLoading ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors">
            İptal
          </button>
        </div>
      </form>
    </div>
  )
}
