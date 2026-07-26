import { api } from './client'

export interface BistCatalogStock { id: number; symbol: string; displayName: string; sector: string | null }

export interface BistIndicatorSetting {
  t3Period: number
  t3Factor: number
  isRsiFilterEnabled: boolean
  rsiPeriod: number
  rsiBuyThreshold: number
}

export interface BistStrategyStock {
  stockId: number
  symbol: string
  displayName: string
  lastPrice: number | null
  lastPriceAt: string | null
  lastT3UpDirection: boolean | null
  lastCheckedAt: string | null
  lastCheckedReason: string | null
}

export interface BistStrategy {
  id: string
  name: string
  timeframe: string
  isActive: boolean
  activatedAt: string | null
  isRsiFilterEnabled: boolean
  rsiPeriod: number
  rsiBuyThreshold: number
  useEma200Filter: boolean
  isPositionTrackingEnabled: boolean
  stopLossPct: number
  trailingStopPct: number
  trailingActivationPct: number
  stocks: BistStrategyStock[]
}

export interface BistSignal {
  id: string
  symbol: string
  displayName: string
  strategyName: string
  direction: string
  price: number
  candleTime: string
  reason: string | null
}

export interface BistOhlcv {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface UpsertBistStrategyRequest {
  name: string
  timeframe: string
  stockIds: number[]
  isRsiFilterEnabled: boolean
  rsiPeriod: number
  rsiBuyThreshold: number
  useEma200Filter: boolean
  isPositionTrackingEnabled: boolean
  stopLossPct: number
  trailingStopPct: number
  trailingActivationPct: number
}

export interface BistGainer {
  symbol: string
  displayName: string
  price: number | null
  changePercent: number | null
}

export const bistApi = {
  catalog: () => api.get<BistCatalogStock[]>('/bist/catalog').then(r => r.data),

  watchlist: () => api.get<BistCatalogStock[]>('/bist/watchlist').then(r => r.data),
  addToWatchlist: (stockId: number) => api.post(`/bist/watchlist/${stockId}`),
  removeFromWatchlist: (stockId: number) => api.delete(`/bist/watchlist/${stockId}`),

  getIndicatorSettings: () => api.get<BistIndicatorSetting>('/bist/indicator-settings').then(r => r.data),
  updateIndicatorSettings: (req: BistIndicatorSetting) =>
    api.put<BistIndicatorSetting>('/bist/indicator-settings', req).then(r => r.data),

  strategies: () => api.get<BistStrategy[]>('/bist/strategies').then(r => r.data),
  createStrategy: (req: UpsertBistStrategyRequest) =>
    api.post<{ strategyId: string }>('/bist/strategies', req).then(r => r.data),
  updateStrategy: (id: string, req: UpsertBistStrategyRequest) =>
    api.put(`/bist/strategies/${id}`, req),
  toggleStrategy: (id: string) =>
    api.patch<{ isActive: boolean }>(`/bist/strategies/${id}/toggle`).then(r => r.data),
  deleteStrategy: (id: string) => api.delete(`/bist/strategies/${id}`),

  signals: (pageSize = 50) =>
    api.get<BistSignal[]>('/bist/signals', { params: { pageSize } }).then(r => r.data),
  deleteSignal: (id: string) => api.delete(`/bist/signals/${id}`),

  index: () => api.get<{ symbol: string; price: number | null }>('/bist/index').then(r => r.data),
  topGainers: (count = 20) => api.get<BistGainer[]>('/bist/top-gainers', { params: { count } }).then(r => r.data),
  chart: (symbol: string, timeframe = '15m', limit = 200) =>
    api.get<BistOhlcv[]>(`/bist/chart/${encodeURIComponent(symbol)}`, { params: { timeframe, limit } }).then(r => r.data),
}
