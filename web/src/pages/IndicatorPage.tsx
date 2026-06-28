import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { indicatorsApi } from '@/api/indicators'
import type { IndicatorSetting } from '@/api/indicators'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { useState } from 'react'
import { Save, TrendingUp, Power, X, AlertTriangle, ShoppingCart, BookOpen, Settings2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50'

export default function IndicatorPage() {
  const qc = useQueryClient()
  const isAdmin = useAuthStore(s => s.isAdmin)()

  const { data: indicators, isLoading } = useQuery({
    queryKey: ['indicators'],
    queryFn: () => indicatorsApi.list(),
  })

  if (isLoading)
    return (
      <>
        <Header title="İndikatörler" />
        <div className="p-6 text-slate-500">Yükleniyor…</div>
      </>
    )

  // Tillson (Easy İndikatör) kaldırıldı — sadece Level1 kaldı
  // RSI artık strateji toggle'ı — indikatör listesinde gösterilmez
  const HIDDEN_INDICATORS = ['tillson', 'tillsont3', 'rsi']
  const visibleIndicators = (indicators ?? []).filter(
    ind => !HIDDEN_INDICATORS.includes(ind.name.toLowerCase())
  )

  return (
    <>
      <Header title="İndikatörler" />
      <div className="p-3 md:p-6 max-w-2xl space-y-4 md:space-y-6">
        {visibleIndicators.length > 0 ? (
          visibleIndicators.map(ind => (
            <IndicatorCard
              key={ind.indicatorId}
              indicator={ind}
              isAdmin={isAdmin}
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

// ─── Admin: İndikatör bilgilerini düzenleme modu ─────────────────────────────
function AdminInfoEditor({ indicator, onClose, onSaved }: {
  indicator: IndicatorSetting
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(indicator.displayName)
  const [description, setDescription] = useState(indicator.description ?? '')
  const [howItWorks, setHowItWorks] = useState(indicator.howItWorks ?? '')
  const [params, setParams] = useState<Record<number, string>>(
    Object.fromEntries(indicator.parameters.map(p => [p.definitionId, p.defaultValue]))
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const update = useMutation({
    mutationFn: () => indicatorsApi.adminUpdate(indicator.indicatorId, {
      displayName,
      description,
      howItWorks,
      defaultParameters: indicator.parameters.map(p => ({
        definitionId: p.definitionId,
        value: params[p.definitionId] ?? p.defaultValue,
      })),
    }),
    onSuccess: () => {
      setSaved(true)
      setError('')
      setTimeout(() => { setSaved(false); onClose(); onSaved() }, 1200)
    },
    onError: () => setError('Kaydetme hatası'),
  })

  return (
    <div className="border-t border-yellow-400/20 px-5 py-4 space-y-4 bg-yellow-400/3">
      <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Admin — İndikatör Bilgilerini Düzenle</p>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Görünen Ad</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Açıklama (kullanıcılara gösterilir)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className={inputCls + ' resize-none'}
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Çalışma Prensibi (sadece admin görür)</label>
        <textarea
          value={howItWorks}
          onChange={e => setHowItWorks(e.target.value)}
          rows={4}
          placeholder="Bu indikatörün teknik çalışma prensibi..."
          className={inputCls + ' resize-none'}
        />
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-2">Varsayılan Parametreler</p>
        <div className="grid grid-cols-2 gap-3">
          {indicator.parameters.map(p => (
            <div key={p.definitionId}>
              <label className="block text-xs text-slate-500 mb-1">{p.displayName}</label>
              <input
                type="number"
                step={p.dataType === 'decimal' ? '0.1' : '1'}
                value={params[p.definitionId] ?? p.defaultValue}
                onChange={e => setParams(prev => ({ ...prev, [p.definitionId]: e.target.value }))}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        {saved
          ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Kaydedildi</span>
          : (
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending}
              className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold px-4 py-1.5 rounded-lg text-xs"
            >
              <Save size={12} /> {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          )
        }
        <button onClick={onClose} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 px-3 py-1.5 rounded-lg text-xs">
          <X size={12} /> İptal
        </button>
      </div>
    </div>
  )
}

// ─── IndicatorCard ────────────────────────────────────────────────────────────
function IndicatorCard({
  indicator,
  isAdmin,
  onSaved,
}: {
  indicator: IndicatorSetting
  isAdmin: boolean
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [showAdminEdit, setShowAdminEdit] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const canToggle = isAdmin || (indicator.hasSubscription && indicator.subscriptionIsActive)

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

  const isExpired = indicator.subscriptionExpiresAt
    ? new Date(indicator.subscriptionExpiresAt) < new Date()
    : false

  return (
    <div className={cn(
      'bg-white/5 border rounded-xl overflow-hidden transition-colors',
      showAdminEdit ? 'border-yellow-400/30' : 'border-blue-500/25'
    )}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <TrendingUp size={16} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-blue-400">{indicator.displayName}</span>
            <span className="text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">{indicator.category}</span>

            {/* Subscription badge (non-admin only) */}
            {!isAdmin && !indicator.hasSubscription && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-500 border border-slate-500/20">
                Abone Değil
              </span>
            )}
            {!isAdmin && indicator.hasSubscription && !indicator.subscriptionIsActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                Devre Dışı
              </span>
            )}
            {!isAdmin && indicator.hasSubscription && indicator.subscriptionIsActive && indicator.subscriptionExpiresAt && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border',
                isExpired
                  ? 'bg-red-500/15 text-red-400 border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              )}>
                {isExpired ? 'Süresi doldu' : format(new Date(indicator.subscriptionExpiresAt), 'dd MMM yyyy', { locale: tr })}
              </span>
            )}

            {/* Toggle butonu (sadece yetkili kullanıcılar veya admin) */}
            {canToggle && !isExpired && (
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
            )}

            {/* Satın Al butonu (aboneliği olmayan normal kullanıcı) */}
            {!isAdmin && !indicator.hasSubscription && (
              <button
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-yellow-400/10 border-yellow-400/30 text-yellow-400 cursor-default"
                title="Satın alma yakında"
                disabled
              >
                <ShoppingCart size={11} /> Satın Al
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-0.5">
            {indicator.parameters.find(p => p.displayName.includes('Periyot'))
              ? `${indicator.parameters.find(p => p.displayName.includes('Periyot'))!.value} periyot`
              : ''
            }
            {indicator.parameters.find(p => p.displayName.includes('Faktör'))
              ? `, faktör ${indicator.parameters.find(p => p.displayName.includes('Faktör'))!.value}`
              : ''
            }
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

      {/* Açıklama */}
      {indicator.description && (
        <div className="mx-5 mb-3 bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{indicator.description}</p>
        </div>
      )}

      {/* Çalışma prensibi - sadece admin */}
      {isAdmin && indicator.howItWorks && (
        <div className="mx-5 mb-3 bg-yellow-400/5 border border-yellow-400/15 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BookOpen size={11} className="text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Çalışma Prensibi</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{indicator.howItWorks}</p>
        </div>
      )}

      {/* Admin düzenleme paneli */}
      {isAdmin && showAdminEdit && (
        <AdminInfoEditor
          indicator={indicator}
          onClose={() => setShowAdminEdit(false)}
          onSaved={onSaved}
        />
      )}

      {/* Mevcut parametre değerleri (sadece admin, okuma modunda) */}
      {isAdmin && !showAdminEdit && indicator.parameters.length > 0 && (
        <div className="border-t border-white/5 mx-5 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            {indicator.parameters.map(p => (
              <div key={p.definitionId} className="flex items-center gap-2">
                <span className="text-xs text-slate-600">{p.displayName}:</span>
                <span className="text-xs text-slate-300 font-mono">{p.value}</span>
                {p.value !== p.defaultValue && (
                  <span className="text-[10px] text-yellow-400/60">(varsayılan: {p.defaultValue})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center gap-2">
        {isAdmin && !showAdminEdit && (
          <>
            <button
              onClick={() => setShowAdminEdit(true)}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Settings2 size={12} /> Düzenle
            </button>
          </>
        )}
        {!isAdmin && !indicator.hasSubscription && (
          <p className="text-xs text-slate-600">Bu indikatörü kullanmak için abonelik satın alın.</p>
        )}
        {!isAdmin && indicator.hasSubscription && !indicator.subscriptionIsActive && (
          <p className="text-xs text-slate-600">Bu abonelik admin tarafından devre dışı bırakıldı.</p>
        )}
        {!isAdmin && isExpired && (
          <p className="text-xs text-red-400/60">Abonelik süresi dolmuş.</p>
        )}
        {!isAdmin && indicator.hasSubscription && indicator.subscriptionIsActive && !isExpired && !canToggle && (
          <p className="text-xs text-slate-600">Aktif aboneliğinizle toggle yapabilirsiniz.</p>
        )}
      </div>
    </div>
  )
}
