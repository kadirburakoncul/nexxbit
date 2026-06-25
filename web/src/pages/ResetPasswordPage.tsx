import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Lock, AlertCircle, CheckCircle } from 'lucide-react'
import { authApi } from '@/api/auth'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('En az 8 karakter olmalı.'); return }
    if (!/[A-Z]/.test(password)) { setError('En az 1 büyük harf içermeli.'); return }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return }

    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0]
      setError(msg ?? 'Bir hata oluştu. Bağlantı geçersiz veya süresi dolmuş olabilir.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080d]">
        <div className="text-center px-4">
          <p className="text-red-400 mb-4">Geçersiz bağlantı.</p>
          <Link to="/login" className="text-yellow-400 hover:text-yellow-300 text-sm">Giriş sayfasına dön</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080d]">
      <div className="w-full max-w-[400px] px-4">
        <div className="text-center mb-7">
          <h1 className="text-2xl tracking-tight mb-1">
            <span className="font-bold text-yellow-400">NEXX</span><span className="font-light text-white">BIT</span>
          </h1>
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-7 backdrop-blur-sm">
          {done ? (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 mb-4">
                <CheckCircle size={24} className="text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-slate-200 mb-2">Şifre güncellendi!</h2>
              <p className="text-sm text-slate-400 mb-5">Yeni şifrenizle giriş yapabilirsiniz.</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-xl text-sm transition-all"
              >
                Giriş Yap
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Yeni Şifre Belirle</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Yeni Şifre</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="En az 8 karakter, 1 büyük harf"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 focus:bg-white/8 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Şifre Tekrar</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 focus:bg-white/8 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl text-sm transition-all"
                >
                  {loading ? 'Kaydediliyor…' : 'Şifremi Güncelle'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
