import { api } from './client'

export interface ParameterValue {
  definitionId: number
  parameterKey: string
  displayName: string
  dataType: string
  value: string
  defaultValue: string
  minValue: string | null
  maxValue: string | null
}

export interface IndicatorSetting {
  indicatorId: number
  name: string
  displayName: string
  description: string
  howItWorks: string | null
  category: string
  isEnabled: boolean
  weight: number
  parameters: ParameterValue[]
  hasSubscription: boolean
  subscriptionIsActive: boolean
  subscriptionExpiresAt: string | null
}

export interface UpdateIndicatorRequest {
  coinId?: number | null
  isEnabled: boolean
  weight: number
  parameters: { definitionId: number; value: string }[]
}

export interface AdminUpdateIndicatorRequest {
  displayName?: string
  description?: string
  howItWorks?: string
  defaultParameters?: { definitionId: number; value: string }[]
}

export interface IndicatorSubscriptionInfo {
  indicatorId: number
  displayName: string
  hasSubscription: boolean
  isActive: boolean
  expiresAt: string | null
}

export const indicatorsApi = {
  list: (coinId?: number) =>
    api.get<IndicatorSetting[]>('/indicator', { params: coinId ? { coinId } : undefined }).then(r => r.data),
  toggle: (id: number) =>
    api.patch<{ isEnabled: boolean }>(`/indicator/${id}/toggle`).then(r => r.data),
  update: (id: number, req: UpdateIndicatorRequest) =>
    api.put(`/indicator/${id}`, req).then(r => r.data),
  adminUpdate: (id: number, req: AdminUpdateIndicatorRequest) =>
    api.put(`/admin/indicators/${id}`, req).then(r => r.data),
  adminGetUserSubscriptions: (userId: string) =>
    api.get<IndicatorSubscriptionInfo[]>(`/admin/users/${userId}/indicator-subscriptions`).then(r => r.data),
  adminSetUserSubscription: (userId: string, indicatorId: number, req: { isActive: boolean; expiresAt: string | null; remove?: boolean }) =>
    api.put(`/admin/users/${userId}/indicator-subscriptions/${indicatorId}`, req).then(r => r.data),
}
