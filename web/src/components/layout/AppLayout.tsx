import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useAuthStore } from '@/stores/authStore'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'

export default function AppLayout() {
  const { accessToken } = useAuthStore()
  const navigate = useNavigate()
  useIdleTimeout()

  useEffect(() => {
    if (!accessToken) navigate('/login', { replace: true })
  }, [accessToken, navigate])

  if (!accessToken) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-14 md:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
