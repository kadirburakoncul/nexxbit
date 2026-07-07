import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'

const apiOrigin = import.meta.env.VITE_API_URL ?? ''

const baseURL = apiOrigin ? `${apiOrigin}/api` : '/api'

/** SignalR hub URL'i — VITE_API_URL set ise tam URL, yoksa relative */
export function hubUrl(path: string) {
  return apiOrigin ? `${apiOrigin}${path}` : path
}

export const api = axios.create({ baseURL })
export { api as client }

// Token inject
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('accessToken')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// 401 → refresh → retry once
// Race condition koruması: birden fazla eşzamanlı 401 tek bir refresh isteğine indirgenir
let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Başka bir refresh devam ediyor — tamamlanmasını bekle
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`
              resolve(api(original))
            },
            reject,
          })
        })
      }

      original._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')

      try {
        if (!refreshToken) throw new Error('No refresh token')

        const refreshUrl = apiOrigin ? `${apiOrigin}/api/auth/refresh` : '/api/auth/refresh'
        const { data } = await axios.post(refreshUrl, { refreshToken })

        localStorage.setItem('accessToken', data.accessToken)
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)

        if (data.refreshToken) {
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)
        } else {
          useAuthStore.getState().updateAccessToken(data.accessToken)
        }

        original.headers.Authorization = `Bearer ${data.accessToken}`
        processQueue(null, data.accessToken)
        return api(original)
      } catch (refreshErr) {
        // Başka bir sekme refresh yapmış olabilir — localStorage'a bakarak kontrol et
        const currentRefresh = localStorage.getItem('refreshToken')
        const currentAccess  = localStorage.getItem('accessToken')

        if (currentAccess && currentRefresh && currentRefresh !== refreshToken) {
          // Başka sekme refresh yaptı, yeni token'ları kullan
          useAuthStore.getState().updateAccessToken(currentAccess)
          original.headers.Authorization = `Bearer ${currentAccess}`
          processQueue(null, currentAccess)
          isRefreshing = false
          return api(original)
        }

        processQueue(refreshErr, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    // API'den gelen mesajı göster (401 hariç)
    if (err.response?.status !== 401) {
      const msg = err.response?.data?.message
        ?? err.response?.data?.errors?.[0]
        ?? err.message
        ?? 'Bir hata oluştu'
      toast.error(msg, { duration: 4000 })
    }
    return Promise.reject(err)
  }
)
