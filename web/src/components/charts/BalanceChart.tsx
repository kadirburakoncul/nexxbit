import { useEffect, useRef, useMemo, useState } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { createChart, AreaSeries, ColorType, LineStyle } from 'lightweight-charts'
import { useQuery } from '@tanstack/react-query'
import { binanceApi } from '@/api/binance'
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'
import { formatUsdt, cn } from '@/lib/utils'

const RANGES = [
  { label: '7G', days: 7 },
  { label: '30G', days: 30 },
  { label: '90G', days: 90 },
]

const UTC3_OFFSET = 3 * 3600

export default function BalanceChart({ days: initialDays = 30, liveValueUsdt = null }: { days?: number; liveValueUsdt?: number | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null)
  const [days, setDays] = useState(initialDays)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['balance-history', days],
    queryFn: () => binanceApi.getBalanceHistory(days),
  })

  // Geçmiş kayıtlar + (varsa) anlık canlı değer — grafik çizgisi ve istatistik kutuları aynı veriyi kullanır
  const bars = useMemo(() => {
    const sorted = [...(data ?? [])].sort((a, b) =>
      new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime())
    const points = sorted.map(d => ({
      time: (Math.floor(new Date(d.snapshotAt).getTime() / 1000) + UTC3_OFFSET) as number,
      value: d.totalValueUsdt,
    }))
    if (liveValueUsdt != null) {
      const nowSec = (Math.floor(Date.now() / 1000) + UTC3_OFFSET) as number
      const lastPoint = points[points.length - 1]
      // Aynı timestamp'e iki nokta düşmesin diye son geçmiş kayıttan en az 1sn sonrasına koy
      if (!lastPoint || nowSec > lastPoint.time) {
        points.push({ time: nowSec, value: liveValueUsdt })
      } else {
        points[points.length - 1] = { time: nowSec, value: liveValueUsdt }
      }
    }
    return points
  }, [data, liveValueUsdt])

  const stats = useMemo(() => {
    if (bars.length < 2) return null
    const first = bars[0].value
    const last = bars[bars.length - 1].value
    const values = bars.map(b => b.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const change = last - first
    const changePct = first > 0 ? (change / first) * 100 : 0
    return { first, last, min, max, change, changePct }
  }, [bars])

  // Grafik bir kere oluşturulur — konteyner her zaman DOM'da olduğu için ilk açılışta da çalışır
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        attributionLogo: false,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: { color: 'rgba(250,204,21,0.35)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a2e' },
        horzLine: { color: 'rgba(250,204,21,0.35)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a2e' },
      },
      width: containerRef.current.clientWidth || 300,
      height: 220,
    })

    seriesRef.current = chart.addSeries(AreaSeries, {
      lineColor: '#facc15',
      topColor: 'rgba(250,204,21,0.28)',
      bottomColor: 'rgba(250,204,21,0.0)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: 'rgba(250,204,21,0.5)',
      priceLineStyle: LineStyle.Dotted,
    })

    chartRef.current = chart

    // İlk mount anında konteyner genişliği 0 olabilir (layout henüz oturmamış) —
    // bir sonraki frame'de yeniden ölç, böylece "ilk açılışta grafik gelmiyor" sorunu oluşmaz
    const raf = requestAnimationFrame(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    if (bars.length === 0) { seriesRef.current.setData([]); return }

    // Çok küçük portföylerde (örn. <10 USDT) hassasiyeti artır
    const maxVal = Math.max(...bars.map(b => b.value))
    const precision = maxVal > 0 && maxVal < 10 ? 4 : 2
    seriesRef.current.applyOptions({ priceFormat: { type: 'price', precision, minMove: 1 / 10 ** precision } })

    seriesRef.current.setData(bars)
    chartRef.current?.timeScale().fitContent()
  }, [bars])

  const isUp = (stats?.changePct ?? 0) >= 0
  const Icon = isUp ? TrendingUp : (stats?.changePct ?? 0) === 0 ? Minus : TrendingDown
  const showEmpty = !isLoading && bars.length === 0

  return (
    <div className="space-y-3">
      {/* Range selector */}
      <div className="flex justify-end items-center gap-2">
        {isFetching && !isLoading && (
          <div className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
        )}
        <div className="flex items-center gap-1 shrink-0 bg-white/[0.03] rounded-lg p-0.5">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                days === r.days
                  ? 'bg-yellow-400/15 text-yellow-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              Şu An
              {liveValueUsdt != null && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Canlı" />}
            </p>
            <p className="text-sm font-bold text-slate-100 font-mono">{formatUsdt(stats.last)}</p>
          </div>
          <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{days}g Değişim</p>
            <div className={`flex items-center gap-1 text-sm font-bold font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              <Icon size={12} />
              {stats.changePct >= 0 ? '+' : ''}{stats.changePct.toFixed(2)}%
            </div>
          </div>
          <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">En Yüksek</p>
            <p className="text-sm font-bold text-slate-300 font-mono">{formatUsdt(stats.max)}</p>
          </div>
          <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">En Düşük</p>
            <p className="text-sm font-bold text-slate-300 font-mono">{formatUsdt(stats.min)}</p>
          </div>
        </div>
      )}

      {/* Chart — konteyner her zaman render edilir, üstüne overlay düşer */}
      <div className="relative w-full rounded-xl overflow-hidden bg-white/[0.015]" style={{ height: 220 }}>
        <div ref={containerRef} className="w-full h-full" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0f]/40">
            <div className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        )}

        {showEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4 bg-[#0b0b0f]/40">
            <Clock size={20} className="text-slate-700 mb-1" />
            <p className="text-slate-500 text-sm">Bu aralıkta bakiye kaydı yok</p>
            <p className="text-slate-700 text-xs">Bakiye her gün 00:05 UTC'de otomatik kaydedilir — ilk kayıt bu gece oluşacak</p>
          </div>
        )}
      </div>
    </div>
  )
}
