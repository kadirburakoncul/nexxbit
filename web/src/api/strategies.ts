import { api } from './client'

export interface StrategyCoin {
  coinId: number
  symbol: string
  displayName: string
  reEntryState: number // 0=Normal, 1=WaitingForSell, 2=WaitingForBuy
}

export interface Strategy {
  id: string
  name: string
  indicatorId: number | null
  indicatorDisplayName: string | null
  timeframe: string
  trailingStopPct: number
  stopLossPct: number
  isActive: boolean
  isRealTradeEnabled: boolean
  activatedAt: string | null
  coins: StrategyCoin[]
}

export interface UpsertStrategyRequest {
  name: string
  indicatorId: number | null
  coinIds: number[]
  timeframe: string
  trailingStopPct: number
  stopLossPct: number
}

export interface CoinMonitor {
  coinId: number
  coinSymbol: string
  reEntryState: number
  hasOpenPosition: boolean
  lastSignalAt: string | null
  lastSignalDirection: string | null
  lastSignalPrice: number | null
  lastCheckedAt: string | null
  lastCheckedPrice: number | null
  lastCheckedReason: string | null
  lastBuyPrice: number | null
  lastBuyAt: string | null
  lastSellPrice: number | null
  lastSellAt: string | null
}

export interface StrategyMonitor {
  strategyId: string
  name: string
  timeframe: string
  coins: CoinMonitor[]
}

export const RE_ENTRY_LABEL: Record<number, string> = {
  0: 'Normal',
  1: 'SAT Bekliyor',
  2: 'AL Bekliyor',
}

export const strategiesApi = {
  list: () => api.get<Strategy[]>('/strategy').then(r => r.data),
  monitor: () => api.get<StrategyMonitor[]>('/strategy/monitor').then(r => r.data),
  create: (req: UpsertStrategyRequest) =>
    api.post<{ strategyId: string }>('/strategy', req).then(r => r.data),
  update: (id: string, req: UpsertStrategyRequest) =>
    api.put(`/strategy/${id}`, req),
  toggle: (id: string) =>
    api.patch<{ isActive: boolean; activatedAt: string | null }>(`/strategy/${id}/toggle`).then(r => r.data),
  toggleRealTrade: (id: string) =>
    api.patch<{ isRealTradeEnabled: boolean }>(`/strategy/${id}/toggle-real-trade`).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/strategy/${id}`),
  resetReEntry: (strategyId: string, coinId: number) =>
    api.patch(`/strategy/${strategyId}/coins/${coinId}/reset-reentry`),
}
