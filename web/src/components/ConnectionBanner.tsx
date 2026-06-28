import { HubConnectionState } from '@microsoft/signalr'
import { WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  state: HubConnectionState
}

export default function ConnectionBanner({ state }: Props) {
  // Connecting = ilk bağlantı denenirken, banner gösterme
  if (state === HubConnectionState.Connected || state === HubConnectionState.Connecting) return null

  const isReconnecting = state === HubConnectionState.Reconnecting

  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-xs font-medium',
      isReconnecting
        ? 'bg-amber-500/90 text-amber-950'
        : 'bg-red-500/90 text-white'
    )}>
      {isReconnecting
        ? <><RefreshCw size={12} className="animate-spin" /> Canlı bağlantı yeniden kuruluyor…</>
        : <><WifiOff size={12} /> Canlı bağlantı kesildi — veriler güncel olmayabilir</>
      }
    </div>
  )
}
