import { Bell, LogOut, User, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api/auth'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useThemeStore } from '@/stores/themeStore'

export default function Header({ title }: { title?: string }) {
  const { user, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useThemeStore()

  const { data: notifs } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.list({ pageSize: 1 }),
    refetchInterval: 30_000,
  })

  const handleLogout = async () => {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {})
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-3 md:px-6 bg-[#0b0b0f]/80 backdrop-blur sticky top-0 z-10">
      <h1 className="text-sm font-semibold text-slate-200">{title}</h1>

      <div className="flex items-center gap-1 md:gap-3">
        {/* Notification bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          <Bell size={18} />
          {(notifs?.unreadCount ?? 0) > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-400" />
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          title={theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User — name hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
          <User size={16} />
          <span>{user?.firstName} {user?.lastName}</span>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Çıkış"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
