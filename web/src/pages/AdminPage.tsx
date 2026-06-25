import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/api/client'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { Users, LayoutDashboard, Trash2, RotateCcw, KeyRound, X } from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface AdminDashboardDto {
  totalUsers: number; activeUsers: number; connectedBinanceUsers: number
  totalSignalsToday: number; totalOrdersToday: number; activeBacktests: number; totalBacktests: number
}
interface AdminUserDto {
  id: string; email: string; firstName: string; lastName: string
  role: number; isEmailVerified: boolean; isDeleted: boolean
  hasBinanceAccount: boolean; createdAt: string; lastLoginAt?: string
}

const ROLE_BG = { 0: 'bg-red-500/20 text-red-400', 1: 'bg-slate-500/20 text-slate-400' }

function AdminDashboard() {
  const { data, isLoading } = useQuery<AdminDashboardDto>({
    queryKey: ['admin-dashboard'],
    queryFn: () => client.get('/admin/dashboard').then(r => r.data),
  })

  const stats = data ? [
    { label: 'Toplam Kullanıcı', value: data.totalUsers },
    { label: 'Aktif Kullanıcı', value: data.activeUsers },
    { label: 'Binance Bağlı', value: data.connectedBinanceUsers },
    { label: 'Bugün Sinyal', value: data.totalSignalsToday },
    { label: 'Bugün Emir', value: data.totalOrdersToday },
    { label: 'Aktif Backtest', value: data.activeBacktests },
  ] : []

  return (
    <>
      <Header title="Admin — Dashboard" />
      <div className="p-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="col-span-3 text-slate-500">Yükleniyor…</p>}
        {stats.map(s => (
          <div key={s.label} className="bg-white/5 border border-white/5 rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase">{s.label}</p>
            <p className="text-3xl font-bold text-slate-100 mt-2">{s.value}</p>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Credentials Modal ───────────────────────────────────────────────────────
function CredentialsModal({ user, onClose }: { user: AdminUserDto; onClose: () => void }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const update = useMutation({
    mutationFn: () => client.put(`/admin/users/${user.id}/credentials`, {
      newEmail: email !== user.email ? email.trim() : null,
      newPassword: password.length > 0 ? password : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose() },
    onError: (e: any) => setError(e?.response?.data?.errors?.[0] ?? e?.response?.data?.message ?? 'Hata oluştu'),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#13141a] border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Kimlik Bilgilerini Düzenle</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-500">{user.firstName} {user.lastName}</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">E-posta</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Yeni Şifre <span className="text-slate-600">(boş bırakırsan değişmez)</span></label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="En az 6 karakter"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-slate-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">İptal</button>
          <button
            onClick={() => update.mutate()}
            disabled={update.isPending}
            className="flex-1 py-2 text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black rounded-lg transition-colors"
          >
            {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminUsers() {
  const qc = useQueryClient()
  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null)
  const { data, isLoading } = useQuery<{ items: AdminUserDto[]; total: number }>({
    queryKey: ['admin-users'],
    queryFn: () => client.get('/admin/users?pageSize=50').then(r => r.data),
  })

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: number }) =>
      client.put(`/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const softDelete = useMutation({
    mutationFn: (id: string) => client.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const restore = useMutation({
    mutationFn: (id: string) => client.post(`/admin/users/${id}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <>
      <Header title="Admin — Kullanıcılar" />
      {editingUser && <CredentialsModal user={editingUser} onClose={() => setEditingUser(null)} />}
      <div className="p-6">
        <div className="bg-white/5 border border-white/5 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                <th className="text-left px-5 py-3">Ad</th>
                <th className="text-left px-5 py-3">E-posta</th>
                <th className="text-left px-5 py-3">Rol</th>
                <th className="text-center px-5 py-3">Binance</th>
                <th className="text-right px-5 py-3">Kayıt</th>
                <th className="text-right px-5 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Yükleniyor…</td></tr>}
              {data?.items.map(u => (
                <tr key={u.id} className={`hover:bg-white/5 transition-colors ${u.isDeleted ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-slate-200">{u.firstName} {u.lastName}</td>
                  <td className="px-5 py-3 text-slate-400">{u.email}</td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      onChange={e => setRole.mutate({ id: u.id, role: Number(e.target.value) })}
                      className={`text-xs px-2 py-0.5 rounded border-0 bg-transparent font-medium ${ROLE_BG[u.role as 0 | 1] ?? ''}`}
                    >
                      <option value={0}>Admin</option>
                      <option value={1}>Kullanıcı</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`w-2 h-2 rounded-full inline-block ${u.hasBinanceAccount ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500 text-xs">
                    {format(new Date(u.createdAt), 'dd MMM yy', { locale: tr })}
                  </td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="text-yellow-500/70 hover:text-yellow-400 p-1 transition-colors"
                      title="E-posta / Şifre Değiştir"
                    >
                      <KeyRound size={14} />
                    </button>
                    {u.isDeleted
                      ? <button onClick={() => restore.mutate(u.id)} className="text-slate-400 hover:text-slate-200 p-1" title="Geri al"><RotateCcw size={14} /></button>
                      : <button onClick={() => { if (confirm('Kullanıcıyı sil?')) softDelete.mutate(u.id) }} className="text-red-400 hover:text-red-300 p-1" title="Sil"><Trash2 size={14} /></button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default function AdminPage() {
  const isAdmin = useAuthStore(s => s.isAdmin)()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
      isActive ? 'border-red-400 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-200'
    }`

  return (
    <div className="flex flex-col min-h-full">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b border-white/5">
        <NavLink to="/admin" end className={navCls}><LayoutDashboard size={14} /> Dashboard</NavLink>
        <NavLink to="/admin/users" className={navCls}><Users size={14} /> Kullanıcılar</NavLink>
      </div>
      <div className="flex-1">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
        </Routes>
      </div>
    </div>
  )
}
