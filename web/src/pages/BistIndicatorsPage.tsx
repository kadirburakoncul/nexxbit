import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import { bistApi } from '@/api/bist'
import type { BistIndicatorSetting } from '@/api/bist'
import { Save, Check, AlertCircle, TrendingUp } from 'lucide-react'

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 transition-all'

function SettingCard({ icon, title, desc, children }: {
  icon: React.ReactNode; title: string; desc: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-slate-400 mt-0.5">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function BistIndicatorsPage() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<BistIndicatorSetting>({
    t3Period: 5, t3Factor: 0.7, isRsiFilterEnabled: false, rsiPeriod: 14, rsiBuyThreshold: 50,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['bist-indicator-settings'],
    queryFn: bistApi.getIndicatorSettings,
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: () => bistApi.updateIndicatorSettings(form),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      qc.invalidateQueries({ queryKey: ['bist-indicator-settings'] })
    },
  })

  if (isLoading) return <><Header title="BIST İndikatörler" /><div className="p-6 text-slate-500 text-sm">Yükleniyor…</div></>

  return (
    <>
      <Header title="BIST İndikatörler" />
      <div className="p-3 md:p-6 max-w-xl space-y-4">

        <p className="text-xs text-slate-500">
          Aşağıdaki ayarlar kriptodan tamamen bağımsız — sadece BIST sinyalleri için kullanılır.
          RSI filtresi artık her stratejide ayrıca ayarlanabilir.
        </p>

        {/* T3 Ayarları */}
        <SettingCard
          icon={<TrendingUp size={15} />}
          title="Tillson T3 Parametreleri"
          desc="T3, fiyatın yönünü takip eden yumuşatılmış bir trend göstergesi. Periyot ve faktör değerini kendi BIST analizinize göre ayarlayabilirsiniz."
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Periyot <span className="text-slate-600">(period)</span>
              </label>
              <input
                type="number" min="3" max="50" value={form.t3Period}
                onChange={e => setForm(f => ({ ...f, t3Period: +e.target.value }))}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-600 mt-1">Kaç mumun ortalaması alınsın. Küçük = hızlı tepki, büyük = daha az gürültü. (Tavsiye: 3-8)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Faktör <span className="text-slate-600">(0.1 – 1.0)</span>
              </label>
              <input
                type="number" min="0.1" max="1.0" step="0.05" value={form.t3Factor}
                onChange={e => setForm(f => ({ ...f, t3Factor: +e.target.value }))}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-600 mt-1">Düşük değer daha düz çizgi (az gürültü), yüksek değer fiyata daha yakın tepki. (Tavsiye: 0.7)</p>
            </div>
          </div>
        </SettingCard>

        <div className="bg-white/[0.02] border border-yellow-400/10 rounded-xl p-4">
          <p className="text-xs text-yellow-400/70">
            RSI filtresi her stratejide ayrı ayrı açılıp kapatılabilir. Strateji düzenleme formunda "RSI Filtresi" bölümünü kullanın.
          </p>
        </div>

        {/* Kaydet */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
          >
            <Save size={14} />
            {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <Check size={14} /> Kaydedildi
            </span>
          )}
          {save.isError && (
            <span className="flex items-center gap-1.5 text-sm text-red-400">
              <AlertCircle size={14} /> Hata oluştu
            </span>
          )}
        </div>
      </div>
    </>
  )
}
