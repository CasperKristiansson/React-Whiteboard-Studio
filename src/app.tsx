import { useEffect } from 'react'
import { IconContext } from 'react-icons'

import CanvasViewport from './canvas/canvas-viewport'
import { useKeyboardShortcuts } from './app/keyboard'
import TopNavigation from './ui/top-navigation'
import ThemeToggle from './components/theme-toggle'
import TitleBadge from './components/title-badge'
import DebugOverlay from './dev/debug-overlay'
import ErrorToasts from './ui/error-toasts'
import { selectActiveTool, selectTheme, useAppSelector, useAppStore } from './state/store'
import type { ThemePreference } from './types'
import { usePersistence } from './state/persistence'

const THEME_STORAGE_KEY = 'draw.theme'

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

function App() {
  const theme = useAppSelector(selectTheme)
  const activeTool = useAppSelector(selectActiveTool)
  const setTheme = useAppStore((state) => state.setTheme)

  useKeyboardShortcuts()
  usePersistence()

  const debugEnabled =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemePreference(stored) && stored !== theme) {
      setTheme(stored)
    }
  }, [setTheme, theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (resolved: 'light' | 'dark') => {
      root.dataset.theme = resolved
      root.style.colorScheme = resolved
    }

    const sync = () => {
      if (theme === 'system') {
        applyTheme(media.matches ? 'dark' : 'light')
      } else {
        applyTheme(theme)
      }
    }

    sync()

    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (theme === 'system') {
        applyTheme(event.matches ? 'dark' : 'light')
      }
    }

    media.addEventListener('change', handleMediaChange)
    return () => {
      media.removeEventListener('change', handleMediaChange)
    }
  }, [theme])

  return (
    <IconContext.Provider value={{ size: '18', className: 'align-middle inline-block' }}>
      <>
        <main className="relative h-screen w-screen overflow-hidden bg-(--color-app-bg) text-(--color-app-foreground) transition-colors">
          <div className="absolute inset-0">
            <CanvasViewport />
          </div>
          <TopNavigation />
          <div className="pointer-events-none absolute left-4 top-[10px] z-40">
            <div className="pointer-events-auto">
              <TitleBadge activeTool={activeTool} />
            </div>
          </div>
          <div className="pointer-events-none absolute right-4 top-[10px] z-40">
            <div className="pointer-events-auto">
              <ThemeToggle />
            </div>
          </div>
        </main>
        <DebugOverlay enabled={debugEnabled} />
        <ErrorToasts />
      </>
    </IconContext.Provider>
  )
}

export default App
