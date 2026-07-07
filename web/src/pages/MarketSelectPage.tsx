import { useNavigate } from 'react-router-dom'
import { TrendingUp, BarChart2 } from 'lucide-react'
import { useMarketStore } from '@/stores/marketStore'

export default function MarketSelectPage() {
  const navigate = useNavigate()
  const setMarket = useMarketStore(s => s.setMarket)

  const selectCrypto = () => {
    setMarket('crypto')
    navigate('/', { replace: true })
  }

  const selectBist = () => {
    setMarket('bist')
    navigate('/bist', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#08080d] relative overflow-hidden px-4">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-yellow-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-violet-500/4 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <TrendingUp size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl tracking-tight mb-1">
            <span className="font-bold text-yellow-400">NEXX</span><span className="font-light text-white">BIT</span>
          </h1>
          <p className="text-sm text-slate-500">Hangi piyasaya devam etmek istiyorsunuz?</p>
        </div>

        {/* Selection cards */}
        <div className="space-y-3">
          <button
            onClick={selectCrypto}
            className="w-full flex items-center gap-5 bg-white/[0.03] hover:bg-yellow-400/5 border border-white/8 hover:border-yellow-400/30 rounded-2xl p-5 transition-all group text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shrink-0 group-hover:bg-yellow-400/15 transition-colors">
              <TrendingUp size={22} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-100 group-hover:text-yellow-300 transition-colors">Kripto</p>
              <p className="text-xs text-slate-500 mt-0.5">Binance — otomatik alım/satım, sinyal izleme</p>
            </div>
          </button>

          <button
            onClick={selectBist}
            className="w-full flex items-center gap-5 bg-white/[0.03] hover:bg-blue-400/5 border border-white/8 hover:border-blue-400/30 rounded-2xl p-5 transition-all group text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center shrink-0 group-hover:bg-blue-400/15 transition-colors">
              <BarChart2 size={22} className="text-blue-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">Borsa</p>
              <p className="text-xs text-slate-500 mt-0.5">BIST — Türk hisse senetleri, T3 sinyal takibi</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
