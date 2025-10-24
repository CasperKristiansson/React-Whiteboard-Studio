import type { RGBA } from '../types'

type ResolvedTheme = 'light' | 'dark'

const LIGHT_CONTRAST: RGBA = { r: 15, g: 23, b: 42, a: 1 }
const DARK_CONTRAST: RGBA = { r: 226, g: 232, b: 240, a: 1 }

const cloneColor = (color: RGBA): RGBA => ({
  r: color.r,
  g: color.g,
  b: color.b,
  a: color.a,
})

export const getResolvedTheme = (): ResolvedTheme => {
  if (typeof document === 'undefined') {
    return 'light'
  }

  const { dataset } = document.documentElement
  if (dataset.theme === 'dark') return 'dark'
  if (dataset.theme === 'light') return 'light'

  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export const getDefaultStrokeColor = (): RGBA => {
  const theme = getResolvedTheme()
  return cloneColor(theme === 'dark' ? DARK_CONTRAST : LIGHT_CONTRAST)
}

export const getDefaultFillColor = (): RGBA => {
  const theme = getResolvedTheme()
  const base = theme === 'dark' ? DARK_CONTRAST : LIGHT_CONTRAST
  const alpha = theme === 'dark' ? 0.32 : 0.18
  return { ...base, a: alpha }
}

export const getDefaultTextColor = (): RGBA => getDefaultStrokeColor()
