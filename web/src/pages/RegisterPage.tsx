import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Mail, Lock, User, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react'

const schema = z.object({
  firstName: z.string().min(1, 'Ad gerekli'),
  lastName: z.string().min(1, 'Soyad gerekli'),
  email: z.string().email('Geçerli e-posta giriniz'),
  password: z.string()
    .min(8, 'En az 8 karakter olmalı')
    .regex(/[A-Z]/, 'En az 1 büyük harf içermeli'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError('')
    try {
      const res = await authApi.register(data)
      setTokens(res.accessToken, res.refreshToken)
      setRegistered(data.email)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0]
      setError(msg ?? 'Kayıt başarısız.')
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080d]">
        <div className="w-full max-w-[400px] px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 mb-5">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Hesabınız oluşturuldu!</h1>
          <p className="text-sm text-slate-400 mb-1">
            <span className="text-yellow-400">{registered}</span> adresine doğrulama e-postası gönderildi.
          </p>
          <p className="text-sm text-slate-500 mb-6">Lütfen e-postanızı kontrol edin ve hesabınızı doğrulayın.</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-xl text-sm transition-all"
          >
            Uygulamaya Git
          </button>
          <p className="text-xs text-slate-600 mt-4">E-posta gelmedi? Spam klasörünüzü kontrol edin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080d] relative overflow-hidden py-8">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[420px] px-4 relative z-10">
        {/* Brand */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <TrendingUp size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl tracking-tight">
            <span className="font-bold text-yellow-400">NEXX</span><span className="font-light text-white">BIT</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Yeni hesap oluşturun</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-7 backdrop-blur-sm shadow-2xl">
          <h2 className="text-base font-semibold text-slate-200 mb-5">Hesap Oluştur</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Ad</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input {...register('firstName')} placeholder="Ad"
                    className={inputCls + ' pl-8'} />
                </div>
                {errors.firstName && <p className="text-xs text-red-400 mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Soyad</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input {...register('lastName')} placeholder="Soyad"
                    className={inputCls + ' pl-8'} />
                </div>
                {errors.lastName && <p className="text-xs text-red-400 mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">E-posta</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input {...register('email')} type="email" placeholder="ornek@email.com"
                  autoComplete="email" className={inputCls + ' pl-9'} />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Şifre</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input {...register('password')} type="password" placeholder="En az 8 karakter, 1 büyük harf"
                  autoComplete="new-password" className={inputCls + ' pl-9'} />
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.password.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Şifre Tekrar</label>
              <div className="relative">
                <CheckCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input {...register('confirmPassword')} type="password" placeholder="••••••••"
                  autoComplete="new-password" className={inputCls + ' pl-9'} />
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword.message}</p>}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl transition-all text-sm mt-1"
            >
              {isSubmitting ? 'Hesap oluşturuluyor…' : 'Kayıt Ol'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-5">
          Hesabınız var mı?{' '}
          <Link to="/login" className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors">Giriş yapın</Link>
        </p>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 focus:bg-white/8 transition-all'
