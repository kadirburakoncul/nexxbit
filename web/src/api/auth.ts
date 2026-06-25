import { api } from './client'

export interface LoginRequest { email: string; password: string }
export interface RegisterRequest { email: string; password: string; firstName: string; lastName: string }
export interface AuthResponse { accessToken: string; refreshToken: string; expiresAt: string }

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data).then(r => r.data),
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', data).then(r => r.data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }).then(r => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
  verifyEmail: (token: string) =>
    api.post('/auth/verify-email', { token }),
}
