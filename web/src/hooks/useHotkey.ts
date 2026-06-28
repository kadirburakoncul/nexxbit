import { useEffect } from 'react'

export function useHotkey(key: string, handler: () => void, deps: unknown[] = []) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Input/textarea focus'tayken tetikleme
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === key) handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
