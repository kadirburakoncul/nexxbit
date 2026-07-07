import { api } from './client'

export interface AnalyticsSummary {
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  totalPnlUsdt: number
  avgWinPct: number
  avgLossPct: number
  profitFactor: number
  maxDrawdownPct: number
  avgHoldHours: number
}

export interface CoinPerformance {
  symbol: string
  trades: number
  wins: number
  winRate: number
  totalPnlUsdt: number
  avgPnlPct: number
}

export interface ExitReasonStat {
  reason: string
  count: number
  totalPnlUsdt: number
  pct: number
}

export interface DailyPnl {
  date: string
  pnlUsdt: number
  trades: number
  cumulativePnl: number
}

export interface TopTrade {
  symbol: string
  entryPrice: number
  exitPrice: number
  pnlPct: number
  pnlUsdt: number
  closeReason: string | null
  openedAt: string
  closedAt: string | null
}

export interface DrawdownPoint {
  date: string
  drawdownPct: number
}

export interface AnalyticsData {
  summary: AnalyticsSummary
  byCoin: CoinPerformance[]
  exitReasons: ExitReasonStat[]
  dailyPnl: DailyPnl[]
  bestTrades: TopTrade[]
  worstTrades: TopTrade[]
  drawdown: DrawdownPoint[]
}

export const analyticsApi = {
  get: (virtualOnly = false) =>
    api.get<AnalyticsData>('/analytics', { params: { virtualOnly } }).then(r => r.data),
}
