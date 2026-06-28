import { useCallback, useEffect, useState } from 'react'

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    setPermission(Notification.permission)
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  const notify = useCallback((title: string, body: string, icon = '/favicon.ico') => {
    if (permission !== 'granted') return
    if (document.visibilityState === 'visible') return // Sayfa açıkken bildirme
    new Notification(title, { body, icon })
  }, [permission])

  return { permission, requestPermission, notify }
}
