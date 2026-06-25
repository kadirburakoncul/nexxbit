import { api } from './client'

export interface TradeOrder {
  id: string
  coinSymbol: string
  side: number
  quantity: number
  price: number
  status: number
  realizedPnl: number | null
  createdAt: string
}

export interface ManualOrderRequest {
  coinId: number
  symbol: string
  side: number
  quoteQty: number
}

export const tradesApi = {
  getOrders: (params?: { coinId?: number; status?: number; pageNumber?: number; pageSize?: number }) =>
    api.get<TradeOrder[]>('/trade/orders', { params }).then(r => r.data),
  placeManual: (req: ManualOrderRequest) =>
    api.post('/trade/manual', req).then(r => r.data),
}
