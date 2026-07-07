import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Market = 'crypto' | 'bist'

interface MarketStore {
  market: Market
  setMarket: (m: Market) => void
}

export const useMarketStore = create<MarketStore>()(
  persist(
    (set) => ({
      market: 'crypto',
      setMarket: (market) => set({ market }),
    }),
    { name: 'nexxbit-market' }
  )
)
