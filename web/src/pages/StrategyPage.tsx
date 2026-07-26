import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategiesApi, RE_ENTRY_LABEL } from '@/api/strategies'
import type { Strategy, UpsertStrategyRequest } from '@/api/strategies'
import { coinsApi } from '@/api/coins'
import { indicatorsApi } from '@/api/indicators'
import { useAuthStore } from '@/stores/authStore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Header from '@/components/layout/Header'
import { Plus, Pencil, Trash2, Power, X, Check, AlertCircle, AlertTriangle, TrendingUp, DollarSign, Zap, Flame, Info, BarChart2, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d']

const schema = z.object({
  name: z.string().min(1, 'İsim gerekli'),
  indicatorId: z.number({ message: 'İndikatör seçin' }).int(),
  coinIds: z.array(z.number()),
  timeframe: z.string(),
  trailingStopPct: z.coerce.number().min(0.01).max(10),
  trailingActivationPct: z.coerce.number().min(0).max(20).default(1.0),
  rsiMaxValue: z.coerce.number().min(50).max(100).default(75),
  useHigherTfConfirm: z.boolean().default(false),
  higherTimeframe: z.string().default('1h'),
  useRiskBasedSizing: z.boolean().default(false),
  riskPerTradePct: z.coerce.number().min(0.1).max(10).default(1.0),
  maxConsecutiveLosses: z.coerce.number().int().min(2).max(20).default(5),
  pauseOnDrawdownPct: z.coerce.number().min(5).max(50).default(15),
  stopLossPct: z.coerce.number().min(0.01).max(10),
  takeProfitPct: z.coerce.number().min(0.1).max(1000).nullable().optional(),
  minVolumeUsdt: z.coerce.number().min(1000).nullable().optional(),
  volatilePositionSizePct: z.coerce.number().min(1).max(200).nullable().optional(),
  volatileMinChangePct: z.coerce.number().min(0.5).max(50).default(3),
  volatileGainerLimit: z.coerce.number().int().min(5).max(100).default(40),
  momentumFreshFilterMinutes: z.coerce.number().int().min(0).max(60).default(5),
  isVolatileMode: z.boolean().default(false),
  isRsiFilterEnabled: z.boolean().default(false),
  useAtrBasedStops: z.boolean().default(false),
  atrPeriod: z.coerce.number().int().min(5).max(50).default(14),
  atrSlMultiplier: z.coerce.number().min(0.5).max(10).default(1.5),
  atrTpMultiplier: z.coerce.number().min(0.5).max(20).default(3.0),
  partialTpPct: z.coerce.number().min(0.1).max(100).nullable().optional(),
  partialTpClosePct: z.coerce.number().min(10).max(90).default(50),
  isVolumeSurgeFilterEnabled: z.boolean().default(false),
  volumeSurgeMultiplier: z.coerce.number().min(1).max(10).default(1.5),
  useMarketRegimeFilter: z.boolean().default(false),
  maxHoldHours: z.coerce.number().int().min(1).max(72).default(8),
  slCooldownHours: z.coerce.number().int().min(0).max(24).default(2),
  isGreenCandleFilterEnabled: z.boolean().default(true),
  isEma200RuleEnabled: z.boolean().default(true),
  maxOpenPositions: z.coerce.number().int().min(1).max(20).default(5),
  maxPositionSizeUsdt: z.coerce.number().min(1).nullable().optional(),
  maxPositionSizePct: z.coerce.number().min(1).max(100).nullable().optional(),
  minPositionSizeUsdt: z.coerce.number().min(5).max(10000).default(10),
  useAdxFilter: z.boolean().default(false),
  adxPeriod: z.coerce.number().int().min(5).max(50).default(14),
  adxMinValue: z.coerce.number().min(10).max(60).default(25),
  useMacdFilter: z.boolean().default(false),
  useBreakevenStop: z.boolean().default(false),
  breakevenTriggerPct: z.coerce.number().min(0.1).max(20).default(1.5),
}).refine(data => data.isVolatileMode || data.coinIds.length > 0, {
  message: 'En az 1 coin seçin',
  path: ['coinIds'],
})
type FormData = z.infer<typeof schema>

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50'

const DEFAULT_VALUES = (indicatorId?: number): FormData => ({
  name: 'Easy Strateji',
  indicatorId: indicatorId ?? 0,
  coinIds: [],
  timeframe: '5m',
  trailingStopPct: 2.5,
  trailingActivationPct: 1.0,
  rsiMaxValue: 75,
  useHigherTfConfirm: true,
  higherTimeframe: '1h',
  useRiskBasedSizing: false,
  riskPerTradePct: 1.0,
  maxConsecutiveLosses: 5,
  pauseOnDrawdownPct: 15,
  stopLossPct: 3.0,
  takeProfitPct: null,
  minVolumeUsdt: null,
  volatilePositionSizePct: null,
  volatileMinChangePct: 5,
  volatileGainerLimit: 20,
  momentumFreshFilterMinutes: 5,
  isVolatileMode: false,
  isRsiFilterEnabled: false,
  useAtrBasedStops: false,
  atrPeriod: 14,
  atrSlMultiplier: 1.5,
  atrTpMultiplier: 3.0,
  partialTpPct: 2.0,
  partialTpClosePct: 50,
  isVolumeSurgeFilterEnabled: true,
  volumeSurgeMultiplier: 2.0,
  useMarketRegimeFilter: true,
  maxHoldHours: 8,
  slCooldownHours: 4,
  isGreenCandleFilterEnabled: true,
  isEma200RuleEnabled: true,
  maxOpenPositions: 5,
  maxPositionSizeUsdt: null,
  maxPositionSizePct: null,
  minPositionSizeUsdt: 10,
  useAdxFilter: true,
  adxPeriod: 14,
  adxMinValue: 25,
  useMacdFilter: true,
  useBreakevenStop: true,
  breakevenTriggerPct: 1.5,
})

const RE_ENTRY_COLOR: Record<number, string> = {
  0: 'text-emerald-400',
  1: 'text-yellow-400',
  2: 'text-blue-400',
}

interface DeactivateConfirm {
  strategyId: string
  strategyName: string
  signalCount: number
  realPositionCount: number
  virtualPositionCount: number
}

export default function StrategyPage() {
  const qc = useQueryClient()
  const isAdmin = useAuthStore(s => s.isAdmin)()
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [creating, setCreating] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState<DeactivateConfirm | null>(null)

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

  const invalidateAfterToggle = () => {
    qc.invalidateQueries({ queryKey: ['strategies'] })
    qc.invalidateQueries({ queryKey: ['strategy-monitor'] })
    qc.invalidateQueries({ queryKey: ['positions'] })
    qc.invalidateQueries({ queryKey: ['signals'] })
  }

  const toggleMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action?: string }) => strategiesApi.toggle(id, action),
    onSuccess: (data, vars) => {
      setToggleError(null)
      if (data.requiresConfirmation) {
        const s = strategies?.find(s => s.id === vars.id)
        setDeactivateConfirm({
          strategyId: vars.id,
          strategyName: s?.name ?? '',
          signalCount: data.signalCount ?? 0,
          realPositionCount: data.realPositionCount ?? 0,
          virtualPositionCount: data.virtualPositionCount ?? 0,
        })
        return
      }
      setDeactivateConfirm(null)
      invalidateAfterToggle()
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

  // Aktif stratejilerde hangi coinler kullanılıyor (uyarı için)
  const usedCoinIds = new Set(
    (strategies ?? [])
      .filter(s => s.isActive && s.id !== editing?.id)
      .flatMap(s => s.coins.map(c => c.coinId))
  )

  return (
    <>
      <Header title="Strateji Yönetimi" />
      <div className="p-3 md:p-6 max-w-4xl space-y-4 md:space-y-6">

        {/* Toggle hata uyarısı */}
        {toggleError && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300 flex-1">{toggleError}</p>
            <button onClick={() => setToggleError(null)} className="text-red-400/60 hover:text-red-400"><X size={14} /></button>
          </div>
        )}

        {/* Deaktifleştirme onay modalı */}
        {deactivateConfirm && (
          <DeactivateConfirmPanel
            confirm={deactivateConfirm}
            isPending={toggleMut.isPending}
            onAction={action => toggleMut.mutate({ id: deactivateConfirm.strategyId, action })}
            onCancel={() => setDeactivateConfirm(null)}
          />
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
            coins={(coins ?? []).filter(c => c.isInWatchlist)}
            indicators={(indicators ?? []).filter(i =>
              i.isEnabled &&
              i.name.toLowerCase() !== 'rsi' &&
              (isAdmin || i.subscriptionIsActive)
            )}
            usedCoinIds={usedCoinIds}
            initialValues={editing
              ? {
                  name: editing.name,
                  indicatorId: editing.indicatorId ?? (indicators?.[0]?.indicatorId ?? 0),
                  coinIds: editing.coins.map(c => c.coinId),
                  timeframe: editing.timeframe,
                  trailingStopPct: editing.trailingStopPct,
                  trailingActivationPct: editing.trailingActivationPct ?? 1.0,
                  rsiMaxValue: editing.rsiMaxValue ?? 75,
                  useHigherTfConfirm: editing.useHigherTfConfirm ?? false,
                  higherTimeframe: editing.higherTimeframe ?? '1h',
                  useRiskBasedSizing: editing.useRiskBasedSizing ?? false,
                  riskPerTradePct: editing.riskPerTradePct ?? 1.0,
                  maxConsecutiveLosses: editing.maxConsecutiveLosses ?? 5,
                  pauseOnDrawdownPct: editing.pauseOnDrawdownPct ?? 15,
                  stopLossPct: editing.stopLossPct,
                  takeProfitPct: editing.takeProfitPct ?? null,
                  minVolumeUsdt: editing.minVolumeUsdt ?? null,
                  volatilePositionSizePct: editing.volatilePositionSizePct ?? null,
                  volatileMinChangePct: editing.volatileMinChangePct ?? 3,
                  volatileGainerLimit: editing.volatileGainerLimit ?? 20,
                  momentumFreshFilterMinutes: editing.momentumFreshFilterMinutes ?? 5,
                  isVolatileMode: editing.isVolatileMode,
                  isRsiFilterEnabled: editing.isRsiFilterEnabled ?? false,
                  useAtrBasedStops: editing.useAtrBasedStops ?? false,
                  atrPeriod: editing.atrPeriod ?? 14,
                  atrSlMultiplier: editing.atrSlMultiplier ?? 1.5,
                  atrTpMultiplier: editing.atrTpMultiplier ?? 3.0,
                  partialTpPct: editing.partialTpPct ?? null,
                  partialTpClosePct: editing.partialTpClosePct ?? 50,
                  isVolumeSurgeFilterEnabled: editing.isVolumeSurgeFilterEnabled ?? false,
                  volumeSurgeMultiplier: editing.volumeSurgeMultiplier ?? 1.5,
                  useMarketRegimeFilter: editing.useMarketRegimeFilter ?? false,
                  maxHoldHours: editing.maxHoldHours ?? 8,
                  slCooldownHours: editing.slCooldownHours ?? 2,
                  isGreenCandleFilterEnabled: editing.isGreenCandleFilterEnabled ?? true,
                  isEma200RuleEnabled: editing.isEma200RuleEnabled ?? true,
                  maxOpenPositions: editing.maxOpenPositions ?? 5,
                  maxPositionSizeUsdt: editing.maxPositionSizeUsdt ?? null,
                  maxPositionSizePct: editing.maxPositionSizePct ?? null,
                  minPositionSizeUsdt: editing.minPositionSizeUsdt ?? 10,
                  useAdxFilter: editing.useAdxFilter ?? false,
                  adxPeriod: editing.adxPeriod ?? 14,
                  adxMinValue: editing.adxMinValue ?? 25,
                  useMacdFilter: editing.useMacdFilter ?? false,
                  useBreakevenStop: editing.useBreakevenStop ?? false,
                  breakevenTriggerPct: editing.breakevenTriggerPct ?? 1.5,
                }
              : DEFAULT_VALUES(indicators?.[0]?.indicatorId)}
            isEditing={!!editing}
            isLoading={createMut.isPending || updateMut.isPending}
            error={
              (createMut.error as any)?.response?.data?.errors?.[0]
              ?? (createMut.error as any)?.response?.data?.message
              ?? createMut.error?.message
              ?? (updateMut.error as any)?.response?.data?.errors?.[0]
              ?? (updateMut.error as any)?.response?.data?.message
              ?? updateMut.error?.message
            }
            onSubmit={data => {
              const req: UpsertStrategyRequest = {
                ...data,
                takeProfitPct: data.takeProfitPct ?? null,
                minVolumeUsdt: data.minVolumeUsdt ?? null,
                volatilePositionSizePct: data.volatilePositionSizePct ?? null,
                volatileMinChangePct: data.volatileMinChangePct ?? 3,
                volatileGainerLimit: data.volatileGainerLimit ?? 20,
                momentumFreshFilterMinutes: data.momentumFreshFilterMinutes ?? 5,
                isRsiFilterEnabled: data.isRsiFilterEnabled ?? false,
                useAtrBasedStops: data.useAtrBasedStops ?? false,
                atrPeriod: data.atrPeriod ?? 14,
                atrSlMultiplier: data.atrSlMultiplier ?? 1.5,
                atrTpMultiplier: data.atrTpMultiplier ?? 3.0,
                partialTpPct: data.partialTpPct ?? null,
                partialTpClosePct: data.partialTpClosePct ?? 50,
                isVolumeSurgeFilterEnabled: data.isVolumeSurgeFilterEnabled ?? false,
                volumeSurgeMultiplier: data.volumeSurgeMultiplier ?? 1.5,
                useMarketRegimeFilter: data.useMarketRegimeFilter ?? false,
                maxHoldHours: data.maxHoldHours ?? 8,
                slCooldownHours: data.slCooldownHours ?? 2,
                isGreenCandleFilterEnabled: data.isGreenCandleFilterEnabled ?? true,
                isEma200RuleEnabled: data.isEma200RuleEnabled ?? true,
                maxOpenPositions: data.maxOpenPositions ?? 5,
                maxPositionSizeUsdt: data.maxPositionSizeUsdt ?? null,
                maxPositionSizePct: data.maxPositionSizePct ?? null,
                minPositionSizeUsdt: data.minPositionSizeUsdt ?? 10,
                useAdxFilter: data.useAdxFilter ?? false,
                adxPeriod: data.adxPeriod ?? 14,
                adxMinValue: data.adxMinValue ?? 25,
                useMacdFilter: data.useMacdFilter ?? false,
                useBreakevenStop: data.useBreakevenStop ?? false,
                breakevenTriggerPct: data.breakevenTriggerPct ?? 1.5,
              }
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
              onToggle={() => toggleMut.mutate({ id: s.id })}
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

// ─── DeactivateConfirmPanel ──────────────────────────────────────────────────
function DeactivateConfirmPanel({
  confirm,
  isPending,
  onAction,
  onCancel,
}: {
  confirm: DeactivateConfirm
  isPending: boolean
  onAction: (action: string) => void
  onCancel: () => void
}) {
  const hasReal = confirm.realPositionCount > 0
  const hasVirtual = confirm.virtualPositionCount > 0
  const hasSignals = confirm.signalCount > 0

  return (
    <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-300">
            "{confirm.strategyName}" durdurulmadan önce uyarı:
          </p>
          <ul className="mt-2 space-y-1.5">
            {hasSignals && (
              <li className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {confirm.signalCount}
                </span>
                <span className="text-slate-300">bekleyen sinyal — <span className="text-orange-300">silinecek</span></span>
              </li>
            )}
            {hasVirtual && (
              <li className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded bg-slate-500/30 text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {confirm.virtualPositionCount}
                </span>
                <span className="text-slate-300">sanal pozisyon — <span className="text-slate-400">kapatılacak</span></span>
              </li>
            )}
            {hasReal && (
              <li className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {confirm.realPositionCount}
                </span>
                <span className="text-slate-300">
                  <span className="text-red-300 font-semibold">gerçek açık pozisyon</span> — ne yapmak istiyorsunuz?
                </span>
              </li>
            )}
          </ul>
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 shrink-0">
          <X size={14} />
        </button>
      </div>

      {hasReal ? (
        // Gerçek pozisyon varsa: iki seçenek
        <div className="space-y-2 pl-7">
          <button
            onClick={() => onAction('close')}
            disabled={isPending}
            className="w-full flex items-start gap-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl p-3.5 text-left transition-colors disabled:opacity-50"
          >
            <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <DollarSign size={13} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-300">Kapat — Anlık Market Fiyatından Sat</p>
              <p className="text-xs text-slate-500 mt-0.5">Binance'te market emri gönderilir, pozisyon anlık fiyattan satılır ve strateji durdurulur.</p>
            </div>
          </button>

          <button
            onClick={() => onAction('manual')}
            disabled={isPending}
            className="w-full flex items-start gap-3 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3.5 text-left transition-colors disabled:opacity-50"
          >
            <div className="w-7 h-7 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <Power size={13} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-300">Manuel — Pozisyonu Açık Bırak</p>
              <p className="text-xs text-slate-500 mt-0.5">Strateji durdurulur ama pozisyon açık kalır. Pozisyonlar sayfasından manuel satış yapabilirsiniz.</p>
            </div>
          </button>

          <button onClick={onCancel} disabled={isPending}
            className="text-xs text-slate-500 hover:text-slate-300 pt-1 transition-colors">
            İptal — Stratejiyi aktif bırak
          </button>
        </div>
      ) : (
        // Sadece sanal/sinyal varsa: tek buton
        <div className="flex gap-2 pl-7">
          <button
            onClick={() => onAction('manual')}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Power size={13} />
            {isPending ? 'Durduruluyor…' : 'Yine de Durdur'}
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200">
            İptal
          </button>
        </div>
      )}
    </div>
  )
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
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
              strategy.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/20 text-slate-500')}>
              {strategy.isActive ? 'Aktif' : 'Pasif'}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border',
              strategy.isRealTradeEnabled
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                : 'bg-slate-500/10 text-slate-500 border-white/5')}>
              {strategy.isRealTradeEnabled ? 'Gerçek İşlem Açık' : 'Gerçek İşlem Kapalı'}
            </span>
            {strategy.isVolatileMode && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-purple-500/15 text-purple-400 border-purple-500/30 flex items-center gap-1">
                <Zap size={10} /> Volatil Mod
              </span>
            )}
            {strategy.isRsiFilterEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-cyan-500/15 text-cyan-400 border-cyan-500/30 flex items-center gap-1">
                <BarChart2 size={10} /> RSI Filtresi
              </span>
            )}
            {strategy.useAtrBasedStops && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-orange-500/15 text-orange-400 border-orange-500/30 flex items-center gap-1">
                <TrendingUp size={10} /> ATR Stop
              </span>
            )}
            {strategy.partialTpPct != null && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-yellow-500/15 text-yellow-400 border-yellow-500/30 flex items-center gap-1">
                <DollarSign size={10} /> Kısmi TP %{strategy.partialTpPct}
              </span>
            )}
            {strategy.isVolumeSurgeFilterEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-blue-500/15 text-blue-400 border-blue-500/30 flex items-center gap-1">
                <Zap size={10} /> Hacim ×{strategy.volumeSurgeMultiplier}
              </span>
            )}
            {strategy.useMarketRegimeFilter && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <AlertCircle size={10} /> BTC Rejim
              </span>
            )}
            {strategy.isEma200RuleEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-indigo-500/15 text-indigo-400 border-indigo-500/30 flex items-center gap-1">
                <TrendingUp size={10} /> EMA200
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {strategy.indicatorDisplayName && (
              <><span className="text-blue-400">{strategy.indicatorDisplayName}</span>{' · '}</>
            )}
            Zaman dilimi: <span className="text-slate-300">{strategy.timeframe}</span>
            {' · '}Trailing: <span className="text-yellow-400">%{strategy.trailingStopPct}</span>
            {' · '}Stop Loss: <span className="text-red-400">%{strategy.stopLossPct}</span>
            {strategy.takeProfitPct != null && (
              <>{' · '}Take Profit: <span className="text-emerald-400">%{strategy.takeProfitPct}</span></>
            )}
            {strategy.minVolumeUsdt != null && (
              <>{' · '}Min Hacim: <span className="text-cyan-400">${(strategy.minVolumeUsdt / 1000).toFixed(0)}K</span></>
            )}
            {strategy.isVolatileMode && (
              <>{' · '}<span className="text-purple-400">
                Volatil: min%{strategy.volatileMinChangePct ?? 3} · top{strategy.volatileGainerLimit ?? 20} · pos{strategy.volatilePositionSizePct != null ? `%${strategy.volatilePositionSizePct}` : '×0.5'}{(strategy.momentumFreshFilterMinutes ?? 5) > 0 ? ` · fresh${strategy.momentumFreshFilterMinutes ?? 5}dk` : ''}
              </span></>
            )}
            {strategy.activatedAt && (
              <>{' · '}Aktive: <span className="text-slate-400">{fmtUtc3(strategy.activatedAt)}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
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
      {strategy.isVolatileMode ? (
        <div className="flex items-center gap-2 text-xs text-purple-400/70">
          <Flame size={12} />
          <span>Binance momentum tarayıcısı — 24 saatlik en yüksek coinler otomatik takip edilir</span>
        </div>
      ) : strategy.coins.length === 0 ? (
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
  usedCoinIds,
  initialValues,
  isLoading,
  error,
  isEditing,
  onSubmit,
  onCancel,
}: {
  coins: { id: number; symbol: string; displayName: string }[]
  indicators: { indicatorId: number; displayName: string; name: string }[]
  usedCoinIds: Set<number>
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
  } = useForm<FormData>({ resolver: zodResolver(schema) as any, defaultValues: initialValues, mode: 'onBlur' })

  const selectedCoinIds = watch('coinIds')
  const isVolatileMode = watch('isVolatileMode')
  const isRsiFilterEnabled = watch('isRsiFilterEnabled')
  const useAtrBasedStops = watch('useAtrBasedStops')
  const isVolumeSurgeFilterEnabled = watch('isVolumeSurgeFilterEnabled')
  const useMarketRegimeFilter = watch('useMarketRegimeFilter')
  const isGreenCandleFilterEnabled = watch('isGreenCandleFilterEnabled')
  const useAdxFilter = watch('useAdxFilter')
  const useMacdFilter = watch('useMacdFilter')
  const useBreakevenStop = watch('useBreakevenStop')
  const isEma200RuleEnabled = watch('isEma200RuleEnabled')
  const useHigherTfConfirm = watch('useHigherTfConfirm')
  const useRiskBasedSizing = watch('useRiskBasedSizing')

  const [usePartialTp, setUsePartialTp] = useState(initialValues.partialTpPct != null)

  const togglePartialTp = () => {
    const next = !usePartialTp
    setUsePartialTp(next)
    if (!next) {
      setValue('partialTpPct', null as any)
    } else {
      setValue('partialTpPct', 2.0)
    }
  }

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

      {/* API Hata Mesajı — Formun en üstünde göster */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2.5">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(d => onSubmit({
        name: d.name,
        indicatorId: d.indicatorId ?? null,
        coinIds: d.coinIds,
        timeframe: d.timeframe,
        trailingStopPct: d.trailingStopPct,
        trailingActivationPct: d.trailingActivationPct,
        rsiMaxValue: d.rsiMaxValue,
        useHigherTfConfirm: d.useHigherTfConfirm,
        higherTimeframe: d.higherTimeframe,
        useRiskBasedSizing: d.useRiskBasedSizing,
        riskPerTradePct: d.riskPerTradePct,
        maxConsecutiveLosses: d.maxConsecutiveLosses,
        pauseOnDrawdownPct: d.pauseOnDrawdownPct,
        stopLossPct: d.stopLossPct,
        takeProfitPct: d.takeProfitPct ?? null,
        minVolumeUsdt: d.minVolumeUsdt ?? null,
        volatilePositionSizePct: d.volatilePositionSizePct ?? null,
        volatileMinChangePct: d.volatileMinChangePct ?? 3,
        volatileGainerLimit: d.volatileGainerLimit ?? 20,
        momentumFreshFilterMinutes: d.momentumFreshFilterMinutes ?? 5,
        isVolatileMode: d.isVolatileMode,
        isRsiFilterEnabled: d.isRsiFilterEnabled ?? false,
        useAtrBasedStops: d.useAtrBasedStops ?? false,
        atrPeriod: d.atrPeriod ?? 14,
        atrSlMultiplier: d.atrSlMultiplier ?? 1.5,
        atrTpMultiplier: d.atrTpMultiplier ?? 3.0,
        partialTpPct: d.partialTpPct ?? null,
        partialTpClosePct: d.partialTpClosePct ?? 50,
        isVolumeSurgeFilterEnabled: d.isVolumeSurgeFilterEnabled ?? false,
        volumeSurgeMultiplier: d.volumeSurgeMultiplier ?? 1.5,
        useMarketRegimeFilter: d.useMarketRegimeFilter ?? false,
        maxHoldHours: d.maxHoldHours ?? 8,
        slCooldownHours: d.slCooldownHours ?? 2,
        isGreenCandleFilterEnabled: d.isGreenCandleFilterEnabled ?? true,
        isEma200RuleEnabled: d.isEma200RuleEnabled ?? true,
        maxOpenPositions: d.maxOpenPositions ?? 5,
        maxPositionSizeUsdt: d.maxPositionSizeUsdt ?? null,
        maxPositionSizePct: d.maxPositionSizePct ?? null,
        minPositionSizeUsdt: d.minPositionSizeUsdt ?? 10,
        useAdxFilter: d.useAdxFilter ?? false,
        adxPeriod: d.adxPeriod ?? 14,
        adxMinValue: d.adxMinValue ?? 25,
        useMacdFilter: d.useMacdFilter ?? false,
        useBreakevenStop: d.useBreakevenStop ?? false,
        breakevenTriggerPct: d.breakevenTriggerPct ?? 1.5,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Trailing Stop % (tepeden düşüş)</label>
            <div className="relative mt-1">
              <input {...register('trailingStopPct')} type="number" step="0.01" min="0.01" max="10"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Fiyat, ulaştığı en yüksek noktadan bu kadar % geri çekilirse pozisyon otomatik kapanır. Kârı korumak için kullanılır — <span className="text-yellow-400">küçük değer</span> kârı erken kilitler ama hareketin devamını kaçırma riski taşır, <span className="text-yellow-400">büyük değer</span> daha fazla yükselişe izin verir ama geri çekilmede daha çok kâr geri verir.
            </p>
            {errors.trailingStopPct && <p className="text-xs text-red-400 mt-0.5">{errors.trailingStopPct.message}</p>}
          </div>
          <div>
            <label className="text-xs text-slate-400">Trailing Aktivasyon % (kâr eşiği)</label>
            <div className="relative mt-1">
              <input {...register('trailingActivationPct')} type="number" step="0.1" min="0" max="20"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Trailing stop, pozisyon bu kâr yüzdesine ulaşmadan <span className="text-yellow-400">devreye girmez</span>. Girişten hemen sonraki normal dalgalanmada erken satışı önler. Ayrıca trailing tetiği asla giriş fiyatının altına inmez — yani trailing <span className="text-emerald-400">zararla satmaz</span>. <span className="text-slate-500">0 = girişten itibaren aktif (önerilmez).</span>
            </p>
            {errors.trailingActivationPct && <p className="text-xs text-red-400 mt-0.5">{errors.trailingActivationPct.message}</p>}
          </div>
          <div>
            <label className="text-xs text-slate-400">Stop Loss % (girişten düşüş)</label>
            <div className="relative mt-1">
              <input {...register('stopLossPct')} type="number" step="0.01" min="0.01" max="10"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Fiyat, giriş (alım) fiyatınızın bu kadar % altına inerse pozisyon zarar kesilerek kapanır. Kabul edebileceğiniz maksimum kayıp sınırıdır.
            </p>
            {errors.stopLossPct && <p className="text-xs text-red-400 mt-0.5">{errors.stopLossPct.message}</p>}
          </div>
        </div>

        {/* Take Profit */}
        <div>
          <label className="text-xs text-slate-400">
            Take Profit % <span className="text-slate-600">(opsiyonel — girişten yükseliş)</span>
          </label>
          <div className="relative mt-1">
            <input
              {...register('takeProfitPct', { setValueAs: v => (v === '' || v == null) ? null : Number(v) })}
              type="number" step="0.1" min="0.1" max="1000"
              placeholder="Ör: 5 (boş bırakabilirsiniz)"
              className={inputCls}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Fiyat, giriş fiyatınızın bu kadar % üzerine çıkarsa pozisyon tamamen kapanıp kâr kesin olarak alınır. Boş bırakılırsa sabit bir hedef olmaz, çıkış kararını Trailing Stop / Stop Loss / T3 sinyaline bırakırsınız.
          </p>
          {errors.takeProfitPct && <p className="text-xs text-red-400 mt-0.5">{errors.takeProfitPct.message}</p>}
        </div>

        {/* Min Volume */}
        <div>
          <label className="text-xs text-slate-400">
            Min Hacim USDT <span className="text-slate-600">(opsiyonel — 24 mum ortalaması)</span>
          </label>
          <div className="relative mt-1">
            <input
              {...register('minVolumeUsdt', { setValueAs: v => (v === '' || v == null) ? null : Number(v) })}
              type="number" step="1000" min="1000"
              placeholder="Ör: 500000 (boş = filtre yok)"
              className={inputCls}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Son 24 mumun ortalama işlem hacmi (USDT) bu değerin altındaysa AL sinyali üretilmez. Düşük hacimli/işlemsiz coinlerde takılmamak için kullanılır.
          </p>
          {errors.minVolumeUsdt && <p className="text-xs text-red-400 mt-0.5">{errors.minVolumeUsdt.message}</p>}
        </div>

        {/* Volatile Mode */}
        <div
          onClick={() => {
            const next = !isVolatileMode
            setValue('isVolatileMode', next)
            // Volatil moda geçince coin listesini temizle
            if (next) setValue('coinIds', [], { shouldValidate: false })
          }}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            isVolatileMode
              ? 'bg-purple-500/10 border-purple-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors',
            isVolatileMode ? 'bg-purple-500/20' : 'bg-white/5'
          )}>
            <Zap size={15} className={isVolatileMode ? 'text-purple-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', isVolatileMode ? 'text-purple-300' : 'text-slate-300')}>
                Volatil Mod
              </p>
              <div className={cn(
                'w-8 h-4 rounded-full transition-colors relative shrink-0',
                isVolatileMode ? 'bg-purple-500' : 'bg-white/15'
              )}>
                <div className={cn(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                  isVolatileMode ? 'left-4' : 'left-0.5'
                )} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Spekülatif / hareketli coinler için: pozisyon boyutu varsayılan ×0.5 uygulanır.
              {isVolatileMode
                ? <span className="text-purple-400 ml-1">Coin seçimi gerekmez — strateji Binance'in top gainerlarını takip eder.</span>
                : null
              }
            </p>
            {isVolatileMode && (
              <div className="mt-3 space-y-3" onClick={e => e.stopPropagation()}>
                <div>
                  <label className="text-xs text-slate-400">
                    Min. Yükseliş % <span className="text-slate-600">(24s % değişim eşiği, varsayılan %3)</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      {...register('volatileMinChangePct')}
                      type="number" step="0.5" min="0.5" max="50"
                      className={inputCls}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                  </div>
                  {errors.volatileMinChangePct && <p className="text-xs text-red-400 mt-0.5">{errors.volatileMinChangePct.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Top Gainer Limiti <span className="text-slate-600">(kaç coin izlensin, varsayılan 20)</span>
                  </label>
                  <input
                    {...register('volatileGainerLimit')}
                    type="number" step="5" min="5" max="100"
                    className={inputCls + ' mt-1'}
                  />
                  {errors.volatileGainerLimit && <p className="text-xs text-red-400 mt-0.5">{errors.volatileGainerLimit.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Momentum Taze Giriş Filtresi <span className="text-slate-600">(dakika — son N dk'da listeye girenleri al; 0 = devre dışı)</span>
                  </label>
                  <input
                    {...register('momentumFreshFilterMinutes')}
                    type="number" step="1" min="0" max="60"
                    className={inputCls + ' mt-1'}
                  />
                  {errors.momentumFreshFilterMinutes && <p className="text-xs text-red-400 mt-0.5">{errors.momentumFreshFilterMinutes.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Volatil Pozisyon Boyutu % <span className="text-slate-600">(normal boyutun yüzdesi — boş = %50)</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      {...register('volatilePositionSizePct', { setValueAs: v => (v === '' || v == null) ? null : Number(v) })}
                      type="number" step="5" min="1" max="200"
                      placeholder="Ör: 50 (boş = %50)"
                      className={inputCls}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RSI Filter */}
        <div
          onClick={() => setValue('isRsiFilterEnabled', !isRsiFilterEnabled)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            isRsiFilterEnabled
              ? 'bg-cyan-500/10 border-cyan-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors',
            isRsiFilterEnabled ? 'bg-cyan-500/20' : 'bg-white/5'
          )}>
            <BarChart2 size={15} className={isRsiFilterEnabled ? 'text-cyan-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', isRsiFilterEnabled ? 'text-cyan-300' : 'text-slate-300')}>
                RSI Filtresi
              </p>
              <div className={cn(
                'w-8 h-4 rounded-full transition-colors relative shrink-0',
                isRsiFilterEnabled ? 'bg-cyan-500' : 'bg-white/15'
              )}>
                <div className={cn(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                  isRsiFilterEnabled ? 'left-4' : 'left-0.5'
                )} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              RSI, fiyatın ne kadar "aşırı alınmış/satılmış" olduğunu 0-100 arası ölçer. Bu filtre açıkken AL sinyali yalnızca RSI 50'nin üzerindeyken (yani yukarı momentum varken) işleme alınır — zayıf/sahte dönüşleri eler. Ayrıca aşağıdaki <span className="text-cyan-300">üst sınırın</span> üstünde de alım yapılmaz: aşırı alım bölgesinden, yani tepeden giriş engellenir.
            </p>
          </div>
        </div>
        {isRsiFilterEnabled && (
          <div className="pl-2" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-slate-400 block mb-1">RSI Üst Sınırı (aşırı alım)</label>
            <input {...register('rsiMaxValue')} type="number" step="1" min="50" max="100" className={`${inputCls} max-w-xs`} />
            <p className="text-xs text-slate-600 mt-0.5">
              RSI bu değerin üstündeyse AL sinyali bloklanır. Klasik aşırı alım eşiği 70'tir; volatil coinlerde 75–80 daha uygundur.
            </p>
          </div>
        )}

        {/* ADX Filtresi */}
        <div
          onClick={() => setValue('useAdxFilter', !useAdxFilter)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            useAdxFilter
              ? 'bg-violet-500/10 border-violet-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', useAdxFilter ? 'bg-violet-500/20' : 'bg-white/5')}>
            <BarChart2 size={15} className={useAdxFilter ? 'text-violet-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', useAdxFilter ? 'text-violet-300' : 'text-slate-300')}>ADX Filtresi</p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', useAdxFilter ? 'bg-violet-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', useAdxFilter ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ADX (Average Directional Index) trend gücünü ölçer. 25+ değer güçlü bir trend varlığını gösterir. Bu filtre açıkken AL sinyali yalnızca trendin yeterince güçlü olduğunda tetiklenir — yatay piyasadaki sahte dönüşleri engeller.
            </p>
          </div>
        </div>
        {useAdxFilter && (
          <div className="grid grid-cols-2 gap-3 pl-2" onClick={e => e.stopPropagation()}>
            <div>
              <label className="text-xs text-slate-400 block mb-1">ADX Periyot</label>
              <input {...register('adxPeriod')} type="number" step="1" min="5" max="50" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Min ADX Değeri</label>
              <input {...register('adxMinValue')} type="number" step="1" min="10" max="60" className={inputCls} />
              <p className="text-xs text-slate-600 mt-0.5">Önerilen: 20-30 arası</p>
            </div>
          </div>
        )}

        {/* MACD Filtresi */}
        <div
          onClick={() => setValue('useMacdFilter', !useMacdFilter)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            useMacdFilter
              ? 'bg-teal-500/10 border-teal-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', useMacdFilter ? 'bg-teal-500/20' : 'bg-white/5')}>
            <TrendingUp size={15} className={useMacdFilter ? 'text-teal-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', useMacdFilter ? 'text-teal-300' : 'text-slate-300')}>MACD Konfirmasyonu</p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', useMacdFilter ? 'bg-teal-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', useMacdFilter ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              MACD (12,26,9) histogram pozitif olduğunda momentum yukarı yönlüdür. Bu filtre açıkken AL sinyali yalnızca MACD histogram &gt; 0 olduğunda gerçekleşir — T3 dönüşünü momentum ile çifte onaylar.
            </p>
          </div>
        </div>

        {/* Breakeven Stop */}
        <div
          onClick={() => setValue('useBreakevenStop', !useBreakevenStop)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            useBreakevenStop
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', useBreakevenStop ? 'bg-emerald-500/20' : 'bg-white/5')}>
            <DollarSign size={15} className={useBreakevenStop ? 'text-emerald-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', useBreakevenStop ? 'text-emerald-300' : 'text-slate-300')}>Breakeven Stop</p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', useBreakevenStop ? 'bg-emerald-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', useBreakevenStop ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pozisyon belirli bir kâra ulaştığında Stop Loss otomatik olarak giriş fiyatına çekilir. Bu sayede kâra geçilen işlemlerde zarar yaşanmaz — "sıfır zarar noktası" garantisi sağlar.
            </p>
          </div>
        </div>
        {useBreakevenStop && (
          <div className="pl-2" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-slate-400 block mb-1">Tetiklenme Kâr Eşiği (%)</label>
            <input {...register('breakevenTriggerPct')} type="number" step="0.1" min="0.1" max="20" className={`${inputCls} max-w-xs`} />
            <p className="text-xs text-slate-600 mt-0.5">Pozisyon bu % kâra ulaşınca SL giriş fiyatına taşınır. Önerilen: 1.0–2.0</p>
          </div>
        )}

        {/* Üst Zaman Dilimi Onayı */}
        <div
          onClick={() => setValue('useHigherTfConfirm', !useHigherTfConfirm)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            useHigherTfConfirm
              ? 'bg-sky-500/10 border-sky-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', useHigherTfConfirm ? 'bg-sky-500/20' : 'bg-white/5')}>
            <TrendingUp size={15} className={useHigherTfConfirm ? 'text-sky-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', useHigherTfConfirm ? 'text-sky-300' : 'text-slate-300')}>Üst Zaman Dilimi Onayı</p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', useHigherTfConfirm ? 'bg-sky-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', useHigherTfConfirm ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sinyal kısa zaman diliminde oluşsa bile, üst zaman diliminde ana trend aşağıysa alım yapılmaz. Kısa vadeli gürültüye kapılıp trende karşı işlem açmayı önler.
            </p>
          </div>
        </div>
        {useHigherTfConfirm && (
          <div className="pl-2" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-slate-400 block mb-1">Üst Zaman Dilimi</label>
            <select {...register('higherTimeframe')} className={`${inputCls} max-w-xs`}>
              <option value="15m">15 dakika</option>
              <option value="1h">1 saat</option>
              <option value="4h">4 saat</option>
              <option value="1d">1 gün</option>
            </select>
            <p className="text-xs text-slate-600 mt-0.5">
              Trend onayı: fiyat EMA50'nin üstünde ve EMA50 yükseliyor olmalı. Sinyal periyodunun 4–8 katı önerilir (15m sinyal → 1h onay).
            </p>
          </div>
        )}

        {/* Risk Bazlı Pozisyon Boyutu */}
        <div
          onClick={() => setValue('useRiskBasedSizing', !useRiskBasedSizing)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            useRiskBasedSizing
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', useRiskBasedSizing ? 'bg-rose-500/20' : 'bg-white/5')}>
            <Shield size={15} className={useRiskBasedSizing ? 'text-rose-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', useRiskBasedSizing ? 'text-rose-300' : 'text-slate-300')}>Risk Bazlı Pozisyon Boyutu</p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', useRiskBasedSizing ? 'bg-rose-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', useRiskBasedSizing ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sabit tutar yerine <span className="text-rose-300">"her işlemde sermayenin en fazla %X'ini kaybet"</span> mantığı. Pozisyon boyutu stop mesafesine göre hesaplanır: volatil coinde küçük, sakin coinde büyük pozisyon açılır — her işlemin parasal riski eşitlenir.
            </p>
          </div>
        </div>
        {useRiskBasedSizing && (
          <div className="pl-2" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-slate-400 block mb-1">İşlem Başına Risk (%)</label>
            <input {...register('riskPerTradePct')} type="number" step="0.1" min="0.1" max="10" className={`${inputCls} max-w-xs`} />
            <p className="text-xs text-slate-600 mt-0.5">Tek işlemde kaybedilebilecek maksimum sermaye yüzdesi. Profesyonel standart: %1–2.</p>
          </div>
        )}

        {/* Kill Switch */}
        <div className="p-4 rounded-xl border bg-white/[0.03] border-white/8">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <p className="text-sm font-semibold text-slate-300">Kill Switch (Ardışık Zarar Koruması)</p>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Strateji üst üste belirlenen sayıda zarar ederse otomatik olarak <span className="text-amber-300">6 saat duraklatılır</span>. Piyasa rejimi değiştiğinde veya parametreler artık uymadığında sermayenin tükenmesini önleyen son savunma hattıdır. Kârlı bir işlem sayacı sıfırlar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Ardışık Zarar Limiti</label>
              <input {...register('maxConsecutiveLosses')} type="number" step="1" min="2" max="20" className={inputCls} />
              <p className="text-xs text-slate-600 mt-0.5">Önerilen: 4–6</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Drawdown Eşiği (%)</label>
              <input {...register('pauseOnDrawdownPct')} type="number" step="1" min="5" max="50" className={inputCls} />
              <p className="text-xs text-slate-600 mt-0.5">Sermaye bu kadar geri çekilirse duraklat</p>
            </div>
          </div>
        </div>

        {/* ATR Tabanlı Stop */}
        <div
          onClick={() => setValue('useAtrBasedStops', !useAtrBasedStops)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            useAtrBasedStops
              ? 'bg-orange-500/10 border-orange-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors',
            useAtrBasedStops ? 'bg-orange-500/20' : 'bg-white/5'
          )}>
            <TrendingUp size={15} className={useAtrBasedStops ? 'text-orange-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', useAtrBasedStops ? 'text-orange-300' : 'text-slate-300')}>
                ATR Tabanlı Stop/TP
              </p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', useAtrBasedStops ? 'bg-orange-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', useAtrBasedStops ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ATR, coin'in son dönemdeki ortalama fiyat hareket aralığını (oynaklığını) ölçer. Bu açıkken Stop Loss / Take Profit yüzdeleri sabit kalmaz, her coin için kendi oynaklığına göre otomatik hesaplanır — sakin coinde dar, oynak coinde geniş stop konur. <span className="text-slate-600">Önerimiz: önce kapalı bırakın, davranışı öngörmesi daha kolay.</span>
            </p>
          </div>
        </div>
        {useAtrBasedStops && (
          <div className="grid grid-cols-3 gap-3 pl-2" onClick={e => e.stopPropagation()}>
            <div>
              <label className="text-xs text-slate-400 block mb-1">ATR Periyot</label>
              <input {...register('atrPeriod')} type="number" step="1" min="5" max="50" className={inputCls} />
              {errors.atrPeriod && <p className="text-xs text-red-400 mt-0.5">{errors.atrPeriod.message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">SL Çarpanı</label>
              <input {...register('atrSlMultiplier')} type="number" step="0.1" min="0.5" max="10" className={inputCls} />
              {errors.atrSlMultiplier && <p className="text-xs text-red-400 mt-0.5">{errors.atrSlMultiplier.message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">TP Çarpanı</label>
              <input {...register('atrTpMultiplier')} type="number" step="0.1" min="0.5" max="20" className={inputCls} />
              {errors.atrTpMultiplier && <p className="text-xs text-red-400 mt-0.5">{errors.atrTpMultiplier.message}</p>}
            </div>
          </div>
        )}

        {/* Kısmi Kâr Al */}
        <div
          onClick={togglePartialTp}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            usePartialTp
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors', usePartialTp ? 'bg-emerald-500/20' : 'bg-white/5')}>
            <TrendingUp size={15} className={usePartialTp ? 'text-emerald-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', usePartialTp ? 'text-emerald-300' : 'text-slate-300')}>
                Kısmi TP Kullan
              </p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', usePartialTp ? 'bg-emerald-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', usePartialTp ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fiyat girişten belirlenen % yükselince pozisyonun bir kısmı otomatik satılıp kâr kesinleştirilir, kalan kısım pozisyonda kalmaya devam eder. <span className="text-emerald-400">Küçük kazançların elden gitmesini önlemenin en etkili yolu.</span>
            </p>
            {usePartialTp && (
              <div className="grid grid-cols-2 gap-3 mt-3" onClick={e => e.stopPropagation()}>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">TP Hedefi (%)</label>
                  <input {...register('partialTpPct')} type="number" step="0.1" min="0.1" max="100" placeholder="Örn: 1.5" className={inputCls} />
                  <p className="text-xs text-slate-600 mt-0.5">Fiyat bu kadar yükselince tetiklenir</p>
                  {errors.partialTpPct && <p className="text-xs text-red-400 mt-0.5">{errors.partialTpPct.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Kapatılacak Oran (%)</label>
                  <input {...register('partialTpClosePct')} type="number" step="1" min="10" max="90" className={inputCls} />
                  <p className="text-xs text-slate-600 mt-0.5">Pozisyonun ne kadarı satılsın</p>
                  {errors.partialTpClosePct && <p className="text-xs text-red-400 mt-0.5">{errors.partialTpClosePct.message}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hacim Artışı Filtresi */}
        <div
          onClick={() => setValue('isVolumeSurgeFilterEnabled', !isVolumeSurgeFilterEnabled)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            isVolumeSurgeFilterEnabled
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors', isVolumeSurgeFilterEnabled ? 'bg-blue-500/20' : 'bg-white/5')}>
            <Zap size={15} className={isVolumeSurgeFilterEnabled ? 'text-blue-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', isVolumeSurgeFilterEnabled ? 'text-blue-300' : 'text-slate-300')}>
                Hacim Artışı Filtresi
              </p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', isVolumeSurgeFilterEnabled ? 'bg-blue-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', isVolumeSurgeFilterEnabled ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              AL sinyalini yalnızca son mumdaki işlem hacmi, son 20 mumun ortalamasının belirlediğiniz katı kadar üzerindeyken üretir — gerçek bir alım baskısı/heyecan olmadan oluşan sahte/gürültülü hareketleri eler. <span className="text-slate-600">Önerimiz: önce kapalı test edin.</span>
            </p>
            {isVolumeSurgeFilterEnabled && (
              <div className="mt-2" onClick={e => e.stopPropagation()}>
                <label className="text-xs text-slate-400 block mb-1">Çarpan</label>
                <input {...register('volumeSurgeMultiplier')} type="number" step="0.1" min="1" max="10" className={inputCls + ' max-w-28'} />
                {errors.volumeSurgeMultiplier && <p className="text-xs text-red-400 mt-0.5">{errors.volumeSurgeMultiplier.message}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Piyasa Rejimi Filtresi */}
        <div
          onClick={() => setValue('useMarketRegimeFilter', !useMarketRegimeFilter)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            useMarketRegimeFilter
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors', useMarketRegimeFilter ? 'bg-emerald-500/20' : 'bg-white/5')}>
            <DollarSign size={15} className={useMarketRegimeFilter ? 'text-emerald-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', useMarketRegimeFilter ? 'text-emerald-300' : 'text-slate-300')}>
                Piyasa Rejimi Filtresi
              </p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', useMarketRegimeFilter ? 'bg-emerald-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', useMarketRegimeFilter ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              BTC/USDT fiyatı kendi 200 günlük ortalamasının (EMA200) altındayken genel piyasa "ayı" (düşüş) modunda sayılır ve bu durumda yeni AL sinyali üretilmez. Genel piyasa düşerken akıntıya karşı işlem açmayı engelleyerek sermayeyi korur. <span className="text-emerald-400">Önerimiz: açık bırakın.</span>
            </p>
          </div>
        </div>

        {/* Koruma Ayarları — Maksimum Tutma & SL Cooldown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Maks. Tutma Süresi (saat)</label>
            <div className="relative mt-1">
              <input {...register('maxHoldHours')} type="number" step="1" min="1" max="72"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">sa</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Bu süreden uzun açık kalan pozisyon zorla kapatılır. Uzun süre takılıp kalan coinleri serbest bırakır. <span className="text-yellow-400">Önerimiz: 8–12sa.</span>
            </p>
            {errors.maxHoldHours && <p className="text-xs text-red-400 mt-0.5">{errors.maxHoldHours.message}</p>}
          </div>
          <div>
            <label className="text-xs text-slate-400">Stop Loss Cooldown (saat)</label>
            <div className="relative mt-1">
              <input {...register('slCooldownHours')} type="number" step="1" min="0" max="24"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">sa</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Stop Loss ile kapanan coinde bu kadar saat yeniden giriş yapılmaz. Ardı ardına SL vurmasını önler. <span className="text-yellow-400">0 = devre dışı.</span>
            </p>
            {errors.slCooldownHours && <p className="text-xs text-red-400 mt-0.5">{errors.slCooldownHours.message}</p>}
          </div>
        </div>

        {/* Yeşil Mum Filtresi */}
        <div
          onClick={() => setValue('isGreenCandleFilterEnabled', !isGreenCandleFilterEnabled)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            isGreenCandleFilterEnabled
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors', isGreenCandleFilterEnabled ? 'bg-emerald-500/20' : 'bg-white/5')}>
            <TrendingUp size={15} className={isGreenCandleFilterEnabled ? 'text-emerald-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', isGreenCandleFilterEnabled ? 'text-emerald-300' : 'text-slate-300')}>
                Yeşil Mum Filtresi
              </p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', isGreenCandleFilterEnabled ? 'bg-emerald-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', isGreenCandleFilterEnabled ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Son kapanmış mum kırmızıysa (kapanış &lt; açılış) giriş yapılmaz. Trendin tersine, aşağı momentumda giriş yapmayı engeller. <span className="text-emerald-400">Önerimiz: açık bırakın.</span>
            </p>
          </div>
        </div>

        {/* EMA200 Coin Filtresi */}
        <div
          onClick={() => setValue('isEma200RuleEnabled', !isEma200RuleEnabled)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none',
            isEma200RuleEnabled
              ? 'bg-indigo-500/10 border-indigo-500/30'
              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
          )}
        >
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors', isEma200RuleEnabled ? 'bg-indigo-500/20' : 'bg-white/5')}>
            <TrendingUp size={15} className={isEma200RuleEnabled ? 'text-indigo-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', isEma200RuleEnabled ? 'text-indigo-300' : 'text-slate-300')}>
                EMA200 Coin Filtresi
              </p>
              <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', isEma200RuleEnabled ? 'bg-indigo-500' : 'bg-white/15')}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', isEma200RuleEnabled ? 'left-4' : 'left-0.5')} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Her coin için kendi 200 periyotluk EMA'sı hesaplanır; fiyat EMA200'ün altındaysa o coin için AL sinyali üretilmez. Düşüş trendindeki coinlere "dip alımı" yaparak yakalanmayı önler. <span className="text-indigo-400">Önerimiz: açık bırakın.</span>
            </p>
          </div>
        </div>

        {/* Pozisyon Limitleri */}
        <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/8">
          <div className="flex items-center gap-2">
            <DollarSign size={13} className="text-slate-400" />
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Pozisyon Limitleri</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Maks. Eş Zamanlı Pozisyon</label>
              <div className="relative mt-1">
                <input {...register('maxOpenPositions')} type="number" step="1" min="1" max="20" className={inputCls} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">adet</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">Bu strateji aynı anda en fazla kaç coin tutabilir.</p>
              {errors.maxOpenPositions && <p className="text-xs text-red-400 mt-0.5">{(errors.maxOpenPositions as any).message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400">Min. Emir Tutarı (USDT)</label>
              <div className="relative mt-1">
                <input {...register('minPositionSizeUsdt')} type="number" step="1" min="5" max="10000" className={inputCls} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">Bu tutarın altındaki emirler açılmaz. Binance min. 10 USDT gerektirir.</p>
              {errors.minPositionSizeUsdt && <p className="text-xs text-red-400 mt-0.5">{(errors.minPositionSizeUsdt as any).message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Sabit Pozisyon Boyutu <span className="text-slate-600">(opsiyonel)</span>
              </label>
              <div className="relative mt-1">
                <input
                  {...register('maxPositionSizeUsdt', { setValueAs: v => (v === '' || v == null) ? null : Number(v) })}
                  type="number" step="1" min="1"
                  placeholder="Boş = % bazlı hesap"
                  className={inputCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">Her emir bu sabit miktarda açılır. Dolu ise % ayarını geçersiz kılar.</p>
              {errors.maxPositionSizeUsdt && <p className="text-xs text-red-400 mt-0.5">{(errors.maxPositionSizeUsdt as any).message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Pozisyon Boyutu % <span className="text-slate-600">(opsiyonel)</span>
              </label>
              <div className="relative mt-1">
                <input
                  {...register('maxPositionSizePct', { setValueAs: v => (v === '' || v == null) ? null : Number(v) })}
                  type="number" step="1" min="1" max="100"
                  placeholder="Boş = Ayarlar'daki değer"
                  className={inputCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">USDT bakiyesinin yüzdesi. Sabit USDT girilmişse görmezden gelinir.</p>
              {errors.maxPositionSizePct && <p className="text-xs text-red-400 mt-0.5">{(errors.maxPositionSizePct as any).message}</p>}
            </div>
          </div>
        </div>

        {/* Coin selection — sadece volatil mod kapalıyken */}
        {!isVolatileMode ? (
          <div>
            <label className="text-xs text-slate-400 block mb-2">
              Coinler <span className="text-slate-600">(aynı coin birden fazla stratejide kullanılabilir)</span>
            </label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
              {coins.map(c => {
                const sel = selectedCoinIds?.includes(c.id)
                const alreadyUsed = usedCoinIds.has(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => toggleCoin(c.id)}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      sel
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : alreadyUsed
                        ? 'bg-yellow-500/8 border-yellow-500/25 text-yellow-400/70 hover:border-yellow-500/40'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20')}>
                    {sel && <Check size={12} />}
                    {!sel && alreadyUsed && <AlertTriangle size={11} className="text-yellow-500/70" />}
                    {c.symbol}
                  </button>
                )
              })}
            </div>
            {usedCoinIds.size > 0 && coins.some(c => usedCoinIds.has(c.id)) && (
              <p className="text-xs text-yellow-500/60 mt-1.5 flex items-center gap-1">
                <Info size={11} /> Sarı coinler başka aktif stratejilerde de kullanılıyor
              </p>
            )}
            {errors.coinIds && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={12} />{(errors.coinIds as any).message}</p>}
          </div>
        ) : (
          /* Volatil mod aktifken coin seçimi yerine bilgi paneli */
          <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
            <Flame size={15} className="text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Otomatik Coin Takibi</p>
              <p className="text-xs text-slate-500">
                Bu strateji her dakika Binance'in 24 saatlik <span className="text-orange-400">en çok yükselen coinlerini</span> (min %3 yükseliş, min 1M USDT hacim) tarar ve T3 sinyali aldığında işlem açar.
              </p>
              <p className="text-xs text-slate-600 mt-1">Manuel coin seçimi bu modda geçersizdir.</p>
            </div>
          </div>
        )}

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
