import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { binanceApi } from '@/api/binance'
import type { Balance } from '@/api/binance'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Wifi, WifiOff, Trash2, ShieldAlert, Key, Eye, EyeOff,
  Clock, CheckCircle2, XCircle, RefreshCw, TrendingUp, Wallet,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const schema = z.object({
  apiKey: z.string().min(10, 'API Key gerekli'),
  apiSecret: z.string().min(10, 'Secret Key gerekli'),
  isTestnet: z.boolean(),
})
type FormData = z.infer<typeof schema>

function BalanceTable({ balances }: { balances: Balance[] }) {
  const nonZero = balances.filter(b => b.free + b.locked > 0.00001)
  if (nonZero.length === 0)
    return <p className="text-slate-500 text-sm text-center py-6">Bakiye bulunamadi.</p>

  const usdtBal = nonZero.find(b => b.asset === 'USDT')
  const totalUsdt = usdtBal ? usdtBal.free + usdtBal.locked : 0

  return (
    <div className="space-y-3">
      {totalUsdt > 0 && (
        <div className="flex items-center gap-3 bg-yellow-400/5 border border-yellow-400/15 rounded-xl px-4 py-3">
          <TrendingUp size={16} className="text-yellow-400 shrink-0" />
          <span className="text-xs text-slate-400">USDT Bakiyesi</span>
          <span className="ml-auto font-bold text-yellow-400 tabular-nums">
            {totalUsdt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase border-b border-white/5">
              <th className="text-left py-2 pr-4">Varlik</th>
              <th className="text-right py-2 pr-4">Kullanilabilir</th>
              <th className="text-right py-2">Kilitli</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {nonZero.map(b => (
              <tr key={b.asset} className="hover:bg-white/5 transition-colors">
                <td className="py-2.5 pr-4 font-medium text-slate-200">{b.asset}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-slate-300">
                  {b.free.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 8 })}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {b.locked > 0
                    ? b.locked.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 8 })
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const STEPS = [
  'Binance hesabiniza giris yapin, sag ust profil menusu altindaki API Yonetimi sayfasini acin.',
  'Yeni API olustur secenegine tiklayin, anahtara bir isim verin ve dogrulama adimlarini tamamlayin.',
  'IP erisim kisitlamasi bolumune sunucu IP adresini girin:',
  'Duzenleme ekraninda yalnizca Spot ve Marjin Islemleri iznini aktif edin; diger tum izinleri kapali birakin.',
  'API Key ve Secret Key degerlerini kopyalayip asagidaki forma yapistirin.',
]

export default function BinancePage() {
  const qc = useQueryClient()
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [showBalances, setShowBalances] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['binance-status'],
    queryFn: binanceApi.getStatus,
  })

  const { data: balances, isFetching: balLoading, refetch: refetchBal } = useQuery({
    queryKey: ['binance-balances'],
    queryFn: binanceApi.getBalances,
    enabled: showBalances && status?.isConnected === true,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isTestnet: false },
  })

  const save = useMutation({
    mutationFn: binanceApi.saveApiKey,
    onSuccess: () => {
      setSaveOk(true)
      setSaveError('')
      reset()
      qc.invalidateQueries({ queryKey: ['binance-status'] })
      setTimeout(() => setSaveOk(false), 4000)
    },
    onError: (err: unknown) => {
      const e = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      setSaveError(e?.[0] ?? 'Baglanti kurulamadi. API anahtarini ve yetkilerini kontrol edin.')
    },
  })

  const del = useMutation({
    mutationFn: binanceApi.deleteApiKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binance-status'] })
      setShowBalances(false)
    },
  })

  const connected = status?.isConnected

  return (
    <>
      <Header title="Binance" />
      <div className="p-3 md:p-6 max-w-2xl space-y-5">

        {/* Baglanti Durumu */}
        <div className={`rounded-2xl border p-5 flex items-center gap-4 transition-colors ${
          connected ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            connected ? 'bg-emerald-500/10' : 'bg-white/5'
          }`}>
            {connected
              ? <Wifi size={22} className="text-emerald-400" />
              : <WifiOff size={22} className="text-slate-500" />}
          </div>

          <div className="flex-1 min-w-0">
            {isLoading ? (
              <p className="text-slate-500 text-sm">Kontrol ediliyor...</p>
            ) : connected ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-emerald-400">Baglanti Aktif</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    status.isTestnet
                      ? 'bg-amber-400/15 text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {status.isTestnet ? 'Testnet' : 'Mainnet'}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {status.apiKeyHint && (
                    <p className="text-xs text-slate-500 font-mono">{status.apiKeyHint}</p>
                  )}
                  {status.lastConnectionAt && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={10} />
                      {format(new Date(status.lastConnectionAt), 'dd MMM HH:mm', { locale: tr })}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-400">Baglanti Yok</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Asagiya API anahtarinizi girerek baglanti kurun.
                </p>
              </>
            )}
          </div>

          {connected && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowBalances(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  showBalances
                    ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wallet size={12} /> Bakiye
              </button>
              <button
                onClick={() => { if (confirm('API anahtarini kaldirmak istediginize emin misiniz?')) del.mutate() }}
                disabled={del.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 size={12} /> Kaldir
              </button>
            </div>
          )}
        </div>

        {/* Bakiyeler */}
        {showBalances && connected && (
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200">Spot Cuzdan</h2>
              <button
                onClick={() => refetchBal()}
                disabled={balLoading}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw size={14} className={balLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            {balLoading
              ? <p className="text-slate-500 text-sm text-center py-6">Yukleniyor...</p>
              : <BalanceTable balances={balances ?? []} />
            }
          </div>
        )}

        {/* API Key Formu */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
              <Key size={14} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                {connected ? 'API Anahtarini Guncelle' : 'API Anahtari Bagla'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Binance hesabinizdan urettiginiz anahtari girin</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/15 rounded-xl px-4 py-3">
            <ShieldAlert size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400/80 leading-relaxed">
              API anahtariniza yalnizca <strong className="text-amber-400">Spot Islem</strong> yetkisi verin.
              Cekim (Withdrawal) yetkisi <strong className="text-amber-400">kesinlikle verilmemelidir</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit(d => save.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">API Key</label>
              <input
                {...register('apiKey')}
                type="text"
                autoComplete="off"
                placeholder="Binance API anahtarinizi yapistirin"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 transition-colors"
              />
              {errors.apiKey && <p className="text-xs text-red-400 mt-1.5">{errors.apiKey.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Secret Key</label>
              <div className="relative">
                <input
                  {...register('apiSecret')}
                  type={showSecret ? 'text' : 'password'}
                  autoComplete="off"
                  placeholder="Secret anahtarinizi yapistirin"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.apiSecret && <p className="text-xs text-red-400 mt-1.5">{errors.apiSecret.message}</p>}
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative shrink-0">
                <input {...register('isTestnet')} type="checkbox" className="sr-only peer" />
                <div className="w-9 h-5 rounded-full bg-white/10 peer-checked:bg-yellow-400 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-all peer-checked:translate-x-4" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Testnet</p>
                <p className="text-xs text-slate-600">Gercek para kullanmadan deneme ortami</p>
              </div>
            </label>

            {saveError && (
              <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400">{saveError}</p>
              </div>
            )}
            {saveOk && (
              <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-400">API anahtari dogrulandi ve kaydedildi.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || save.isPending}
              className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {save.isPending
                ? <><RefreshCw size={14} className="animate-spin" /> Dogrulanıyor...</>
                : <><Wifi size={14} /> Baglan ve Kaydet</>
              }
            </button>
          </form>
        </div>

        {/* Rehber */}
        <div className="bg-white/5 border border-white/5 rounded-2xl px-5 py-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nasil API Anahtari Alinir?</h3>
          <ol className="space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-xs text-slate-500">
                <span className="shrink-0 w-4 h-4 rounded-full bg-white/10 text-slate-400 text-[10px] flex items-center justify-center font-bold mt-0.5">
                  {i + 1}
                </span>
                <span>
                  {step}
                  {i === 2 && (
                    <code className="ml-1.5 px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-mono text-[11px] select-all cursor-text">
                      70.40.139.10
                    </code>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>

      </div>
    </>
  )
}
