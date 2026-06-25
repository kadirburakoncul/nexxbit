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
  category: string
  isEnabled: boolean
  weight: number
  parameters: ParameterValue[]
}

export interface UpdateIndicatorRequest {
  coinId?: number | null
  isEnabled: boolean
  weight: number
  parameters: { definitionId: number; value: string }[]
}

export const indicatorsApi = {
  list: (coinId?: number) =>
    api.get<IndicatorSetting[]>('/indicator', { params: coinId ? { coinId } : undefined }).then(r => r.data),
  toggle: (id: number) =>
    api.patch<{ isEnabled: boolean }>(`/indicator/${id}/toggle`).then(r => r.data),
  update: (id: number, req: UpdateIndicatorRequest) =>
    api.put(`/indicator/${id}`, req).then(r => r.data),
}
