import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeStore {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        applyTheme(next)
      },
    }),
    { name: 'nexxbit-theme' }
  )
)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light-mode')
    root.classList.remove('dark-mode')
  } else {
    root.classList.remove('light-mode')
    root.classList.add('dark-mode')
  }
}

// Apply saved theme on initial load
const savedRaw = localStorage.getItem('nexxbit-theme')
if (savedRaw) {
  try {
    const parsed = JSON.parse(savedRaw)
    if (parsed?.state?.theme) applyTheme(parsed.state.theme)
  } catch { /* */ }
}
