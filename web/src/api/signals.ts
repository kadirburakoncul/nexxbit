import { api } from './client'

// TradeSignal history (AL/SAT detections)
export interface TradeSignalRecord {
  id: string
  coinId: number
  coinSymbol: string
  direction: 'Buy' | 'Sell' | 'StrongSell' | 'Hold'
  price: number
  candleTime: string
  createdAt: string
  timeframe: string
  strategyName: string
  totalScore: number
  isActedUpon: boolean
}

export interface TradeSignalStats {
  total: number
  buySignals: number
  sellSignals: number
}

export const tradeSignalHistoryApi = {
  list: (pageSize = 200) =>
    api.get<TradeSignalRecord[]>('/signal/history', { params: { pageSize } }).then(r => r.data),
  stats: () =>
    api.get<TradeSignalStats>('/signal/history/stats').then(r => r.data),
}

// Position-based records (virtual for Signals page, real for Positions page)
export interface SignalRecord {
  id: string
  coinId: number
  coinSymbol: string
  coinDisplayName: string
  status: string   // 'Open' | 'Closed'
  entryPrice: number
  entryValueUsdt: number
  openedAt: string
  closePrice: number | null
  closedAt: string | null
  realizedPnl: number | null
  realizedPnlPct: number | null
  isVirtual: boolean
  closeReason: string | null
}

export interface SignalStats {
  total: number
  open: number
  closed: number
  wins: number
  losses: number
  totalPnlUsdt: number
}

export interface SignalAnalysis {
  coinId: number
  symbol: string
  timeframe: string
  verdict: string
  reason?: string
  score: number | null
  buyThreshold?: number | null
  sellThreshold?: number | null
  isEma200RuleEnabled?: boolean
  ema200RuleResult?: string | null
  indicators: {
    name: string
    displayName: string
    signal: string
    weight: number
    passed: boolean
    score: number
    details?: string
  }[]
}

export const signalRecordsApi = {
  list: (params?: { pageSize?: number; status?: string; isVirtual?: boolean }) =>
    api.get<SignalRecord[]>('/position', { params: { pageSize: params?.pageSize ?? 200, ...(params?.status ? { status: params.status } : {}), ...(params?.isVirtual !== undefined ? { isVirtual: params.isVirtual } : {}) } })
      .then(r => (r.data as any[]).map(p => ({
        id: p.id,
        coinId: p.coinId,
        coinSymbol: p.coinSymbol,
        coinDisplayName: p.coinSymbol,
        status: p.status,
        entryPrice: p.entryPrice,
        entryValueUsdt: p.entryValueUsdt ?? 0,
        openedAt: p.openedAt,
        closePrice: p.closePrice,
        closedAt: p.closedAt,
        realizedPnl: p.realizedPnl,
        realizedPnlPct: p.realizedPnlPct,
        isVirtual: p.isVirtual ?? false,
        closeReason: p.closeReason ?? null,
      } satisfies SignalRecord))),

  stats: () =>
    api.get<SignalStats>('/position/stats').then(r => r.data),

  delete: (id: string) =>
    api.delete(`/position/${id}`),

  bulkDelete: (ids: string[]) =>
    api.delete('/position/bulk', { data: { ids } }),
}

export interface T3ChartCandle {
  time: number; open: number; high: number; low: number; close: number; volume: number
}
export interface T3ChartValue { time: number; value: number }
export interface T3ChartMarker { time: number; side: 'buy' | 'sell'; price: number }
export interface T3ChartResult {
  candles: T3ChartCandle[]
  t3: T3ChartValue[]
  signals: T3ChartMarker[]
  currentT3Up: boolean
  t3TurnUp: boolean
  t3TurnDown: boolean
  currentT3: number
  currentPrice: number
}

export const t3ChartApi = {
  get: (coinId: number, symbol: string, timeframe: string, limit = 150) =>
    api.get<T3ChartResult>('/signal/t3-chart', { params: { coinId, symbol, timeframe, limit } }).then(r => r.data),
}

export const signalsApi = {
  analyze: (coinId: number, symbol: string, timeframe: string) =>
    api.get<SignalAnalysis>('/signal/analyze', { params: { coinId, symbol, timeframe } }).then(r => r.data),

  getPositions: (params?: { status?: number; pageSize?: number }) =>
    signalRecordsApi.list({ pageSize: params?.pageSize }),

  list: (params?: { pageSize?: number }) =>
    signalRecordsApi.list(params),
}
