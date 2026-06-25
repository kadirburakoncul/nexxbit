import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { authApi } from '@/api/auth'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Geçersiz doğrulama bağlantısı.')
      return
    }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0]
        setMessage(msg ?? 'Doğrulama başarısız. Bağlantı geçersiz veya süresi dolmuş olabilir.')
        setStatus('error')
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080d]">
      <div className="w-full max-w-[400px] px-4 text-center">
        <h1 className="text-2xl tracking-tight mb-7">
          <span className="font-bold text-yellow-400">NEXX</span><span className="font-light text-white">BIT</span>
        </h1>

        {status === 'loading' && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <Loader size={32} className="text-yellow-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">E-posta doğrulanıyor…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 mb-5">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">E-posta Doğrulandı!</h2>
            <p className="text-sm text-slate-400 mb-6">Hesabınız başarıyla doğrulandı. Artık tüm özellikleri kullanabilirsiniz.</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              Uygulamaya Git
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-400/10 border border-red-400/20 mb-5">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Doğrulama Başarısız</h2>
            <p className="text-sm text-slate-400 mb-6">{message || 'Bağlantı geçersiz veya süresi dolmuş.'}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium py-2.5 rounded-xl text-sm transition-all"
            >
              Giriş Sayfasına Dön
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
