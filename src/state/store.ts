import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import {
  DEFAULT_TRANSFORM,
  DOCUMENT_VERSION,
  type DocumentV1,
  type Shape,
  type ThemePreference,
  type Transform,
  type UUID,
} from '../types'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 16

type SelectionMode = 'set' | 'add' | 'toggle'

export type Tool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'path'
  | 'text'
  | 'image'

export type UiSettings = {
  gridVisible: boolean
  snapEnabled: boolean
}

export type AppState = {
  /** Currently loaded document */
  document: DocumentV1
  /** Currently selected shape ids */
  selection: UUID[]
  /** Active drawing tool */
  activeTool: Tool
  /** Runtime viewport transform */
  viewport: Transform
  /** User preferences */
  settings: UiSettings
  /** Current theme preference */
  theme: ThemePreference
  /** Indicates unsaved document changes */
  dirty: boolean
}

export type AppActions = {
  setTool: (tool: Tool) => void
  setViewport: (update: Partial<Transform>) => void
  setSettings: (update: Partial<UiSettings>) => void
  setTheme: (theme: ThemePreference) => void
  replaceDocument: (document: DocumentV1) => void
  addShape: (shape: Shape) => void
  updateShape: (id: UUID, updater: (shape: Shape) => void) => void
  deleteShapes: (ids: UUID[]) => void
  select: (ids: UUID[], mode?: SelectionMode) => void
  setSelection: (ids: UUID[]) => void
  clearSelection: () => void
  markClean: () => void
}

export type AppStore = AppState & AppActions

const now = () => Date.now()

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const makeId = (): UUID => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  // Fallback for environments without crypto.randomUUID
  return `id-${Math.random().toString(36).slice(2)}-${now()}`
}

const createInitialDocument = (): DocumentV1 => ({
  id: makeId(),
  name: 'Untitled',
  shapes: [],
  viewport: { ...DEFAULT_TRANSFORM },
  theme: 'system',
  version: DOCUMENT_VERSION,
})

const ensureSelectionIds = (ids: UUID[], shapes: Shape[]): UUID[] => {
  const existing = new Set(shapes.map((shape) => shape.id))
  const unique: UUID[] = []

  ids.forEach((id) => {
    if (existing.has(id) && !unique.includes(id)) {
      unique.push(id)
    }
  })

  return unique
}

const initialState: AppState = {
  document: createInitialDocument(),
  selection: [],
  activeTool: 'select',
  viewport: { ...DEFAULT_TRANSFORM },
  settings: {
    gridVisible: true,
    snapEnabled: false,
  },
  theme: 'system',
  dirty: false,
}

export const useAppStore = create<AppStore>()(
  immer((set) => ({
    ...initialState,

    setTool: (tool) => {
      set((state) => {
        state.activeTool = tool
      })
    },

    setViewport: (update) => {
      set((state) => {
        const nextScale =
          update.scale !== undefined
            ? clamp(update.scale, MIN_ZOOM, MAX_ZOOM)
            : state.viewport.scale

        state.viewport = {
          ...state.viewport,
          ...update,
          scale: nextScale,
        }

        state.document.viewport = { ...state.viewport }
        state.dirty = true
      })
    },

    setSettings: (update) => {
      set((state) => {
        state.settings = { ...state.settings, ...update }
      })
    },

    setTheme: (theme) => {
      set((state) => {
        state.theme = theme
        state.document.theme = theme
        state.dirty = true
      })
    },

    replaceDocument: (document) => {
      set((state) => {
        state.document = {
          ...document,
          viewport: { ...document.viewport },
        }
        state.viewport = { ...document.viewport }
        state.theme = document.theme
        state.selection = []
        state.dirty = false
      })
    },

    addShape: (shape) => {
      set((state) => {
        const timestamp = now()
        const exists = state.document.shapes.find((s) => s.id === shape.id)
        const nextShape: Shape = exists
          ? {
              ...shape,
              createdAt: exists.createdAt,
              updatedAt: timestamp,
            }
          : {
              ...shape,
              createdAt: shape.createdAt ?? timestamp,
              updatedAt: shape.updatedAt ?? timestamp,
            }

        if (exists) {
          const index = state.document.shapes.indexOf(exists)
          state.document.shapes[index] = nextShape
        } else {
          state.document.shapes.push(nextShape)
        }

        state.dirty = true
      })
    },

    updateShape: (id, updater) => {
      set((state) => {
        const target = state.document.shapes.find((shape) => shape.id === id)
        if (!target) return

        updater(target)
        target.updatedAt = now()
        state.dirty = true
      })
    },

    deleteShapes: (ids) => {
      if (!ids.length) return

      set((state) => {
        state.document.shapes = state.document.shapes.filter(
          (shape) => !ids.includes(shape.id),
        )
        state.selection = state.selection.filter((id) => !ids.includes(id))

        if (!state.dirty) {
          state.dirty = true
        }
      })
    },

    select: (ids, mode = 'set') => {
      set((state) => {
        const filtered = ensureSelectionIds(ids, state.document.shapes)

        if (mode === 'set') {
          state.selection = filtered
          return
        }

        const current = new Set(state.selection)

        if (mode === 'add') {
          filtered.forEach((id) => current.add(id))
          state.selection = Array.from(current)
          return
        }

        // toggle
        filtered.forEach((id) => {
          if (current.has(id)) {
            current.delete(id)
          } else {
            current.add(id)
          }
        })
        state.selection = Array.from(current)
      })
    },

    setSelection: (ids) => {
      set((state) => {
        state.selection = ensureSelectionIds(ids, state.document.shapes)
      })
    },

    clearSelection: () => {
      set((state) => {
        state.selection = []
      })
    },

    markClean: () => {
      set((state) => {
        state.dirty = false
      })
    },
  })),
)

export const selectDocument = (state: AppStore) => state.document
export const selectShapes = (state: AppStore) => state.document.shapes
export const selectSelection = (state: AppStore) => state.selection
export const selectActiveTool = (state: AppStore) => state.activeTool
export const selectViewport = (state: AppStore) => state.viewport
export const selectSettings = (state: AppStore) => state.settings
export const selectTheme = (state: AppStore) => state.theme
export const selectDirty = (state: AppStore) => state.dirty

export const useAppSelector = <T,>(selector: (state: AppStore) => T) =>
  useAppStore(selector)

export const createShapeId = () => makeId()
