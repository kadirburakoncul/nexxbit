import { useState, useMemo } from 'react'

type Direction = 'asc' | 'desc'

export function useTableSort<T>(data: T[] | undefined, defaultKey?: keyof T) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey ?? null)
  const [dir, setDir] = useState<Direction>('desc')

  const toggle = (key: keyof T) => {
    if (sortKey === key) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setDir('desc') }
  }

  const sorted = useMemo(() => {
    if (!data || !sortKey) return data ?? []
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return dir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, dir])

  const indicator = (key: keyof T) =>
    sortKey === key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''

  return { sorted, toggle, indicator, sortKey, dir }
}
