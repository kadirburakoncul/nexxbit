import { api } from './client'

export interface Coin { id: number; symbol: string; displayName: string; baseAsset: string; isInWatchlist: boolean }
export interface Candle {
  openTime: string; open: number; high: number; low: number; close: number; volume: number
}
export interface BinancePair {
  symbol: string; baseAsset: string; quoteAsset: string; isTrading: boolean
}
export interface MomentumCoin {
  symbol: string
  baseAsset: string
  priceChangePercent: number
  lastPrice: number
  quoteVolume: number
  highPrice: number
  lowPrice: number
}

export const coinsApi = {
  list: () => api.get<Coin[]>('/coin').then(r => r.data),
  toggleWatchlist: (coinId: number) =>
    api.post<boolean>(`/coin/${coinId}/watchlist`).then(r => r.data),
  getCandles: (symbol: string, interval = '1h', limit = 200) =>
    api.get<Candle[]>(`/coin/candles/${symbol}`, { params: { interval, limit } }).then(r => r.data),
  getBinancePairs: () =>
    api.get<BinancePair[]>('/coin/binance').then(r => r.data),
  syncFromBinance: () =>
    api.post<{ added: number; total: number }>('/coin/sync').then(r => r.data),
  addCoin: (symbol: string, baseAsset: string, quoteAsset: string) =>
    api.post<Coin>('/coin/add', { symbol, baseAsset, quoteAsset }).then(r => r.data),
  deleteCoin: (coinId: number) =>
    api.delete(`/coin/${coinId}`).then(r => r.data),
  getMomentumCoins: (minChange = 3, limit = 25) =>
    api.get<MomentumCoin[]>('/coin/momentum', { params: { minChange, limit } }).then(r => r.data),
}
