import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { binanceApi } from '@/api/binance'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wifi, WifiOff, Trash2, TestTube2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import { useState } from 'react'

const schema = z.object({
  apiKey: z.string().min(10, 'API Key gerekli'),
  apiSecret: z.string().min(10, 'Secret Key gerekli'),
  isTestnet: z.boolean(),
})
type FormData = z.infer<typeof schema>

export default function BinancePage() {
  const qc = useQueryClient()
  const [msg, setMsg] = useState('')

  const { data: status, isLoading } = useQuery({
    queryKey: ['binance-status'],
    queryFn: binanceApi.getStatus,
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isTestnet: false },
  })

  const save = useMutation({
    mutationFn: binanceApi.saveApiKey,
    onSuccess: () => {
      setMsg('API anahtarı kaydedildi.')
      qc.invalidateQueries({ queryKey: ['binance-status'] })
    },
    onError: () => setMsg('Kaydetme başarısız.'),
  })

  const del = useMutation({
    mutationFn: binanceApi.deleteApiKey,
    onSuccess: () => {
      setMsg('API anahtarı silindi.')
      qc.invalidateQueries({ queryKey: ['binance-status'] })
    },
  })

  return (
    <>
      <Header title="Binance Bağlantısı" />
      <div className="p-6 max-w-xl space-y-6">
        {/* Status Card */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-5 flex items-center gap-4">
          {status?.isConnected
            ? <Wifi size={24} className="text-emerald-400" />
            : <WifiOff size={24} className="text-slate-500" />}
          <div>
            <p className={`font-semibold ${status?.isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isLoading ? '…' : status?.isConnected ? 'Binance Bağlı' : 'Binance Bağlı Değil'}
            </p>
            {status?.isConnected && (
              <p className="text-xs text-slate-500 mt-0.5">
                {status.isTestnet ? 'Testnet' : 'Mainnet'} · Spot API
              </p>
            )}
          </div>
          {status?.isConnected && (
            <button
              onClick={() => { if (confirm('API anahtarını silmek istiyor musunuz?')) del.mutate() }}
              className="ml-auto flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
            >
              <Trash2 size={14} /> Sil
            </button>
          )}
        </div>

        {/* Save Form */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">API Anahtarı Kaydet</h2>
          <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            Yalnızca Spot Trading yetkisi verin. Withdrawal yetkisi kesinlikle verilmemelidir.
          </p>

          <form onSubmit={handleSubmit(d => save.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">API Key</label>
              <input {...register('apiKey')} type="text"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-yellow-400/50"
              />
              {errors.apiKey && <p className="text-xs text-red-400 mt-1">{errors.apiKey.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Secret Key</label>
              <input {...register('apiSecret')} type="password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-yellow-400/50"
              />
              {errors.apiSecret && <p className="text-xs text-red-400 mt-1">{errors.apiSecret.message}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input {...register('isTestnet')} type="checkbox"
                className="w-4 h-4 accent-yellow-400 rounded"
              />
              Testnet (deneme amaçlı)
            </label>

            {msg && <p className="text-xs text-yellow-400">{msg}</p>}

            <button type="submit" disabled={isSubmitting || save.isPending}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <TestTube2 size={14} /> Kaydet & Test Et
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
