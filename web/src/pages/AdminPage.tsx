import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/api/client'
import { indicatorsApi } from '@/api/indicators'
import type { IndicatorSubscriptionInfo } from '@/api/indicators'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import {
  Users, LayoutDashboard, Trash2, RotateCcw, KeyRound, X, Mail, MailCheck,
  Package, Calendar, Check, ShieldCheck, ShieldOff, UserX, Search,
  ChevronLeft, ChevronRight, Link2, Activity, Receipt, FlaskConical,
  UserCheck, Crown,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface AdminDashboardDto {
  totalUsers: number; activeUsers: number; connectedBinanceUsers: number
  totalSignalsToday: number; totalOrdersToday: number; activeBacktests: number; totalBacktests: number
}
interface AdminUserDto {
  id: string; email: string; firstName: string; lastName: string
  role: number; isEmailVerified: boolean; isApprovedByAdmin: boolean; isActive: boolean
  skipLoginOtp: boolean; isDeleted: boolean; hasBinanceAccount: boolean
  createdAt: string; lastLoginAt?: string
}

const ROLE_BG = { 0: 'bg-red-500/20 text-red-400', 1: 'bg-slate-500/20 text-slate-400' }

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, isLoading }: {
  label: string; value: number | string; icon: React.ElementType; color: string; isLoading?: boolean
}) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-white/5', color)}>
          <Icon size={15} className={color} />
        </div>
      </div>
      {isLoading
        ? <div className="h-7 w-14 bg-white/10 rounded animate-pulse" />
        : <p className="text-2xl font-bold text-slate-100 tabular-nums">{value}</p>}
    </div>
  )
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-0.5">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">{children}</div>
    </div>
  )
}

function AdminDashboard() {
  const { data, isLoading } = useQuery<AdminDashboardDto>({
    queryKey: ['admin-dashboard'],
    queryFn: () => client.get('/admin/dashboard').then(r => r.data),
    refetchInterval: 30_000,
  })

  return (
    <>
      <Header title="Admin — Dashboard" />
      <div className="p-3 md:p-6 space-y-6 max-w-5xl">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Genel Bakış</h2>
          <p className="text-xs text-slate-500 mt-0.5">Platformun anlık durumu ve günlük aktivite özeti</p>
        </div>

        <StatGroup title="Kullanıcılar">
          <StatCard label="Toplam Kullanıcı" value={data?.totalUsers ?? 0} icon={Users} color="text-blue-400" isLoading={isLoading} />
          <StatCard label="Aktif Kullanıcı" value={data?.activeUsers ?? 0} icon={UserCheck} color="text-emerald-400" isLoading={isLoading} />
          <StatCard label="Binance Bağlı" value={data?.connectedBinanceUsers ?? 0} icon={Link2} color="text-yellow-400" isLoading={isLoading} />
        </StatGroup>

        <StatGroup title="Bugünkü Aktivite">
          <StatCard label="Bugün Sinyal" value={data?.totalSignalsToday ?? 0} icon={Activity} color="text-purple-400" isLoading={isLoading} />
          <StatCard label="Bugün Emir" value={data?.totalOrdersToday ?? 0} icon={Receipt} color="text-orange-400" isLoading={isLoading} />
        </StatGroup>

        <StatGroup title="Backtest">
          <StatCard label="Aktif Backtest" value={data?.activeBacktests ?? 0} icon={FlaskConical} color="text-cyan-400" isLoading={isLoading} />
          <StatCard label="Toplam Backtest" value={data?.totalBacktests ?? 0} icon={FlaskConical} color="text-slate-400" isLoading={isLoading} />
        </StatGroup>
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

  const validate = (): string | null => {
    if (email.trim().length === 0) return 'E-posta boş olamaz.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Geçerli bir e-posta adresi giriniz.'
    if (password.length > 0) {
      if (password.length < 8) return 'Şifre en az 8 karakter olmalıdır.'
      if (password.length > 128) return 'Şifre en fazla 128 karakter olabilir.'
      if (!/[A-Z]/.test(password)) return 'Şifre en az bir büyük harf içermelidir.'
      if (!/[a-z]/.test(password)) return 'Şifre en az bir küçük harf içermelidir.'
      if (!/[0-9]/.test(password)) return 'Şifre en az bir rakam içermelidir.'
    }
    return null
  }

  const update = useMutation({
    mutationFn: () => {
      const err = validate()
      if (err) { setError(err); return Promise.reject(new Error(err)) }
      return client.put(`/admin/users/${user.id}/credentials`, {
        newEmail: email.trim() !== user.email ? email.trim() : null,
        newPassword: password.length > 0 ? password : null,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose() },
    onError: (e: unknown) => {
      const axiosErr = e as { response?: { data?: { errors?: string[]; message?: string } }; message?: string }
      setError(axiosErr?.response?.data?.errors?.[0] ?? axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Hata oluştu')
    },
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
              placeholder="En az 8 karakter, büyük harf + rakam"
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

// ─── Subscription Modal ───────────────────────────────────────────────────────
function SubscriptionModal({ user, onClose }: { user: AdminUserDto; onClose: () => void }) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState<number | null>(null)

  const { data: subs, isLoading } = useQuery<IndicatorSubscriptionInfo[]>({
    queryKey: ['admin-user-subs', user.id],
    queryFn: () => indicatorsApi.adminGetUserSubscriptions(user.id),
  })

  const setSubMut = useMutation({
    mutationFn: ({ indicatorId, isActive, expiresAt, remove }: {
      indicatorId: number; isActive: boolean; expiresAt: string | null; remove?: boolean
    }) => indicatorsApi.adminSetUserSubscription(user.id, indicatorId, { isActive, expiresAt, remove }),
    onSuccess: () => {
      setSaving(null)
      qc.invalidateQueries({ queryKey: ['admin-user-subs', user.id] })
    },
    onError: () => setSaving(null),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#13141a] border border-white/10 rounded-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Abonelik Yönetimi</h3>
            <p className="text-xs text-slate-500 mt-0.5">{user.firstName} {user.lastName} — {user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
        </div>

        {isLoading && <p className="text-slate-500 text-sm text-center py-4">Yükleniyor…</p>}

        {subs && (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {subs.map(sub => (
              <SubscriptionRow
                key={sub.indicatorId}
                sub={sub}
                isSaving={saving === sub.indicatorId}
                onToggle={(isActive) => {
                  setSaving(sub.indicatorId)
                  setSubMut.mutate({
                    indicatorId: sub.indicatorId,
                    isActive,
                    expiresAt: sub.expiresAt,
                  })
                }}
                onExpireChange={(expiresAt) => {
                  if (!sub.hasSubscription) return
                  setSaving(sub.indicatorId)
                  setSubMut.mutate({
                    indicatorId: sub.indicatorId,
                    isActive: sub.isActive,
                    expiresAt,
                  })
                }}
                onAdd={() => {
                  setSaving(sub.indicatorId)
                  setSubMut.mutate({
                    indicatorId: sub.indicatorId,
                    isActive: true,
                    expiresAt: null,
                  })
                }}
                onRemove={() => {
                  if (!confirm(`${sub.displayName} aboneliğini kaldır?`)) return
                  setSaving(sub.indicatorId)
                  setSubMut.mutate({
                    indicatorId: sub.indicatorId,
                    isActive: false,
                    expiresAt: null,
                    remove: true,
                  })
                }}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 border border-white/10 rounded-lg hover:bg-white/5">Kapat</button>
        </div>
      </div>
    </div>
  )
}

function SubscriptionRow({ sub, isSaving, onToggle, onExpireChange, onAdd, onRemove }: {
  sub: IndicatorSubscriptionInfo
  isSaving: boolean
  onToggle: (active: boolean) => void
  onExpireChange: (date: string | null) => void
  onAdd: () => void
  onRemove: () => void
}) {
  const [expireVal, setExpireVal] = useState(
    sub.expiresAt ? format(new Date(sub.expiresAt), 'yyyy-MM-dd') : ''
  )

  const isExpired = sub.expiresAt ? new Date(sub.expiresAt) < new Date() : false

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-lg px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate">{sub.displayName}</p>
        {sub.hasSubscription && sub.expiresAt && (
          <p className={cn('text-xs', isExpired ? 'text-red-400' : 'text-slate-500')}>
            {isExpired ? 'Süresi doldu: ' : 'Bitiş: '}
            {format(new Date(sub.expiresAt), 'dd MMM yyyy', { locale: tr })}
          </p>
        )}
        {sub.hasSubscription && !sub.expiresAt && (
          <p className="text-xs text-slate-600">Süresiz</p>
        )}
      </div>

      {sub.hasSubscription ? (
        <div className="flex items-center gap-2 shrink-0">
          {/* Bitiş tarihi */}
          <div className="flex items-center gap-1">
            <Calendar size={11} className="text-slate-500" />
            <input
              type="date"
              value={expireVal}
              onChange={e => setExpireVal(e.target.value)}
              onBlur={e => onExpireChange(e.target.value || null)}
              className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-yellow-400/50 w-28"
            />
          </div>

          {/* Aktif/Pasif toggle */}
          <button
            onClick={() => onToggle(!sub.isActive)}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors',
              sub.isActive
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30'
                : 'bg-slate-500/15 border-slate-500/30 text-slate-500 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/30'
            )}
          >
            {isSaving ? '…' : sub.isActive ? <><Check size={10} /> Aktif</> : 'Pasif'}
          </button>

          {/* Kaldır */}
          <button
            onClick={onRemove}
            disabled={isSaving}
            className="text-red-400/60 hover:text-red-400 p-1 transition-colors"
            title="Aboneliği kaldır"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={onAdd}
          disabled={isSaving}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20 transition-colors disabled:opacity-50"
        >
          <Package size={11} /> {isSaving ? '…' : 'Ekle'}
        </button>
      )}
    </div>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors shrink-0',
        checked ? 'bg-yellow-400' : 'bg-white/10',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
        checked ? 'left-[1.25rem]' : 'left-0.5'
      )} />
    </button>
  )
}

// ─── Action Icon Button ─────────────────────────────────────────────────────
function ActionBtn({ onClick, disabled, title, color, children }: {
  onClick: () => void; disabled?: boolean; title: string; color: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded-lg transition-colors disabled:opacity-40',
        'hover:bg-white/10',
        color
      )}
    >
      {children}
    </button>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ firstName, lastName, isAdmin }: { firstName: string; lastName: string; isAdmin: boolean }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
  return (
    <div className={cn(
      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
      isAdmin ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
    )}>
      {initials || '?'}
    </div>
  )
}

const PAGE_SIZE = 20

function AdminUsers() {
  const qc = useQueryClient()
  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null)
  const [subUser, setSubUser] = useState<AdminUserDto | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Arama debounce — 400ms
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery<{ items: AdminUserDto[]; totalCount: number }>({
    queryKey: ['admin-users', search, page],
    queryFn: () => client.get('/admin/users', {
      params: { pageSize: PAGE_SIZE, pageNumber: page, ...(search ? { search } : {}) },
    }).then(r => r.data),
  })

  const { data: settings } = useQuery<{ requireLoginOtp: boolean }>({
    queryKey: ['admin-settings'],
    queryFn: () => client.get('/admin/settings').then(r => r.data),
  })

  const setGlobalVerification = useMutation({
    mutationFn: (required: boolean) => client.put('/admin/settings/email-verification', { required }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-settings'] }),
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

  const toggleEmailBypass = useMutation({
    mutationFn: ({ id, bypassed }: { id: string; bypassed: boolean }) =>
      client.put(`/admin/users/${id}/email-bypass`, { bypassed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const approve = useMutation({
    mutationFn: (id: string) => client.post(`/admin/users/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const suspend = useMutation({
    mutationFn: (id: string) => client.post(`/admin/users/${id}/suspend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const unsuspend = useMutation({
    mutationFn: (id: string) => client.post(`/admin/users/${id}/unsuspend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const purge = useMutation({
    mutationFn: (id: string) => client.delete(`/admin/users/${id}/purge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const total = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <>
      <Header title="Admin — Kullanıcılar" />
      {editingUser && <CredentialsModal user={editingUser} onClose={() => setEditingUser(null)} />}
      {subUser && <SubscriptionModal user={subUser} onClose={() => setSubUser(null)} />}
      <div className="p-3 md:p-6 space-y-4 max-w-6xl">

        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            Kullanıcı Yönetimi
            {total > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500 font-normal">{total}</span>}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Kayıtlı kullanıcıları onaylayın, askıya alın, abonelik ve kimlik bilgilerini yönetin</p>
        </div>

        {/* Üst bar: arama + global ayar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="İsim veya e-posta ile ara…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400/50"
            />
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 shrink-0">
            <Mail size={15} className="text-yellow-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 whitespace-nowrap">Giriş OTP Zorunluluğu</p>
            </div>
            <Toggle
              checked={settings?.requireLoginOtp ?? false}
              onChange={() => setGlobalVerification.mutate(!(settings?.requireLoginOtp ?? false))}
              disabled={setGlobalVerification.isPending}
            />
          </div>
        </div>

        {/* Kullanıcı tablosu */}
        <div className="bg-white/5 border border-white/5 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Kullanıcı</th>
                <th className="text-left px-4 py-3">E-posta</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="text-center px-4 py-3">Binance</th>
                <th className="text-center px-4 py-3 whitespace-nowrap">OTP Bypass</th>
                <th className="text-right px-4 py-3">Kayıt</th>
                <th className="text-right px-4 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-5 bg-white/5 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              )}
              {!isLoading && data?.items.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500 text-sm">
                  {search ? `"${search}" için sonuç bulunamadı.` : 'Henüz kullanıcı yok.'}
                </td></tr>
              )}
              {data?.items.map(u => {
                const isPending = !u.isApprovedByAdmin
                const isSuspended = u.isActive === false && !u.isDeleted
                const isAdminRole = u.role === 0
                const rowCls = u.isDeleted
                  ? 'opacity-40'
                  : isPending ? 'bg-amber-500/5'
                  : isSuspended ? 'bg-red-500/5'
                  : ''
                return (
                <tr key={u.id} className={`hover:bg-white/5 transition-colors ${rowCls}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={u.firstName} lastName={u.lastName} isAdmin={isAdminRole} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-slate-200">{u.firstName} {u.lastName}</span>
                          {u.isEmailVerified
                            ? <MailCheck size={11} className="text-emerald-400 shrink-0" />
                            : <Mail size={11} className="text-slate-600 shrink-0" />
                          }
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          {isPending && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold">Onay Bekliyor</span>}
                          {isSuspended && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-semibold">Askıda</span>}
                          {u.isDeleted && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-500 border border-slate-500/20 font-semibold">Silindi</span>}
                          {!isPending && !isSuspended && !u.isDeleted && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-semibold">Aktif</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={e => setRole.mutate({ id: u.id, role: Number(e.target.value) })}
                      className={`text-xs px-2 py-0.5 rounded border-0 bg-transparent font-medium ${ROLE_BG[u.role as 0 | 1] ?? ''}`}
                    >
                      <option value={0}>Admin</option>
                      <option value={1}>Kullanıcı</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                        u.hasBinanceAccount
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-600 border-slate-500/15'
                      )}>
                        {u.hasBinanceAccount ? 'Bağlı' : 'Yok'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Toggle
                        checked={u.skipLoginOtp}
                        onChange={() => toggleEmailBypass.mutate({ id: u.id, bypassed: !u.skipLoginOtp })}
                        disabled={toggleEmailBypass.isPending}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 text-xs">
                    {format(new Date(u.createdAt), 'dd MMM yy', { locale: tr })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      {/* Onay bekliyor → Onayla butonu */}
                      {isPending && (
                        <button
                          onClick={() => approve.mutate(u.id)}
                          disabled={approve.isPending}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 mr-1"
                          title="Hesabı Onayla"
                        >
                          <ShieldCheck size={12} /> Onayla
                        </button>
                      )}
                      {/* Abonelik */}
                      {u.role !== 0 && (
                        <ActionBtn onClick={() => setSubUser(u)} title="Abonelik Yönetimi" color="text-blue-400/70 hover:text-blue-400">
                          <Package size={13} />
                        </ActionBtn>
                      )}
                      {/* Kimlik bilgileri */}
                      <ActionBtn onClick={() => setEditingUser(u)} title="E-posta / Şifre" color="text-yellow-500/70 hover:text-yellow-400">
                        <KeyRound size={13} />
                      </ActionBtn>

                      <span className="w-px h-4 bg-white/10 mx-0.5" />

                      {/* Askıya al / Kaldır */}
                      {!u.isDeleted && (
                        isSuspended
                          ? <ActionBtn onClick={() => unsuspend.mutate(u.id)} disabled={unsuspend.isPending} title="Askıyı Kaldır" color="text-emerald-400/70 hover:text-emerald-400"><ShieldCheck size={13} /></ActionBtn>
                          : u.role !== 0 && <ActionBtn onClick={() => { if (confirm(`${u.firstName} ${u.lastName} hesabını askıya al?`)) suspend.mutate(u.id) }} disabled={suspend.isPending} title="Askıya Al" color="text-orange-400/70 hover:text-orange-400"><ShieldOff size={13} /></ActionBtn>
                      )}
                      {/* Soft delete / restore */}
                      {u.isDeleted
                        ? <ActionBtn onClick={() => restore.mutate(u.id)} title="Geri Al" color="text-slate-400 hover:text-slate-200"><RotateCcw size={13} /></ActionBtn>
                        : u.role !== 0 && <ActionBtn onClick={() => { if (confirm('Kullanıcıyı pasife çek? (Geri alınabilir)')) softDelete.mutate(u.id) }} title="Pasife Çek" color="text-red-400/60 hover:text-red-400"><Trash2 size={13} /></ActionBtn>
                      }
                      {/* Hard delete */}
                      {u.role !== 0 && (
                        <ActionBtn
                          onClick={() => {
                            const name = `${u.firstName} ${u.lastName}`
                            if (confirm(`⚠️ ${name} hesabını ve TÜM verisini kalıcı olarak sil?\n\nBu işlem GERİ ALINAMAZ.`))
                              purge.mutate(u.id)
                          }}
                          disabled={purge.isPending}
                          title="Kalıcı Sil (Tüm Verilerle)"
                          color="text-red-600/60 hover:text-red-500"
                        >
                          <UserX size={13} />
                        </ActionBtn>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Sayfalama */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-500">
              {rangeStart}–{rangeEnd} / {total} kullanıcı {isFetching && <span className="text-slate-600">· yükleniyor…</span>}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-slate-400 tabular-nums px-1">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
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
    cn(
      'flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors',
      isActive ? 'bg-red-500/15 text-red-400' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
    )

  return (
    <div className="flex flex-col min-h-full">
      {/* Sub-nav */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 pt-4 pb-3 border-b border-white/5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
            <Crown size={14} className="text-red-400" />
          </div>
          <span className="text-xs font-semibold text-red-400/80 uppercase tracking-wider">Yönetim Paneli</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink to="/admin" end className={navCls}><LayoutDashboard size={14} /> Dashboard</NavLink>
          <NavLink to="/admin/users" className={navCls}><Users size={14} /> Kullanıcılar</NavLink>
        </div>
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
