import { useEffect } from 'react'
import { IconContext } from 'react-icons'

import CanvasViewport from './canvas/canvas-viewport'
import { useKeyboardShortcuts } from './app/keyboard'
import Toolbar from './ui/toolbar'
import ContextPanel from './ui/context-panel'
import ThemeToggle from './components/theme-toggle'
import AssetManager from './ui/asset-manager'
import ExportDialog from './ui/export-dialog'
import ImportDialog from './ui/import-dialog'
import ProjectManager from './ui/project-manager'
import DebugOverlay from './dev/debug-overlay'
import ErrorToasts from './ui/error-toasts'
import {
  selectActiveTool,
  selectTheme,
  useAppSelector,
  useAppStore,
} from './state/store'
import type { ThemePreference } from './types'
import { usePersistence } from './state/persistence'

const THEME_STORAGE_KEY = 'draw.theme'

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

function App() {
  const activeTool = useAppSelector(selectActiveTool)
  const theme = useAppSelector(selectTheme)
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
        <main className="min-h-screen bg-(--color-app-bg) text-(--color-app-foreground) transition-colors">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <h1 className="text-4xl font-semibold sm:text-5xl">
              React Whiteboard
            </h1>
            <p className="text-lg font-medium text-(--color-muted-foreground)">
              Active tool:{' '}
              <span className="font-semibold text-(--color-app-foreground)">
                {activeTool}
              </span>
            </p>
            <p className="text-sm text-(--color-muted-foreground)">
              Pan with{' '}
              <span className="rounded bg-(--color-button-bg) px-1.5 py-0.5 font-mono text-xs text-(--color-button-text)">
                Space + drag
              </span>
              , trackpad two-finger drag, or zoom with pinch /
              <span className="rounded bg-(--color-button-bg) px-1.5 py-0.5 font-mono text-xs text-(--color-button-text)">
                {' '}
                Ctrl/Cmd + wheel
              </span>
              . The viewport currently renders a placeholder while core drawing
              tools are under development.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-col gap-6">
          <div className="inline-flex justify-center">
            <Toolbar />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-(--color-elevated-border) bg-(--color-elevated-bg) p-6 shadow-xl backdrop-blur">
              <CanvasViewport />
            </div>
            <ContextPanel />
          </div>

          <AssetManager />
          <ProjectManager />
          <ExportDialog />
          <ImportDialog />
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
