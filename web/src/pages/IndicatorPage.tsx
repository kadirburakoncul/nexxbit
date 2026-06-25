import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { indicatorsApi } from '@/api/indicators'
import type { IndicatorSetting } from '@/api/indicators'
import Header from '@/components/layout/Header'
import { useState } from 'react'
import { Save, TrendingUp, Power, Pencil, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50'

export default function IndicatorPage() {
  const qc = useQueryClient()
  const { data: indicators, isLoading } = useQuery({
    queryKey: ['indicators'],
    queryFn: () => indicatorsApi.list(),
  })

  if (isLoading)
    return (
      <>
        <Header title="İndikatör Ayarları" />
        <div className="p-6 text-slate-500">Yükleniyor…</div>
      </>
    )

  return (
    <>
      <Header title="İndikatör Ayarları" />
      <div className="p-6 max-w-2xl space-y-6">
        {indicators && indicators.length > 0 ? (
          indicators.map(ind => (
            <IndicatorCard
              key={ind.indicatorId}
              indicator={ind}
              onSaved={() => qc.invalidateQueries({ queryKey: ['indicators'] })}
            />
          ))
        ) : (
          <p className="text-slate-500 text-sm">İndikatör bulunamadı. Sistem yeniden başlatıldığında otomatik oluşturulur.</p>
        )}
      </div>
    </>
  )
}

function IndicatorCard({
  indicator,
  onSaved,
}: {
  indicator: IndicatorSetting
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [params, setParams] = useState<Record<number, string>>(
    Object.fromEntries(indicator.parameters.map(p => [p.definitionId, p.value]))
  )
  const [saved, setSaved] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  // Direkt aktif/pasif toggle
  const toggleMut = useMutation({
    mutationFn: () => indicatorsApi.toggle(indicator.indicatorId),
    onSuccess: () => {
      setToggleError(null)
      qc.invalidateQueries({ queryKey: ['indicators'] })
      onSaved()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.errors?.[0] ?? e?.response?.data?.message ?? 'Hata oluştu'
      setToggleError(msg)
    },
  })

  const update = useMutation({
    mutationFn: () =>
      indicatorsApi.update(indicator.indicatorId, {
        isEnabled: indicator.isEnabled,
        weight: 1.0,
        parameters: indicator.parameters.map(p => ({
          definitionId: p.definitionId,
          value: params[p.definitionId] ?? p.value,
        })),
      }),
    onSuccess: () => {
      setSaved(true)
      setIsEditing(false)
      setTimeout(() => setSaved(false), 3000)
      onSaved()
    },
  })

  const cancelEdit = () => {
    setParams(Object.fromEntries(indicator.parameters.map(p => [p.definitionId, p.value])))
    setIsEditing(false)
  }

  return (
    <div className={cn(
      'bg-white/5 border rounded-xl overflow-hidden transition-colors',
      isEditing ? 'border-yellow-400/30' : 'border-blue-500/25'
    )}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <TrendingUp size={16} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-blue-400">{indicator.displayName}</span>
            <span className="text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">{indicator.category} · T3</span>

            {/* Direkt toggle butonu */}
            <button
              type="button"
              onClick={() => { setToggleError(null); toggleMut.mutate() }}
              disabled={toggleMut.isPending}
              className={cn(
                'ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50',
                indicator.isEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400'
                  : 'bg-slate-500/15 border-slate-500/30 text-slate-500 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-400',
              )}
              title={indicator.isEnabled ? 'Pasife al' : 'Aktifleştir'}
            >
              <Power size={11} /> {toggleMut.isPending ? '…' : indicator.isEnabled ? 'Aktif' : 'Pasif'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {indicator.name} — {indicator.parameters.find(p => p.displayName.includes('Periyot'))?.value ?? '3'} periyot,
            faktör {indicator.parameters.find(p => p.displayName.includes('Faktör'))?.value ?? '0.7'}
          </p>
        </div>
      </div>

      {/* Uyarı mesajı */}
      {toggleError && (
        <div className="mx-5 mb-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{toggleError}</p>
          <button onClick={() => setToggleError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Description from DB */}
      {indicator.description && (
        <div className="mx-5 mb-4 bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{indicator.description}</p>
        </div>
      )}

      {/* Params — only in edit mode */}
      {isEditing && (
        <div className="border-t border-white/5 px-5 py-4 space-y-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Parametreler</p>
          <div className="grid grid-cols-2 gap-4">
            {indicator.parameters.map(p => (
              <div key={p.definitionId}>
                <label className="block text-xs text-slate-400 mb-1">
                  {p.displayName}
                  {(p.minValue || p.maxValue) && (
                    <span className="text-slate-600 ml-1">({p.minValue ?? ''}–{p.maxValue ?? ''})</span>
                  )}
                </label>
                <input
                  type="number"
                  step={p.dataType === 'decimal' ? '0.1' : '1'}
                  value={params[p.definitionId] ?? p.value}
                  onChange={e => setParams(prev => ({ ...prev, [p.definitionId]: e.target.value }))}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          <div className="bg-white/5 rounded-lg p-3 text-xs text-slate-500">
            <span className="text-slate-300 font-medium">Kaynak formülü:</span>{' '}
            <code className="text-blue-300">src = (high + low + 2×close) / 4</code>
            {' '}— PineScript ile birebir aynı hesaplama
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center gap-3">
        {!isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Pencil size={12} /> Parametreleri Düzenle
            </button>
            {saved && <span className="text-xs text-emerald-400">✓ Kaydedildi</span>}
          </>
        ) : (
          <>
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending}
              className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors"
            >
              <Save size={12} /> {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={update.isPending}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              <X size={12} /> İptal
            </button>
            {update.isError && <span className="text-xs text-red-400">Hata oluştu</span>}
          </>
        )}
      </div>
    </div>
  )
}
