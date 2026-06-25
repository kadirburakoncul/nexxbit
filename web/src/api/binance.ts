import { api } from './client'

export interface Balance { asset: string; free: number; locked: number }
export interface AccountStatus {
  isConnected: boolean; isTestnet: boolean; lastConnectionAt: string | null
  lastConnectionStatus: string | null; apiKeyHint: string | null
}
export interface BalanceSnapshot { totalValueUsdt: number; assets: string; snapshotAt: string }

export const binanceApi = {
  getStatus: () => api.get<AccountStatus>('/binanceaccount/status').then(r => r.data),
  getBalances: () => api.get<Balance[]>('/binanceaccount/balances').then(r => r.data),
  saveApiKey: (data: { apiKey: string; apiSecret: string; isTestnet: boolean }) =>
    api.post('/binanceaccount/api-key', data).then(r => r.data),
  deleteApiKey: () => api.delete('/binanceaccount/api-key'),
  getBalanceHistory: (days = 30) =>
    api.get<BalanceSnapshot[]>(`/binanceaccount/balance-history?days=${days}`).then(r => r.data),
}
