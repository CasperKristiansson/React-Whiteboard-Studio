export type UUID = string

export type Vec2 = {
  x: number
  y: number
}

export type RGBA = {
  r: number
  g: number
  b: number
  a: number
}

export type Transform = {
  /** Pan translation on the X axis in world units */
  x: number
  /** Pan translation on the Y axis in world units */
  y: number
  /** Zoom scale where 1 represents 100% */
  scale: number
  /** Rotation in degrees */
  rotation: number
}

export type ThemePreference = 'light' | 'dark' | 'system'

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
}
