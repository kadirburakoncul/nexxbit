import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Mail, Lock, AlertCircle, TrendingUp } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Geçerli e-posta giriniz'),
  password: z.string().min(6, 'En az 6 karakter'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError('')
    try {
      const res = await authApi.login(data)
      setTokens(res.accessToken, res.refreshToken)
      navigate('/', { replace: true })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0]
      setError(msg ?? 'E-posta veya şifre hatalı.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080d] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-yellow-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-violet-500/4 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[400px] px-4 relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <TrendingUp size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl tracking-tight">
            <span className="font-bold text-yellow-400">NEXX</span><span className="font-light text-white">BIT</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Otomatik kripto ve borsa işlem platformu</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-7 backdrop-blur-sm shadow-2xl">
          <h2 className="text-base font-semibold text-slate-200 mb-5">Hesabınıza giriş yapın</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">E-posta</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="ornek@email.com"
                  autoComplete="email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 focus:bg-white/8 transition-all"
                />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-400">Şifre</label>
                <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-yellow-400 transition-colors">Şifremi unuttum</Link>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 focus:bg-white/8 transition-all"
                />
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.password.message}</p>}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl transition-all text-sm mt-1"
            >
              {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-5">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors">Kayıt olun</Link>
        </p>
      </div>
    </div>
  )
}
