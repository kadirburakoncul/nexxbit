import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface JwtPayload {
  sub: string
  email: string
  firstName: string
  lastName: string
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': string
  exp: number
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4)
    return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; email: string; firstName: string; lastName: string; role: string } | null
  setTokens: (access: string, refresh: string) => void
  logout: () => void
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh) => {
        const payload = decodeJwt(access)
        set({
          accessToken: access,
          refreshToken: refresh,
          user: payload ? {
            id: payload.sub,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            role: payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
          } : null,
        })
        localStorage.setItem('accessToken', access)
        localStorage.setItem('refreshToken', refresh)
      },
      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null })
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      },
      isAdmin: () => get().user?.role === 'Admin',
    }),
    { name: 'auth-store', partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }) }
  )
)
