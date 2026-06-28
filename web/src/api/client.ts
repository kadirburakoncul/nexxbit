import axios from 'axios'
import { toast } from 'sonner'

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
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }
    // API'den gelen mesajı göster (401 hariç — o login yönlendirmesi yapıyor)
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
