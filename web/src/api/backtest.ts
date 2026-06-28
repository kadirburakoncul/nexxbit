import { api } from './client'

export interface BacktestRun {
  id: string; name: string; status: string; timeframe: string
  startDate: string; endDate: string; initialCapital: number
  finalCapital: number | null; netPnl: number | null; netPnlPct: number | null
  winRate: number | null; totalTrades: number | null; createdAt: string
  errorMessage: string | null
}

export interface BacktestTrade {
  id: number; coinSymbol: string; side: string
  entryTime: string; entryPrice: number
  exitTime: string | null; exitPrice: number | null; exitReason: string | null
  quantity: number; commission: number; pnlUsdt: number | null; pnlPct: number | null
}

export interface BacktestResult extends BacktestRun {
  winningTrades: number | null; maxDrawdown: number | null
  sharpeRatio: number | null; errorMessage: string | null
  completedAt: string | null; trades: BacktestTrade[]
}

export interface StartBacktestRequest {
  name: string; coinIds: number[]; timeframe: string
  startDate: string; endDate: string; initialCapital: number
  commissionRate: number; slippagePct: number; stopLossPct: number | null; takeProfitPct: number | null
}

export const backtestApi = {
  list: () => api.get<BacktestRun[]>('/backtest').then(r => r.data),
  start: (req: StartBacktestRequest) => api.post<{ runId: string }>('/backtest', req).then(r => r.data),
  getResult: (runId: string) => api.get<BacktestResult>(`/backtest/${runId}`).then(r => r.data),
  delete: (runId: string) => api.delete(`/backtest/${runId}`),
}
