import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { authApi } from '@/api/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
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
          {sent ? (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 mb-4">
                <CheckCircle size={24} className="text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-slate-200 mb-2">E-posta gönderildi</h2>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-yellow-400">{email}</span> adresine şifre sıfırlama bağlantısı gönderildi.
              </p>
              <p className="text-xs text-slate-500 mt-2">Bağlantı 1 saat geçerlidir. Spam klasörünüzü de kontrol edin.</p>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-200 mb-1">Şifremi Unuttum</h2>
              <p className="text-xs text-slate-500 mb-5">E-posta adresinizi girin, sıfırlama bağlantısı gönderelim.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">E-posta</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="ornek@email.com"
                      autoComplete="email"
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
                  disabled={loading || !email}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl text-sm transition-all"
                >
                  {loading ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-600 mt-5">
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-slate-500 hover:text-yellow-400 transition-colors">
            <ArrowLeft size={14} /> Giriş sayfasına dön
          </Link>
        </p>
      </div>
    </div>
  )
}
