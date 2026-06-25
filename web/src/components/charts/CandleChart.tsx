import { useEffect, useRef, useCallback } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { createChart, CandlestickSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import { useQuery } from '@tanstack/react-query'
import { coinsApi } from '@/api/coins'
import type { Candle } from '@/api/coins'
import { useSignalR } from '@/hooks/useSignalR'
import type { HubConnection } from '@microsoft/signalr'

interface CandleUpdate {
  symbol: string; interval: string; openTime: string
  open: number; high: number; low: number; close: number
  volume: number; isClosed: boolean
}

function toBar(c: Candle) {
  return {
    time: Math.floor(new Date(c.openTime).getTime() / 1000) as number,
    open: c.open, high: c.high, low: c.low, close: c.close,
  }
}

interface Props {
  symbol: string
  interval?: string
  height?: number
}

export default function CandleChart({ symbol, interval = '1h', height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null)

  const { data: candles, isLoading } = useQuery({
    queryKey: ['candles', symbol, interval],
    queryFn: () => coinsApi.getCandles(symbol, interval, 1500),
    enabled: !!symbol,
    staleTime: 60_000,
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
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399',
      downColor: '#f87171',
      borderUpColor: '#34d399',
      borderDownColor: '#f87171',
      wickUpColor: '#34d399',
      wickDownColor: '#f87171',
    })

    chartRef.current = chart
    seriesRef.current = series

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
  }, [height])

  useEffect(() => {
    if (!seriesRef.current || !candles) return
    const bars = candles
      .map(toBar)
      .sort((a, b) => a.time - b.time)
    seriesRef.current.setData(bars)
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  const handleUpdate = useCallback((update: unknown) => {
    const u = update as CandleUpdate
    if (!seriesRef.current || u.symbol !== symbol || u.interval !== interval) return
    seriesRef.current.update({
      time: Math.floor(new Date(u.openTime).getTime() / 1000),
      open: u.open, high: u.high, low: u.low, close: u.close,
    })
  }, [symbol, interval])

  const onConnected = useCallback(async (conn: HubConnection) => {
    await conn.invoke('JoinRoom', symbol, interval)
  }, [symbol, interval])

  useSignalR({
    hubUrl: '/hubs/candles',
    events: { CandleUpdate: handleUpdate as (...args: unknown[]) => void },
    onConnected,
    enabled: !!symbol,
  })

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0f]/80 z-10 rounded-xl">
          <span className="text-sm text-slate-500">Yükleniyor…</span>
        </div>
      )}
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height }} />
    </div>
  )
}
