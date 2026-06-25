import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'

type EventHandler = (...args: unknown[]) => void

interface UseSignalROptions {
  hubUrl: string
  events: Record<string, EventHandler>
  onConnected?: (conn: HubConnection) => Promise<void>
  enabled?: boolean
}

export function useSignalR({ hubUrl, events, onConnected, enabled = true }: UseSignalROptions) {
  const connRef = useRef<HubConnection | null>(null)
  const accessToken = useAuthStore(s => s.accessToken)

  const stop = useCallback(async () => {
    if (connRef.current) {
      await connRef.current.stop()
      connRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || !accessToken) return

    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => accessToken })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    Object.entries(events).forEach(([event, handler]) => {
      conn.on(event, handler)
    })

    conn.start()
      .then(() => onConnected?.(conn))
      .catch(err => console.warn(`SignalR [${hubUrl}] bağlantı hatası:`, err))

    connRef.current = conn

    return () => { conn.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubUrl, enabled, accessToken])

  return { stop, connRef }
}
