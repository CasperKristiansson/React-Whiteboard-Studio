import { useEffect, useRef } from 'react'
import { IconContext } from 'react-icons'

import CanvasViewport from './canvas/canvas-viewport'
import { useKeyboardShortcuts } from './app/keyboard'
import TopNavigation from './ui/top-navigation'
import ThemeToggle from './components/theme-toggle'
import TitleBadge from './components/title-badge'
import ShapeInspector from './ui/shape-inspector'
import DebugOverlay from './dev/debug-overlay'
import ErrorToasts from './ui/error-toasts'
import {
  selectActiveTool,
  selectSettings,
  selectTheme,
  useAppSelector,
  useAppStore,
} from './state/store'
import type { ThemePreference } from './types'
import type { UiSettings } from './state/store'
import { usePersistence } from './state/persistence'

const THEME_STORAGE_KEY = 'draw.theme'
const SETTINGS_STORAGE_KEY = 'draw.settings'

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

function App() {
  const theme = useAppSelector(selectTheme)
  const activeTool = useAppSelector(selectActiveTool)
  const setTheme = useAppStore((state) => state.setTheme)
  const settings = useAppSelector(selectSettings)
  const setSettings = useAppStore((state) => state.setSettings)
  const hasSyncedTheme = useRef(false)
  const hasSyncedSettings = useRef(false)

  useKeyboardShortcuts()
  usePersistence()

  const debugEnabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug')

  useEffect(() => {
    if (typeof window === 'undefined' || hasSyncedTheme.current) return
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemePreference(stored)) {
      setTheme(stored)
    }
    hasSyncedTheme.current = true
  }, [setTheme])

  useEffect(() => {
    if (typeof window === 'undefined' || hasSyncedSettings.current) return
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<UiSettings>
        const next: Partial<UiSettings> = {}
        if (typeof parsed.gridVisible === 'boolean') {
          next.gridVisible = parsed.gridVisible
        }
        if (typeof parsed.snapEnabled === 'boolean') {
          next.snapEnabled = parsed.snapEnabled
        }
        if (Object.keys(next).length > 0) {
          setSettings(next)
        }
      } catch {
        // ignore malformed persisted settings
      }
    }
    hasSyncedSettings.current = true
  }, [setSettings])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || !hasSyncedSettings.current) return
    const payload = JSON.stringify({
      gridVisible: settings.gridVisible,
      snapEnabled: settings.snapEnabled,
    })
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, payload)
  }, [settings.gridVisible, settings.snapEnabled])

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
    <IconContext.Provider
      value={{ size: '18', className: 'align-middle inline-block' }}
    >
      <>
        <main className="relative h-screen w-screen overflow-hidden bg-(--color-app-bg) text-(--color-app-foreground) transition-colors">
          <div className="absolute inset-0">
            <CanvasViewport />
          </div>
          <TopNavigation />
          <div className="pointer-events-none absolute top-[10px] left-4 z-40">
            <div className="pointer-events-auto">
              <TitleBadge activeTool={activeTool} />
            </div>
          </div>
          <div className="pointer-events-none absolute top-[10px] right-4 z-40">
            <div className="pointer-events-auto">
              <ThemeToggle />
            </div>
          </div>
          <ShapeInspector />
        </main>
        <DebugOverlay enabled={debugEnabled} />
        <ErrorToasts />
      </>
    </IconContext.Provider>
  )
}

export default App
