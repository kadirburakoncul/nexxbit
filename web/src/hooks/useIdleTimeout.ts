import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 dakika

const IDLE_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel']

export function useIdleTimeout() {
  const logout = useAuthStore(s => s.logout)
  const accessToken = useAuthStore(s => s.accessToken)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!accessToken) return

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        logout()
        window.location.replace('/login')
      }, IDLE_TIMEOUT_MS)
    }

    IDLE_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      IDLE_EVENTS.forEach(e => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [accessToken, logout])
}
