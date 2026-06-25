import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUsdt(val: number | null | undefined, decimals?: number) {
  if (val == null) return '—'
  const abs = Math.abs(val)
  const maxD = decimals ?? (abs >= 1 ? 2 : abs >= 0.0001 ? 6 : 8)
  const minD = decimals ?? (abs >= 1 ? 2 : 0)
  return val.toLocaleString('tr-TR', {
    minimumFractionDigits: minD,
    maximumFractionDigits: maxD,
  }) + ' USDT'
}

export function formatPct(val: number | null | undefined) {
  if (val == null) return '—'
  const sign = val > 0 ? '+' : ''
  return `${sign}${(val * 100).toFixed(2)}%`
}

export function pnlColor(val: number | null | undefined) {
  if (val == null) return 'text-slate-400'
  return val >= 0 ? 'text-emerald-400' : 'text-red-400'
}
