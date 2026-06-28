import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { useEffect, useRef, useCallback, useState } from 'react'
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
  const [state, setState] = useState<HubConnectionState>(HubConnectionState.Connecting)
  const everConnected = useRef(false)

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
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build()

    Object.entries(events).forEach(([event, handler]) => {
      conn.on(event, handler)
    })

    conn.onreconnecting(() => setState(HubConnectionState.Reconnecting))
    conn.onreconnected(() => { everConnected.current = true; setState(HubConnectionState.Connected) })
    conn.onclose(() => setState(everConnected.current ? HubConnectionState.Disconnected : HubConnectionState.Connecting))

    conn.start()
      .then(() => {
        everConnected.current = true
        setState(HubConnectionState.Connected)
        return onConnected?.(conn)
      })
      .catch(err => {
        // İlk bağlantı başarısız — banner gösterme, sessizce logla
        setState(HubConnectionState.Connecting)
        console.warn(`SignalR [${hubUrl}] bağlantı hatası:`, err)
      })

    connRef.current = conn

    return () => { conn.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubUrl, enabled, accessToken])

  return { stop, connRef, state }
}
