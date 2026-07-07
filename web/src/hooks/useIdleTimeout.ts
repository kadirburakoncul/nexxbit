import { useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000       // 30 dakika hareketsizlikte çıkış
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000  // Her 60 saniyede kontrol
const REFRESH_BEFORE_EXPIRY_S = 120           // Süresi dolmaya 2 dk kala yenile

const IDLE_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel']

export function useIdleTimeout() {
  const { logout, updateAccessToken, refreshToken, accessToken } = useAuthStore()
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const isRefreshingRef = useRef(false)

  const doLogout = useCallback(() => {
    logout()
    window.location.replace('/login')
  }, [logout])

  const proactiveRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return
    const rt = localStorage.getItem('refreshToken') ?? refreshToken
    if (!rt) return

    isRefreshingRef.current = true
    try {
      const apiOrigin = import.meta.env.VITE_API_URL ?? ''
      const url = apiOrigin ? `${apiOrigin}/api/auth/refresh` : '/api/auth/refresh'
      const { data } = await axios.post(url, { refreshToken: rt })
      updateAccessToken(data.accessToken)
      // Refresh token da yenilendiyse kaydet
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
    } catch {
      // Refresh başarısız → oturumu sonlandır
      doLogout()
    } finally {
      isRefreshingRef.current = false
    }
  }, [refreshToken, updateAccessToken, doLogout])

  useEffect(() => {
    if (!accessToken) return

    // --- Hareketsizlik zamanlayıcısı ---
    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS)
    }

    IDLE_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer()

    // --- Proaktif token yenileme ---
    const refreshInterval = setInterval(() => {
      const idleSince = Date.now() - lastActivityRef.current
      if (idleSince >= IDLE_TIMEOUT_MS) return  // zaten idle timer çalışacak

      const nowSeconds = Math.floor(Date.now() / 1000)
      const expiry = useAuthStore.getState().accessTokenExpiry
      if (expiry && expiry - nowSeconds < REFRESH_BEFORE_EXPIRY_S) {
        proactiveRefresh()
      }
    }, REFRESH_CHECK_INTERVAL_MS)

    return () => {
      IDLE_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      clearInterval(refreshInterval)
    }
  }, [accessToken, doLogout, proactiveRefresh])
}
