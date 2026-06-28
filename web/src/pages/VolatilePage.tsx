import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '@/api/client'
import Header from '@/components/layout/Header'
import { Flame, TrendingUp, TrendingDown, Lock, Zap, RefreshCw, AlertTriangle, CircleDot, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

const VOLATILE_INTERVAL = 60

interface MomentumRow {
  symbol: string
  baseAsset: string
  priceChangePercent: number | null
  lastPrice: number | null
  quoteVolume: number | null
  highPrice: number | null
  lowPrice: number | null
  hasOpenPosition: boolean
  isVirtual: boolean
  entryPrice: number | null
  unrealizedPnlPct: number | null
  strategyName: string | null
  isVolatileStrategy: boolean
  lockedByOtherStrategy: boolean
}

interface DroppedRow extends MomentumRow {}

interface VolatileDashboard {
  momentumCoins: MomentumRow[]
  droppedPositions: DroppedRow[]
  activeVolatileStrategies: { id: string; name: string; timeframe: string; trailingStopPct: number; stopLossPct: number; volatileMinChangePct: number; volatileGainerLimit: number; volatilePositionSizePct: number | null }[]
  hasVolatileMode: boolean
  stats: { totalMomentum: number; openPositions: number; volatilePositions: number }
}

const fetchDashboard = (minChange: number, limit: number) =>
  api.get<VolatileDashboard>('/volatile/dashboard', { params: { minChange, limit } }).then(r => r.data)

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtVol(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function VolatilePage() {
  const [countdown, setCountdown] = useState(VOLATILE_INTERVAL)

  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['volatile-dashboard'],
    queryFn: () => fetchDashboard(3, 25),
    refetchInterval: VOLATILE_INTERVAL * 1000,
    staleTime: (VOLATILE_INTERVAL - 5) * 1000,
  })

  useEffect(() => {
    setCountdown(VOLATILE_INTERVAL)
  }, [dataUpdatedAt])

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('tr-TR') : '—'

  return (
    <>
      <Header title="Volatil Mod Tarayıcısı" />
      <div className="p-3 md:p-6 space-y-5 max-w-5xl">

        {/* Header stats */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-3 flex-wrap">
            <Stat label="Momentum Coin" value={data?.stats.totalMomentum ?? '—'} color="text-orange-400" icon={<Flame size={13} />} />
            <Stat label="Açık Pozisyon" value={data?.stats.openPositions ?? '—'} color="text-emerald-400" icon={<CircleDot size={13} />} />
            <Stat label="Volatil Pozisyon" value={data?.stats.volatilePositions ?? '—'} color="text-purple-400" icon={<Zap size={13} />} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-md px-2 py-1">
              <Timer size={10} className={countdown <= 10 ? 'text-orange-400' : 'text-slate-600'} />
              <span className={cn('text-[10px] font-mono tabular-nums font-semibold',
                countdown <= 10 ? 'text-orange-400' : 'text-slate-600')}>
                {countdown}s
              </span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <RefreshCw size={12} className={cn(isFetching && 'animate-spin')} />
              Son güncelleme: {lastUpdate}
            </button>
          </div>
        </div>

        {/* Aktif Volatil Stratejiler */}
        {data && (
          data.hasVolatileMode ? (
            <div className="flex flex-wrap gap-2">
              {data.activeVolatileStrategies.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/25 rounded-lg px-3 py-1.5">
                  <Zap size={12} className="text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">{s.name}</span>
                  <span className="text-xs text-slate-500">
                    {s.timeframe} · min%{s.volatileMinChangePct ?? 3} · top{s.volatileGainerLimit ?? 20}
                    {' · '}TS %{s.trailingStopPct} · SL %{s.stopLossPct}
                    {s.volatilePositionSizePct != null ? ` · pos%${s.volatilePositionSizePct}` : ' · pos×0.5'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-400">
              <AlertTriangle size={14} />
              Aktif volatil mod stratejisi yok. Stratejiler sayfasından bir strateji oluşturup Volatil Mod'u açın.
            </div>
          )
        )}

        {/* Momentum Coin Tablosu */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Flame size={14} className="text-orange-400" />
              <span className="text-sm font-semibold text-slate-200">Binance Momentum Coinleri</span>
            </div>
            <span className="text-xs text-slate-500">min %3 yükseliş · min $1M hacim · her 1dk güncellenir</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Yükleniyor…</div>
          ) : !data?.momentumCoins.length ? (
            <div className="p-8 text-center text-slate-500 text-sm">Momentum coin bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-white/5">
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Coin</th>
                    <th className="text-right px-4 py-2 font-medium">Fiyat</th>
                    <th className="text-right px-4 py-2 font-medium">24s %</th>
                    <th className="text-right px-4 py-2 font-medium">Hacim</th>
                    <th className="text-right px-4 py-2 font-medium">High / Low</th>
                    <th className="text-left px-4 py-2 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {data.momentumCoins.map((row, i) => (
                    <CoinRow key={row.symbol} rank={i + 1} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Düşen Momentum — hâlâ açık pozisyon olanlar */}
        {(data?.droppedPositions.length ?? 0) > 0 && (
          <div className="bg-white/[0.03] border border-yellow-500/15 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
              <AlertTriangle size={14} className="text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-300">Momentum Dışı Açık Pozisyonlar</span>
              <span className="text-xs text-slate-500 ml-1">— Bu coinler artık top 25 gainer listesinde değil ama pozisyon hâlâ açık</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-white/5">
                    <th className="text-left px-4 py-2 font-medium">Coin</th>
                    <th className="text-right px-4 py-2 font-medium">Giriş Fiyatı</th>
                    <th className="text-left px-4 py-2 font-medium">Strateji</th>
                    <th className="text-left px-4 py-2 font-medium">Tür</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.droppedPositions.map(row => (
                    <tr key={row.symbol} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-[10px] font-bold text-yellow-400">
                            {row.baseAsset.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200 text-xs">{row.baseAsset}</p>
                            <p className="text-slate-500 text-[10px]">{row.symbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 text-xs">${fmt(row.entryPrice, 4)}</td>
                      <td className="px-4 py-3">
                        {row.strategyName ? (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full border',
                            row.isVolatileStrategy
                              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                              : 'bg-slate-500/10 text-slate-400 border-white/10')}>
                            {row.strategyName}
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded border',
                          row.isVirtual
                            ? 'bg-slate-500/10 text-slate-400 border-white/10'
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/25')}>
                          {row.isVirtual ? 'Sanal' : 'Gerçek'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
      <div className={cn('flex items-center gap-1', color)}>{icon}</div>
      <div>
        <p className="text-[10px] text-slate-500 leading-none mb-0.5">{label}</p>
        <p className={cn('text-lg font-bold leading-none', color)}>{value}</p>
      </div>
    </div>
  )
}

function CoinRow({ rank, row }: { rank: number; row: MomentumRow }) {
  const isPositive = (row.priceChangePercent ?? 0) >= 0

  return (
    <tr className={cn(
      'border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors',
      row.hasOpenPosition && 'bg-emerald-500/[0.03]'
    )}>
      {/* Rank */}
      <td className="px-4 py-3 text-slate-600 text-xs">{rank}</td>

      {/* Coin */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold',
            row.hasOpenPosition && row.isVolatileStrategy ? 'bg-purple-500/20 text-purple-400' :
            row.hasOpenPosition ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-orange-500/15 text-orange-400'
          )}>
            {row.baseAsset.slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm">{row.baseAsset}</p>
            <p className="text-slate-500 text-[10px]">{row.symbol}</p>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-right">
        <p className="text-slate-200 font-mono text-sm">${fmt(row.lastPrice, 4)}</p>
        {row.hasOpenPosition && row.entryPrice && (
          <p className="text-[10px] text-slate-500">Giriş: ${fmt(row.entryPrice, 4)}</p>
        )}
      </td>

      {/* 24h % */}
      <td className="px-4 py-3 text-right">
        <span className={cn('font-semibold text-sm flex items-center justify-end gap-0.5',
          isPositive ? 'text-emerald-400' : 'text-red-400')}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isPositive ? '+' : ''}{fmt(row.priceChangePercent)}%
        </span>
        {row.hasOpenPosition && row.unrealizedPnlPct != null && (
          <p className={cn('text-[10px]', row.unrealizedPnlPct >= 0 ? 'text-emerald-500' : 'text-red-500')}>
            PnL: {row.unrealizedPnlPct >= 0 ? '+' : ''}{fmt(row.unrealizedPnlPct)}%
          </p>
        )}
      </td>

      {/* Volume */}
      <td className="px-4 py-3 text-right text-slate-400 text-xs">{fmtVol(row.quoteVolume)}</td>

      {/* High/Low */}
      <td className="px-4 py-3 text-right">
        <p className="text-[10px] text-emerald-500/70">H: ${fmt(row.highPrice, 4)}</p>
        <p className="text-[10px] text-red-500/70">L: ${fmt(row.lowPrice, 4)}</p>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {row.lockedByOtherStrategy ? (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <Lock size={11} />
            <span>{row.strategyName ?? 'Diğer strateji'}</span>
          </div>
        ) : row.hasOpenPosition ? (
          <div className="space-y-0.5">
            <div className={cn('flex items-center gap-1 text-xs',
              row.isVolatileStrategy ? 'text-purple-400' : 'text-emerald-400')}>
              {row.isVolatileStrategy ? <Zap size={11} /> : <CircleDot size={11} />}
              <span>Açık Pozisyon</span>
            </div>
            {row.strategyName && (
              <p className="text-[10px] text-slate-500">{row.strategyName} · {row.isVirtual ? 'Sanal' : 'Gerçek'}</p>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-600">Bekliyor</span>
        )}
      </td>
    </tr>
  )
}
