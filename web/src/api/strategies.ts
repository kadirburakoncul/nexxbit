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
  takeProfitPct: number | null
  minVolumeUsdt: number | null
  volatilePositionSizePct: number | null
  volatileMinChangePct: number
  volatileGainerLimit: number
  isRsiFilterEnabled: boolean
  momentumFreshFilterMinutes: number
  useAtrBasedStops: boolean
  atrPeriod: number
  atrSlMultiplier: number
  atrTpMultiplier: number
  partialTpPct: number | null
  partialTpClosePct: number
  isVolumeSurgeFilterEnabled: boolean
  volumeSurgeMultiplier: number
  useMarketRegimeFilter: boolean
  isActive: boolean
  isRealTradeEnabled: boolean
  isVolatileMode: boolean
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
  takeProfitPct: number | null
  minVolumeUsdt: number | null
  volatilePositionSizePct: number | null
  volatileMinChangePct: number
  volatileGainerLimit: number
  isVolatileMode: boolean
  isRsiFilterEnabled: boolean
  momentumFreshFilterMinutes: number
  useAtrBasedStops: boolean
  atrPeriod: number
  atrSlMultiplier: number
  atrTpMultiplier: number
  partialTpPct: number | null
  partialTpClosePct: number
  isVolumeSurgeFilterEnabled: boolean
  volumeSurgeMultiplier: number
  useMarketRegimeFilter: boolean
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
  toggle: (id: string, action?: string) =>
    api.patch<{
      isActive: boolean
      activatedAt: string | null
      requiresConfirmation?: boolean
      signalCount?: number
      realPositionCount?: number
      virtualPositionCount?: number
    }>(`/strategy/${id}/toggle`, null, { params: action ? { action } : {} }).then(r => r.data),
  toggleRealTrade: (id: string) =>
    api.patch<{ isRealTradeEnabled: boolean }>(`/strategy/${id}/toggle-real-trade`).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/strategy/${id}`),
  resetReEntry: (strategyId: string, coinId: number) =>
    api.patch(`/strategy/${strategyId}/coins/${coinId}/reset-reentry`),
}
