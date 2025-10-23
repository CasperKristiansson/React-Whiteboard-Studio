import { selectTheme, useAppSelector, useAppStore } from '../state/store'
import type { ThemePreference } from '../types'
import { LuMonitorSmartphone, LuSun, LuMoon } from 'react-icons/lu'

const THEME_OPTIONS = [
  {
    value: 'system' as ThemePreference,
    label: 'System',
    Icon: LuMonitorSmartphone,
  },
  { value: 'light' as ThemePreference, label: 'Light', Icon: LuSun },
  { value: 'dark' as ThemePreference, label: 'Dark', Icon: LuMoon },
]

const getButtonClassName = (active: boolean) => {
  const base =
    'rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)'

  if (active) {
    return `${base} border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow`
  }

  return `${base} border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)`
}

const ThemeToggle = () => {
  const theme = useAppSelector(selectTheme)
  const setTheme = useAppStore((state) => state.setTheme)

  return (
    <div className="flex items-center gap-1 rounded-full border border-(--color-elevated-border) bg-(--color-elevated-bg) px-1 py-1">
      {THEME_OPTIONS.map((option) => {
        const active = option.value === theme
        const Icon = option.Icon
        return (
          <button
            key={option.value}
            type="button"
            className={getButtonClassName(active)}
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
          >
            <span className="mr-1 inline-flex items-center gap-1">
              <Icon className="h-4 w-4" />
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ThemeToggle
