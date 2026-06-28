import { api } from './client'

export interface TradeOrder {
  id: string
  coinId: number
  coinSymbol: string
  side: number
  type: string
  status: number
  quantity: number
  price: number | null
  filledQuantity: number | null
  filledPrice: number | null
  commission: number | null
  commissionAsset: string | null
  isAutomatic: boolean
  binanceOrderId: number | null
  realizedPnl: number | null
  createdAt: string
  updatedAt: string
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
