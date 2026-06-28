import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Header from '@/components/layout/Header'
import { client } from '@/api/client'
import { coinsApi } from '@/api/coins'
import { binanceApi } from '@/api/binance'
import { useState, useEffect } from 'react'
import { ShieldX, ShieldCheck, X, Wifi, WifiOff, Bot, Gauge, Zap, Search, Check, ChevronDown, ChevronUp, Send, AlertTriangle, KeyRound, Sun, Moon, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { useThemeStore } from '@/stores/themeStore'
import { useTimezoneStore, TIMEZONE_OPTIONS } from '@/stores/timezoneStore'

interface RiskSettings {
  tradeMode: number
  maxOrderUsdt: number
  stopLossPct: number
  takeProfitPct: number
  maxOpenPositions: number
  flashCrashProtectionEnabled: boolean
  flashCrashDropPct: number
  flashCrashWindowMinutes: number
  allowedCoinIds: number[]
  blockedCoinIds: number[]
  telegramEnabled: boolean
  telegramBotToken: string | null
  telegramChatId: string | null
}

const schema = z.object({
  tradeMode: z.coerce.number(),
  maxOrderUsdt: z.coerce.number().min(1),
  stopLossPct: z.coerce.number().min(0.1).max(100),
  takeProfitPct: z.coerce.number().min(0.1).max(100),
  maxOpenPositions: z.coerce.number().int().min(1),
  flashCrashProtectionEnabled: z.boolean(),
  flashCrashDropPct: z.coerce.number().min(0.5).max(50),
  flashCrashWindowMinutes: z.coerce.number().int().min(1),
  telegramEnabled: z.boolean(),
  telegramBotToken: z.string().nullable().optional(),
  telegramChatId: z.string().nullable().optional(),
})
type FormData = z.infer<typeof schema>

const TRADE_MODES = [
  { value: 0, label: 'Yalnızca Sinyal', desc: 'İşlem açılmaz, sinyal üretilir' },
  { value: 1, label: 'Manuel Onay', desc: 'Her işlem onay bekler' },
  { value: 2, label: 'Tam Otomatik', desc: 'Sinyaller otomatik işleme alınır' },
]

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50 focus:bg-white/8 transition-all'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { theme, toggle: toggleTheme } = useThemeStore()
  const { timezone, setTimezone } = useTimezoneStore()
  const [saved, setSaved] = useState(false)
  const [coinListSaved, setCoinListSaved] = useState(false)
  const [coinListOpen, setCoinListOpen] = useState(false)
  const [coinSearch, setCoinSearch] = useState('')
  const [telegramTestStatus, setTelegramTestStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')

  const { data: binanceStatus } = useQuery({
    queryKey: ['binance-status'],
    queryFn: binanceApi.getStatus,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery<RiskSettings>({
    queryKey: ['risk-settings'],
    queryFn: () => client.get('/risksettings').then(r => r.data),
  })

  const { data: coins } = useQuery({ queryKey: ['coins'], queryFn: coinsApi.list })

  const [allowedIds, setAllowedIds] = useState<number[]>([])
  const [blockedIds, setBlockedIds] = useState<number[]>([])

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  useEffect(() => {
    if (data) {
      reset(data)
      setAllowedIds(data.allowedCoinIds ?? [])
      setBlockedIds(data.blockedCoinIds ?? [])
    }
  }, [data, reset])

  const save = useMutation({
    mutationFn: (d: FormData) => client.put('/risksettings', d),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      qc.invalidateQueries({ queryKey: ['risk-settings'] })
    },
  })

  const saveCoinLists = useMutation({
    mutationFn: () => client.put('/risksettings/coin-lists', { allowedCoinIds: allowedIds, blockedCoinIds: blockedIds }),
    onSuccess: () => {
      setCoinListSaved(true)
      setTimeout(() => setCoinListSaved(false), 3000)
    },
  })

  const flashOn = watch('flashCrashProtectionEnabled')
  const telegramOn = watch('telegramEnabled')
  const telegramToken = watch('telegramBotToken')
  const telegramChat = watch('telegramChatId')

  const testTelegram = async () => {
    if (!telegramToken || !telegramChat) return
    setTelegramTestStatus('loading')
    try {
      await client.post('/risksettings/telegram/test', { botToken: telegramToken, chatId: telegramChat })
      setTelegramTestStatus('ok')
    } catch {
      setTelegramTestStatus('fail')
    }
    setTimeout(() => setTelegramTestStatus('idle'), 4000)
  }

  const filteredCoins = coins?.filter(c =>
    c.isInWatchlist &&
    c.symbol.toLowerCase().includes(coinSearch.toLowerCase()) &&
    !allowedIds.includes(c.id) && !blockedIds.includes(c.id)
  )

  if (isLoading) return (
    <>
      <Header title="Ayarlar" />
      <div className="p-6 text-slate-500 text-sm">Yükleniyor…</div>
    </>
  )

  return (
    <>
      <Header title="Ayarlar" />
      <div className="p-3 md:p-6 max-w-2xl space-y-3">

        {/* Binance Connection Banner */}
        <div className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3 border',
          binanceStatus?.isConnected
            ? 'bg-emerald-500/5 border-emerald-500/15'
            : 'bg-amber-500/5 border-amber-500/20'
        )}>
          {binanceStatus?.isConnected
            ? <Wifi size={15} className="text-emerald-400 shrink-0" />
            : <WifiOff size={15} className="text-amber-400 shrink-0" />}
          <p className={cn('text-sm font-medium flex-1', binanceStatus?.isConnected ? 'text-emerald-400' : 'text-amber-400')}>
            {binanceStatus?.isConnected
              ? `Binance bağlı — ${binanceStatus.isTestnet ? 'Testnet' : 'Mainnet'}`
              : 'Binance API anahtarı bağlı değil'}
          </p>
          <Link
            to="/binance"
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {binanceStatus?.isConnected ? 'Yönet' : 'Bağla →'}
          </Link>
        </div>

        <form onSubmit={handleSubmit(d => save.mutate(d as any))} className="space-y-3">

          {/* Trade Mode */}
          <Section icon={<Bot size={15} />} title="İşlem Modu">
            <div className="space-y-2">
              {TRADE_MODES.map(m => {
                const isSelected = Number(watch('tradeMode')) === m.value
                return (
                  <label key={m.value} className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    isSelected
                      ? 'bg-yellow-400/8 border-yellow-400/30'
                      : 'bg-white/3 border-white/8 hover:border-white/15'
                  )}>
                    <input {...register('tradeMode')} type="radio" value={m.value} className="hidden" />
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'border-yellow-400' : 'border-white/20'
                    )}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn('text-sm font-medium', isSelected ? 'text-yellow-400' : 'text-slate-200')}>{m.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                    {isSelected && <Check size={14} className="text-yellow-400 shrink-0" />}
                  </label>
                )
              })}
            </div>
          </Section>

          {/* Position Limits */}
          <Section icon={<Gauge size={15} />} title="Pozisyon Limitleri">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Maks. İşlem (USDT)" error={errors.maxOrderUsdt?.message}>
                <input {...register('maxOrderUsdt')} type="number" step="1" className={inputCls} />
              </Field>
              <Field label="Maks. Açık Pozisyon" error={errors.maxOpenPositions?.message}>
                <input {...register('maxOpenPositions')} type="number" min="1" className={inputCls} />
              </Field>
              <Field label="Stop Loss %" error={errors.stopLossPct?.message}>
                <input {...register('stopLossPct')} type="number" step="0.1" className={inputCls} />
              </Field>
              <Field label="Take Profit %" error={errors.takeProfitPct?.message}>
                <input {...register('takeProfitPct')} type="number" step="0.1" className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* Flash Crash */}
          <Section icon={<Zap size={15} />} title="Flash Crash Koruması">
            <Toggle
              register={register('flashCrashProtectionEnabled')}
              label="Korumayı Etkinleştir"
            />
            {flashOn && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/5">
                <Field label="Düşüş Eşiği %" error={errors.flashCrashDropPct?.message}>
                  <input {...register('flashCrashDropPct')} type="number" step="0.5" className={inputCls} />
                </Field>
                <Field label="Zaman Penceresi (dk)" error={errors.flashCrashWindowMinutes?.message}>
                  <input {...register('flashCrashWindowMinutes')} type="number" min="1" className={inputCls} />
                </Field>
              </div>
            )}
          </Section>

          {/* Telegram */}
          <Section icon={<Send size={15} />} title="Telegram Bildirimleri">
            <Toggle
              register={register('telegramEnabled')}
              label="Bildirimleri Etkinleştir"
            />
            {telegramOn && (
              <div className="space-y-3 mt-3 pt-3 border-t border-white/5">
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Bot Token">
                    <input {...register('telegramBotToken')} type="text" placeholder="123456789:AAHdqTcv…" className={inputCls} />
                  </Field>
                  <Field label="Chat ID">
                    <input {...register('telegramChatId')} type="text" placeholder="-1001234567890" className={inputCls} />
                  </Field>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={testTelegram}
                    disabled={!telegramToken || !telegramChat || telegramTestStatus === 'loading'}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-40 transition-all"
                  >
                    <Send size={13} />
                    {telegramTestStatus === 'loading' ? 'Gönderiliyor…' : 'Test Et'}
                  </button>
                  {telegramTestStatus === 'ok' && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-400"><Check size={13} /> Mesaj gönderildi</span>
                  )}
                  {telegramTestStatus === 'fail' && (
                    <span className="flex items-center gap-1.5 text-sm text-red-400"><AlertTriangle size={13} /> Gönderilemedi</span>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || save.isPending}
              className="bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 disabled:opacity-50 text-black font-semibold px-6 py-2.5 rounded-xl transition-all text-sm"
            >
              {isSubmitting || save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <Check size={14} /> Kaydedildi
              </span>
            )}
            {save.isError && (
              <span className="flex items-center gap-1.5 text-sm text-red-400">
                <AlertTriangle size={14} /> Hata oluştu
              </span>
            )}
          </div>
        </form>

        {/* Password Change */}
        <ChangePasswordSection />

        {/* Coin Filter */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setCoinListOpen(o => !o)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/3 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <ShieldCheck size={14} className="text-slate-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-slate-200">Coin Filtresi</p>
              <p className="text-xs text-slate-500">
                {allowedIds.length > 0 ? `${allowedIds.length} coin izinli` : 'Tümü izinli'}
                {blockedIds.length > 0 ? ` · ${blockedIds.length} engellenmiş` : ''}
              </p>
            </div>
            {coinListOpen ? <ChevronUp size={15} className="text-slate-600" /> : <ChevronDown size={15} className="text-slate-600" />}
          </button>

          {coinListOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-white/5">
              {/* Search */}
              <div className="relative mt-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  value={coinSearch}
                  onChange={e => setCoinSearch(e.target.value)}
                  placeholder="Coin ara…"
                  className={cn(inputCls, 'pl-8 max-w-48')}
                />
              </div>

              {/* Coin picker */}
              {filteredCoins && filteredCoins.length > 0 && coinSearch && (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {filteredCoins.slice(0, 30).map(c => (
                    <div key={c.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAllowedIds(prev => [...prev, c.id])}
                        className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                      >
                        <ShieldCheck size={10} className="inline mr-1" />{c.symbol}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockedIds(prev => [...prev, c.id])}
                        className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                      >
                        <ShieldX size={10} className="inline mr-1" />{c.symbol}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1.5">
                    <ShieldCheck size={12} /> İzin Verilenler ({allowedIds.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 min-h-8">
                    {allowedIds.map(id => {
                      const coin = coins?.find(c => c.id === id)
                      return coin ? (
                        <span key={id} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {coin.symbol}
                          <button type="button" onClick={() => setAllowedIds(prev => prev.filter(x => x !== id))}><X size={10} /></button>
                        </span>
                      ) : null
                    })}
                    {allowedIds.length === 0 && <span className="text-xs text-slate-600">Tümü izinli</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1.5">
                    <ShieldX size={12} /> Engellenenler ({blockedIds.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 min-h-8">
                    {blockedIds.map(id => {
                      const coin = coins?.find(c => c.id === id)
                      return coin ? (
                        <span key={id} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                          {coin.symbol}
                          <button type="button" onClick={() => setBlockedIds(prev => prev.filter(x => x !== id))}><X size={10} /></button>
                        </span>
                      ) : null
                    })}
                    {blockedIds.length === 0 && <span className="text-xs text-slate-600">Engel yok</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => saveCoinLists.mutate()}
                  disabled={saveCoinLists.isPending}
                  className="bg-white/8 hover:bg-white/12 disabled:opacity-50 text-slate-200 font-medium px-4 py-2 rounded-xl text-sm transition-all border border-white/10"
                >
                  {saveCoinLists.isPending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                {coinListSaved && <span className="flex items-center gap-1.5 text-sm text-emerald-400"><Check size={14} /> Kaydedildi</span>}
              </div>
            </div>
          )}
        </div>

        {/* Görünüm + Saat Dilimi */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
              <Sun size={14} />
            </div>
            <p className="text-sm font-semibold text-slate-200">Görünüm & Saat Dilimi</p>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-slate-300">Tema</p>
              <p className="text-xs text-slate-600">Arayüz renk şeması</p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-slate-800/60 border-white/10 text-slate-200 hover:border-white/20'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              )}
            >
              {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'dark' ? 'Koyu' : 'Açık'}
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Globe size={13} className="text-slate-500" />
              <label className="text-sm text-slate-300">Saat Dilimi</label>
            </div>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-600">Tarih/saat gösterimleri bu dilime göre formatlanır.</p>
          </div>
        </div>

      </div>
    </>
  )
}

function Section({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
          {icon}
        </div>
        <p className="text-sm font-semibold text-slate-200">{title}</p>
      </div>
      {children}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

// ─── Şifre Değiştir ───────────────────────────────────────────────────────────
const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
  newPassword: z.string().min(6, 'En az 6 karakter'),
  confirmPassword: z.string().min(1, 'Şifre tekrarı gerekli'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
})
type PwFormData = z.infer<typeof pwSchema>

function ChangePasswordSection() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PwFormData>({
    resolver: zodResolver(pwSchema) as any,
  })

  const onSubmit = async (data: PwFormData) => {
    setServerError(null)
    try {
      await client.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      setStatus('ok')
      reset()
      setTimeout(() => setStatus('idle'), 4000)
    } catch (e: any) {
      const msg = e?.response?.data?.errors?.[0] ?? e?.response?.data?.message ?? 'Şifre değiştirilemedi.'
      setServerError(msg)
      setStatus('error')
    }
  }

  return (
    <Section icon={<KeyRound size={15} />} title="Şifre Değiştir">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Mevcut Şifre" error={errors.currentPassword?.message}>
          <input {...register('currentPassword')} type="password" autoComplete="current-password" className={inputCls} />
        </Field>
        <Field label="Yeni Şifre" error={errors.newPassword?.message}>
          <input {...register('newPassword')} type="password" autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="Yeni Şifre (Tekrar)" error={errors.confirmPassword?.message}>
          <input {...register('confirmPassword')} type="password" autoComplete="new-password" className={inputCls} />
        </Field>

        {serverError && (
          <p className="flex items-center gap-1.5 text-sm text-red-400">
            <AlertTriangle size={13} /> {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-white/8 hover:bg-white/12 disabled:opacity-50 text-slate-200 font-medium px-5 py-2.5 rounded-xl text-sm transition-all border border-white/10"
          >
            {isSubmitting ? 'Değiştiriliyor…' : 'Şifreyi Değiştir'}
          </button>
          {status === 'ok' && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <Check size={14} /> Şifre güncellendi
            </span>
          )}
        </div>
      </form>
    </Section>
  )
}

function Toggle({ register, label }: { register: any; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer w-fit">
      <div className="relative">
        <input {...register} type="checkbox" className="sr-only peer" />
        <div className="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-yellow-400/80 transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  )
}
