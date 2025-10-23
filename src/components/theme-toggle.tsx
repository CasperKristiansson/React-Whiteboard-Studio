import clsx from 'clsx'
import { selectTheme, useAppSelector, useAppStore } from '../state/store'
import type { ThemePreference } from '../types'
import { LuSun, LuMoon } from 'react-icons/lu'

const ThemeToggle = () => {
  const theme = useAppSelector(selectTheme)
  const setTheme = useAppStore((state) => state.setTheme)

  const handleToggle = (value: ThemePreference) => {
    if (theme !== value) {
      setTheme(value)
    }
  }

  const computedTheme: ThemePreference = (() => {
    if (theme === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return 'light'
    }
    return theme
  })()

  return (
    <div className="inline-flex rounded-2xl border border-(--color-elevated-border)/80 bg-(--color-elevated-bg)/95 px-1 py-1 shadow-lg backdrop-blur">
      <button
        type="button"
        className={clsx(
          'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
          computedTheme === 'light'
            ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow-sm'
            : 'border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
        )}
        onClick={() => handleToggle('light')}
        aria-pressed={computedTheme === 'light'}
      >
        <LuSun className="h-4 w-4" />
        Light
      </button>
      <button
        type="button"
        className={clsx(
          'ml-1.5 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
          computedTheme === 'dark'
            ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow-sm'
            : 'border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
        )}
        onClick={() => handleToggle('dark')}
        aria-pressed={computedTheme === 'dark'}
      >
        <LuMoon className="h-4 w-4" />
        Dark
      </button>
    </div>
  )
}

export default ThemeToggle
