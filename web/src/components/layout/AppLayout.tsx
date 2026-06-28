import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import ConnectionBanner from '@/components/ConnectionBanner'
import { useAuthStore } from '@/stores/authStore'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { useSignalR } from '@/hooks/useSignalR'
import { useQueryClient } from '@tanstack/react-query'
import { hubUrl } from '@/api/client'

export default function AppLayout() {
  const { accessToken } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  useIdleTimeout()

  // Global SignalR bağlantısı — tüm layout boyunca aktif
  const { state: signalRState } = useSignalR({
    hubUrl: hubUrl('/hubs/candle'),
    events: {
      CandleUpdate: () => {
        qc.invalidateQueries({ queryKey: ['positions'] })
        qc.invalidateQueries({ queryKey: ['signals'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
      },
    },
    enabled: !!accessToken,
  })

  useEffect(() => {
    if (!accessToken) navigate('/login', { replace: true })
  }, [accessToken, navigate])

  if (!accessToken) return null

  return (
    <div className="flex min-h-screen">
      <ConnectionBanner state={signalRState} />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-14 md:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
