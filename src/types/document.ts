import type { ThemePreference, Transform, UUID } from './common'
import type { Shape } from './shapes'

export const DOCUMENT_VERSION = 1 as const

export type DocumentV1 = {
  id: UUID
  name: string
  shapes: Shape[]
  viewport: Transform
  theme: ThemePreference
  version: typeof DOCUMENT_VERSION
}

export type ProjectMeta = {
  id: UUID
  name: string
  createdAt: number
  updatedAt: number
}
