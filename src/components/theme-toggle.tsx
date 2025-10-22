import { selectTheme, useAppSelector, useAppStore } from '../state/store'
import type { ThemePreference } from '../types'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const getButtonClassName = (active: boolean) => {
  const base =
    'rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]'

  if (active) {
    return `${base} border-[color:var(--color-button-active-border)] bg-[color:var(--color-button-active-bg)] text-[color:var(--color-button-text)] shadow`
  }

  return `${base} border-transparent bg-[color:var(--color-button-bg)] text-[color:var(--color-button-muted-text)] hover:bg-[color:var(--color-button-hover-bg)]`
}

const ThemeToggle = () => {
  const theme = useAppSelector(selectTheme)
  const setTheme = useAppStore((state) => state.setTheme)

  return (
    <div className="flex items-center gap-1 rounded-full border border-[color:var(--color-elevated-border)] bg-[color:var(--color-elevated-bg)] px-1 py-1">
      {THEME_OPTIONS.map((option) => {
        const active = option.value === theme
        return (
          <button
            key={option.value}
            type="button"
            className={getButtonClassName(active)}
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default ThemeToggle
