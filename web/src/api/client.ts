import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })
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
    return Promise.reject(err)
  }
)
