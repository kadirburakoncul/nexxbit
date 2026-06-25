import { useEffect, useRef } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { createChart, LineSeries, ColorType } from 'lightweight-charts'
import { useQuery } from '@tanstack/react-query'
import { binanceApi } from '@/api/binance'

export default function BalanceChart({ days = 30 }: { days?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['balance-history', days],
    queryFn: () => binanceApi.getBalanceHistory(days),
  })

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 200,
    })

    seriesRef.current = chart.addSeries(LineSeries, {
      color: '#facc15',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })

    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return
    const bars = data
      .map(d => ({ time: Math.floor(new Date(d.snapshotAt).getTime() / 1000), value: d.totalValueUsdt }))
      .sort((a, b) => a.time - b.time)
    seriesRef.current.setData(bars)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  if (isLoading) return (
    <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">Yükleniyor…</div>
  )
  if (!data || data.length === 0) return (
    <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
      Bakiye geçmişi yok — snapshot job günlük çalışır
    </div>
  )

  return <div ref={containerRef} className="w-full" style={{ height: 200 }} />
}
