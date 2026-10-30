import { api } from './client'

export interface MarketSymbol {
  symbol: string
  baseAsset: string
  lastPrice: number
  priceChangePercent: number
  quoteVolume24h: number
  tradeCount24h: number
}

export interface TimeframeOption {
  key: string
  displayName: string
  /** Binance'te native yok, daha küçük barlardan türetiliyor (örn. 45m) */
  isDerived: boolean
  sourceNote: string
}

export interface ExportEstimate {
  symbolCount: number
  timeframe: string
  estimatedBarsPerSymbol: number
  estimatedTotalBars: number
  estimatedFileSizeBytes: number
  estimatedApiRequests: number
  estimatedSeconds: number
  exceedsLimits: boolean
  warning: string | null
}

export type JobStatus = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled'

export interface MarketDataExport {
  id: string
  name: string
  symbols: string[]
  symbolCount: number
  timeframe: string
  startDate: string
  endDate: string
  format: string
  includeIndicators: boolean
  status: JobStatus
  progressPct: number
  processedSymbols: number
  totalRows: number
  fileSizeBytes: number | null
  dataQualityNote: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export interface IndicatorOptimization {
  id: string
  name: string
  symbols: string[]
  timeframe: string
  startDate: string
  endDate: string
  family: string
  commissionPct: number
  status: JobStatus
  progressPct: number
  testedCombinations: number
  bestParamsJson: string | null
  bestReturnPct: number | null
  bestWinRate: number | null
  bestTradeCount: number | null
  buyHoldReturnPct: number | null
  inSampleReturnPct: number | null
  outOfSampleReturnPct: number | null
  verdict: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export interface OptimizationCandidate {
  family: string
  parameters: Record<string, number>
  paramsLabel: string
  returnPct: number
  buyHoldPct: number
  edgePct: number
  winRate: number
  tradeCount: number
  maxDrawdownPct: number
  inSamplePct: number
  outOfSamplePct: number
  symbolsBeatingBuyHold: number
  symbolCount: number
}

export const marketDataApi = {
  symbols: () => api.get<MarketSymbol[]>('/marketdata/symbols').then(r => r.data),
  timeframes: () => api.get<TimeframeOption[]>('/marketdata/timeframes').then(r => r.data),

  estimate: (symbolCount: number, timeframe: string, startDate: string, endDate: string) =>
    api.post<ExportEstimate>('/marketdata/estimate', { symbolCount, timeframe, startDate, endDate })
      .then(r => r.data),

  exports: () => api.get<MarketDataExport[]>('/marketdata/exports').then(r => r.data),
  createExport: (req: {
    name?: string; symbols: string[]; timeframe: string
    startDate: string; endDate: string; format: string; includeIndicators: boolean
  }) => api.post<MarketDataExport>('/marketdata/exports', req).then(r => r.data),
  deleteExport: (id: string) => api.delete(`/marketdata/exports/${id}`),
  downloadUrl: (id: string) => `/marketdata/exports/${id}/download`,

  families: () => api.get<string[]>('/marketdata/optimizer/families').then(r => r.data),
  optimizations: () => api.get<IndicatorOptimization[]>('/marketdata/optimizations').then(r => r.data),
  optimization: (id: string) =>
    api.get<{ detail: IndicatorOptimization; results: OptimizationCandidate[] }>(
      `/marketdata/optimizations/${id}`).then(r => r.data),
  createOptimization: (req: {
    name?: string; symbols: string[]; timeframe: string
    startDate: string; endDate: string; family: string; commissionPct: number
    marketDataExportId?: string | null
  }) => api.post<IndicatorOptimization>('/marketdata/optimizations', req).then(r => r.data),
  deleteOptimization: (id: string) => api.delete(`/marketdata/optimizations/${id}`),
  applyIndicator: (id: string, parameters?: Record<string, number>) =>
    api.post<{ indicator: string; applied: string[]; message: string }>(
      `/marketdata/optimizations/${id}/apply`, { parameters: parameters ?? null }).then(r => r.data),
}
