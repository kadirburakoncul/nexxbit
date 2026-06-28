import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { coinsApi } from '@/api/coins'
import type { BinancePair, Coin } from '@/api/coins'
import { signalsApi } from '@/api/signals'

import { RefreshCw, X, Plus, Check, Trash2, Activity } from 'lucide-react'
import Header from '@/components/layout/Header'
import { useState } from 'react'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d']

const VERDICT_COLOR: Record<string, string> = {
  BUY: 'text-emerald-400',
  SELL: 'text-red-400',
  STRONG_SELL: 'text-red-500',
  HOLD: 'text-yellow-400',
  NO_SIGNAL: 'text-slate-400',
}

function AnalysisModal({ coin, onClose }: { coin: Coin; onClose: () => void }) {
  const [timeframe, setTimeframe] = useState('1h')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['signal-analyze', coin.id, timeframe],
    queryFn: () => signalsApi.analyze(coin.id, coin.symbol, timeframe),
    staleTime: 30_000,
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#13141a] border border-white/10 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h2 className="font-semibold text-slate-100">{coin.symbol} — Sinyal Analizi</h2>
            <p className="text-xs text-slate-500">Neden sinyal olustu / olusmaadi</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <span className="text-xs text-slate-500">Zaman dilimi:</span>
          <div className="flex gap-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${timeframe === tf ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                {tf}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="ml-auto text-slate-500 hover:text-slate-300">
            <RefreshCw size={13} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isLoading && <p className="text-slate-500 text-sm text-center py-6">Analiz yapiliyor...</p>}
          {data && (
            <>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 uppercase">Karar</span>
                  <span className={`text-sm font-bold ${VERDICT_COLOR[data.verdict] ?? 'text-slate-400'}`}>
                    {data.verdict}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{data.reason}</p>
                {data.score != null && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span>Skor: <span className="text-slate-300 font-medium">{data.score.toFixed(4)}</span></span>
                    {data.buyThreshold && <span>Alim esigi: <span className="text-emerald-400">{data.buyThreshold}</span></span>}
                    {data.sellThreshold && <span>Satis esigi: <span className="text-red-400">{data.sellThreshold}</span></span>}
                  </div>
                )}
              </div>

              {data.ema200RuleResult && (
                <div className={`border rounded-lg p-3 ${data.isEma200RuleEnabled ? 'bg-orange-500/5 border-orange-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                  <p className={`text-xs font-medium mb-1 ${data.isEma200RuleEnabled ? 'text-orange-400' : 'text-blue-400'}`}>
                    {data.isEma200RuleEnabled ? 'EMA200 Cross Kurali' : 'Strateji Modu'}
                  </p>
                  <p className="text-sm text-slate-300">{data.ema200RuleResult}</p>
                </div>
              )}

              {data.indicators.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 uppercase font-medium">Indikatorler</p>
                  {data.indicators.map(ind => (
                    <div key={ind.name} className={`rounded-lg p-3 border ${ind.passed ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-200">{ind.displayName}</span>
                        <span className={`text-xs font-bold ${ind.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                          {ind.passed ? 'Gecti' : 'Gecmedi'} ({ind.score.toFixed(3)})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{ind.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CoinsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [binanceSearch, setBinanceSearch] = useState('')
  const [addingSymbols, setAddingSymbols] = useState<Set<string>>(new Set())
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set())
  const [analyzeCoin, setAnalyzeCoin] = useState<Coin | null>(null)

  const { data: coins, isLoading } = useQuery({
    queryKey: ['coins'],
    queryFn: coinsApi.list,
  })

  const { data: binancePairs, isLoading: binanceLoading } = useQuery({
    queryKey: ['binance-pairs'],
    queryFn: coinsApi.getBinancePairs,
    enabled: showImport,
    staleTime: 5 * 60_000,
  })

  const deleteCoin = useMutation({
    mutationFn: coinsApi.deleteCoin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coins'] }),
  })

  const addCoin = async (pair: BinancePair) => {
    const sym = pair.symbol
    if (addingSymbols.has(sym) || addedSymbols.has(sym)) return
    setAddingSymbols(prev => new Set(prev).add(sym))
    try {
      await coinsApi.addCoin(pair.symbol, pair.baseAsset, pair.quoteAsset)
      qc.invalidateQueries({ queryKey: ['coins'] })
      setAddedSymbols(prev => new Set(prev).add(sym))
    } catch {
      qc.invalidateQueries({ queryKey: ['coins'] })
    } finally {
      setAddingSymbols(prev => { const s = new Set(prev); s.delete(sym); return s })
    }
  }

  const existingSymbols = new Set(coins?.map(c => c.symbol) ?? [])

  const filtered = coins?.filter(c =>
    c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.displayName.toLowerCase().includes(search.toLowerCase())
  )

  const filteredBinance = binancePairs?.filter(p =>
    p.isTrading && (
      p.symbol.toLowerCase().includes(binanceSearch.toLowerCase()) ||
      p.baseAsset.toLowerCase().includes(binanceSearch.toLowerCase())
    )
  ) ?? []

  return (
    <>
      <Header title="Coinlerim" />
      <div className="p-3 md:p-6 space-y-4">

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="BTCUSDT ara..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 w-full sm:w-56"
          />
          <span className="text-xs text-slate-500">{filtered?.length ?? 0} coin</span>
          <div className="sm:ml-auto">
            <button
              onClick={() => { setShowImport(v => !v); setBinanceSearch('') }}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus size={14} /> Coin Ekle
            </button>
          </div>
        </div>

        {showImport && (
          <div className="bg-white/5 border border-yellow-400/20 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Binance USDT Ciftleri</h3>
                <p className="text-xs text-slate-500 mt-0.5">Eklemek istediginiz coinin + butonuna basin.</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>

            <input
              value={binanceSearch}
              onChange={e => setBinanceSearch(e.target.value)}
              placeholder="BTC, ETH, AVAX, SOL..."
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-400/50"
            />

            {binanceLoading && <p className="text-slate-500 text-sm text-center py-6">Yukleniyor...</p>}
            {!binanceLoading && filteredBinance.length === 0 && <p className="text-slate-500 text-sm text-center py-6">Eslesen coin bulunamadi.</p>}

            {!binanceLoading && filteredBinance.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 max-h-72 overflow-y-auto pr-1">
                {filteredBinance.slice(0, 120).map(p => {
                  const inList = existingSymbols.has(p.symbol) || addedSymbols.has(p.symbol)
                  const isAdding = addingSymbols.has(p.symbol)
                  return (
                    <button
                      key={p.symbol}
                      type="button"
                      onClick={() => !inList && addCoin(p)}
                      disabled={inList || isAdding}
                      className={`flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg text-xs border transition-all ${
                        inList ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default'
                          : isAdding ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400 cursor-wait'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-yellow-400/10 hover:border-yellow-400/30 hover:text-yellow-300 cursor-pointer'
                      }`}
                    >
                      <span className="font-medium truncate">{p.baseAsset}</span>
                      <span className="shrink-0 text-[10px] opacity-60">
                        {isAdding ? '...' : inList ? <Check size={10} /> : <Plus size={10} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="bg-white/5 border border-white/5 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-500 uppercase">
                <th className="text-left px-5 py-3">Sembol</th>
                <th className="text-left px-5 py-3">Ad</th>
                <th className="text-left px-5 py-3">Base</th>
                <th className="text-center px-5 py-3">Analiz</th>
                <th className="text-center px-5 py-3">Kaldir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Yukleniyor...</td></tr>}
              {!isLoading && (filtered?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  Listenizde coin yok. "Coin Ekle" ile ekleyin.
                </td></tr>
              )}
              {filtered?.map(coin => (
                <tr key={coin.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-200">{coin.symbol}</td>
                  <td className="px-5 py-3 text-slate-400">{coin.displayName}</td>
                  <td className="px-5 py-3 text-slate-400">{coin.baseAsset}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => setAnalyzeCoin(coin)} className="text-slate-600 hover:text-yellow-400 transition-colors" title="Sinyal analizi">
                      <Activity size={15} />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => { if (confirm(`${coin.symbol} listenizden kaldirilsin mi?`)) deleteCoin.mutate(coin.id) }}
                      disabled={deleteCoin.isPending}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analyzeCoin && <AnalysisModal coin={analyzeCoin} onClose={() => setAnalyzeCoin(null)} />}
    </>
  )
}
