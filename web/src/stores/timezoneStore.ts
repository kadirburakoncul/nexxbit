import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const COMMON_TZ = [
  { value: 'UTC', label: 'UTC (00:00)' },
  { value: 'Europe/Istanbul', label: 'İstanbul (UTC+3)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'Europe/London', label: 'Londra (UTC+0/+1)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Singapore', label: 'Singapur (UTC+8)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
]

export const TIMEZONE_OPTIONS = COMMON_TZ

interface TimezoneStore {
  timezone: string
  setTimezone: (tz: string) => void
}

export const useTimezoneStore = create<TimezoneStore>()(
  persist(
    (set) => ({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
      setTimezone: (timezone) => set({ timezone }),
    }),
    { name: 'nexxbit-timezone' }
  )
)

export function formatInTz(dateStr: string, timezone: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(dateStr).toLocaleString('tr-TR', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      ...opts,
    })
  } catch {
    return new Date(dateStr).toLocaleString('tr-TR')
  }
}
