import type { RGBA, UUID, Vec2 } from './common'

export type ShapeType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'path'
  | 'text'
  | 'image'

export type BaseShape = {
  id: UUID
  type: ShapeType
  /** World origin of the shape */
  position: Vec2
  /** Rotation in degrees */
  rotation: number
  /** Higher values render on top */
  zIndex: number
  stroke: RGBA
  strokeWidth: number
  fill?: RGBA
  locked?: boolean
  hidden?: boolean
  createdAt: number
  updatedAt: number
}

export type RectShape = BaseShape & {
  type: 'rect'
  size: Vec2
  radius?: number
}

export type EllipseShape = BaseShape & {
  type: 'ellipse'
  rx: number
  ry: number
}

export type LineShape = BaseShape & {
  type: 'line'
  points: Vec2[]
}

export type ArrowShape = BaseShape & {
  type: 'arrow'
  points: Vec2[]
  headSize: number
}

export type PathShape = BaseShape & {
  type: 'path'
  d: Vec2[]
  closed?: boolean
  roughness?: number
}

export type TextShape = BaseShape & {
  type: 'text'
  text: string
  /** Text box size */
  box: Vec2
  font: {
    family: string
    weight: number
    size: number
  }
  letterSpacing?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  italic?: boolean
  underline?: boolean
  shadow?: {
    offset: Vec2
    blur: number
    color: RGBA
  }
}

export type ImageShape = BaseShape & {
  type: 'image'
  size: Vec2
  assetId: UUID
  objectFit?: 'contain' | 'cover'
}

export type Shape =
  | RectShape
  | EllipseShape
  | LineShape
  | ArrowShape
  | PathShape
  | TextShape
  | ImageShape

export const DEFAULT_STROKE: RGBA = { r: 33, g: 33, b: 33, a: 1 }

export const DEFAULT_FILL: RGBA = { r: 255, g: 255, b: 255, a: 1 }
