import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import {
  DEFAULT_TRANSFORM,
  DOCUMENT_VERSION,
  type DocumentV1,
  type Shape,
  type ThemePreference,
  type Transform,
  type Vec2,
  type UUID,
} from '../types'
import {
  cloneDocument,
  cloneSelection,
  createHistoryEntry,
  createHistoryState,
  type HistoryEntry,
  type HistoryState,
} from './history'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 16

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
  pathSmoothingEpsilon: number
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
  /** Undo/redo history state */
  history: HistoryState
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
  commit: (label: string, options?: { squash?: boolean }) => void
  undo: () => void
  redo: () => void
  duplicateSelection: () => void
  bringSelectionForward: () => void
  sendSelectionBackward: () => void
  bringSelectionToFront: () => void
  sendSelectionToBack: () => void
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

const initialDocument = createInitialDocument()

const initialState: AppState = {
  document: initialDocument,
  selection: [],
  activeTool: 'select',
  viewport: { ...DEFAULT_TRANSFORM },
  settings: {
    gridVisible: true,
    snapEnabled: false,
    pathSmoothingEpsilon: 1.2,
  },
  theme: 'system',
  dirty: false,
  history: createHistoryState(),
}

const trimStack = (stack: HistoryEntry[], capacity: number) => {
  while (stack.length > capacity) {
    stack.shift()
  }
}

const applyHistoryEntry = (state: AppState, entry: HistoryEntry) => {
  const restored = cloneDocument(entry.document)
  state.document = restored
  state.viewport = { ...restored.viewport }
  state.theme = restored.theme
  state.selection = cloneSelection(entry.selection)
  state.dirty = true
  state.history.pending = null
}

const captureHistorySnapshot = (state: AppState) => {
  if (!state.history.pending) {
    state.history.pending = createHistoryEntry(state.document, state.selection)
  }
  if (state.history.future.length) {
    state.history.future = []
  }
}

const reorderSelection = (
  state: AppState,
  mutate: (sorted: Shape[], selected: Set<UUID>) => boolean,
) => {
  if (!state.selection.length) return false

  const selected = new Set(state.selection)
  const sorted = [...state.document.shapes].sort((a, b) => a.zIndex - b.zIndex)
  const changed = mutate(sorted, selected)
  if (!changed) return false

  captureHistorySnapshot(state)

  sorted.forEach((shape, index) => {
    const nextZ = index + 1
    if (shape.zIndex !== nextZ) {
      shape.zIndex = nextZ
      shape.updatedAt = now()
    }
  })

  state.document.shapes = sorted
  state.dirty = true
  return true
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
        captureHistorySnapshot(state)
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
        captureHistorySnapshot(state)
        state.theme = theme
        state.document.theme = theme
        state.dirty = true
      })
    },

    replaceDocument: (document) => {
      set((state) => {
        const restored = cloneDocument(document)
        state.document = restored
        state.viewport = { ...restored.viewport }
        state.theme = restored.theme
        state.selection = []
        state.dirty = false
        state.history = createHistoryState()
      })
    },

    addShape: (shape) => {
      set((state) => {
        captureHistorySnapshot(state)
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

        captureHistorySnapshot(state)
        updater(target)
        target.updatedAt = now()
        state.dirty = true
      })
    },

    deleteShapes: (ids) => {
      if (!ids.length) return

      set((state) => {
        captureHistorySnapshot(state)
        state.document.shapes = state.document.shapes.filter(
          (shape) => !ids.includes(shape.id),
        )
        state.selection = state.selection.filter((id) => !ids.includes(id))

        if (!state.dirty) {
          state.dirty = true
        }
      })
    },

    duplicateSelection: () => {
      set((state) => {
        if (!state.selection.length) return

        captureHistorySnapshot(state)

        const timestamp = now()
        const clones: Shape[] = []

        const offsetPoints = (points: Vec2[]) =>
          points.map((point) => ({ x: point.x + 16, y: point.y + 16 }))

        state.selection.forEach((id) => {
          const original = state.document.shapes.find((shape) => shape.id === id)
          if (!original) return

          const newId = createShapeId()
          const zIndex = original.zIndex + 1

          switch (original.type) {
            case 'rect':
            case 'ellipse':
            case 'text':
            case 'image':
              clones.push({
                ...original,
                id: newId,
                position: {
                  x: original.position.x + 16,
                  y: original.position.y + 16,
                },
                zIndex,
                createdAt: timestamp,
                updatedAt: timestamp,
              } as Shape)
              break
            case 'line':
            case 'arrow':
              clones.push({
                ...original,
                id: newId,
                points: offsetPoints(original.points),
                zIndex,
                createdAt: timestamp,
                updatedAt: timestamp,
              } as Shape)
              break
            case 'path':
              clones.push({
                ...original,
                id: newId,
                d: offsetPoints(original.d),
                zIndex,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              break
          }
        })

        if (!clones.length) return

        state.document.shapes.push(...clones)
        state.selection = clones.map((shape) => shape.id)
        state.dirty = true
      })
    },

    bringSelectionForward: () => {
      set((state) => {
        reorderSelection(state, (sorted, selected) => {
          let changed = false
          for (let index = sorted.length - 2; index >= 0; index -= 1) {
            const current = sorted[index]
            if (!selected.has(current.id)) continue
            const next = sorted[index + 1]
            if (!next || selected.has(next.id)) continue
            sorted[index] = next
            sorted[index + 1] = current
            changed = true
          }
          return changed
        })
      })
    },

    sendSelectionBackward: () => {
      set((state) => {
        reorderSelection(state, (sorted, selected) => {
          let changed = false
          for (let index = 1; index < sorted.length; index += 1) {
            const current = sorted[index]
            if (!selected.has(current.id)) continue
            const previous = sorted[index - 1]
            if (!previous || selected.has(previous.id)) continue
            sorted[index] = previous
            sorted[index - 1] = current
            changed = true
          }
          return changed
        })
      })
    },

    bringSelectionToFront: () => {
      set((state) => {
        reorderSelection(state, (sorted, selected) => {
          const selectedShapes = sorted.filter((shape) => selected.has(shape.id))
          if (!selectedShapes.length || selectedShapes.length === sorted.length) {
            return false
          }
          const unselectedShapes = sorted.filter((shape) => !selected.has(shape.id))
          if (!unselectedShapes.length) {
            return false
          }

          let changed = false
          for (let index = 0; index < selectedShapes.length; index += 1) {
            const source = selectedShapes[index]
            const destination = sorted[sorted.length - selectedShapes.length + index]
            if (source.id !== destination.id) {
              changed = true
              break
            }
          }

          if (!changed) return false

          sorted.length = 0
          sorted.push(...unselectedShapes, ...selectedShapes)
          return true
        })
      })
    },

    sendSelectionToBack: () => {
      set((state) => {
        reorderSelection(state, (sorted, selected) => {
          const selectedShapes = sorted.filter((shape) => selected.has(shape.id))
          if (!selectedShapes.length || selectedShapes.length === sorted.length) {
            return false
          }
          const unselectedShapes = sorted.filter((shape) => !selected.has(shape.id))
          if (!unselectedShapes.length) {
            return false
          }

          let changed = false
          for (let index = 0; index < selectedShapes.length; index += 1) {
            const destination = sorted[index]
            if (destination.id !== selectedShapes[index].id) {
              changed = true
              break
            }
          }

          if (!changed) return false

          sorted.length = 0
          sorted.push(...selectedShapes, ...unselectedShapes)
          return true
        })
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

    commit: (label, options) => {
      set((state) => {
        const pending = state.history.pending
        if (!pending) return

        pending.label = label
        pending.at = now()

        if (options?.squash && state.history.past.length) {
          state.history.past[state.history.past.length - 1] = pending
        } else {
          state.history.past.push(pending)
          trimStack(state.history.past, state.history.capacity)
        }

        state.history.pending = null
        state.history.future = []
      })
    },

    undo: () => {
      set((state) => {
        const { history } = state

        if (history.pending) {
          const previous = history.pending
          const currentSnapshot = createHistoryEntry(
            state.document,
            state.selection,
            previous.label,
          )
          history.future.push(currentSnapshot)
          trimStack(history.future, history.capacity)
          applyHistoryEntry(state, previous)
          return
        }

        if (!history.past.length) return

        const snapshot = history.past.pop()!
        const currentSnapshot = createHistoryEntry(
          state.document,
          state.selection,
          snapshot.label,
        )
        history.future.push(currentSnapshot)
        trimStack(history.future, history.capacity)
        applyHistoryEntry(state, snapshot)
      })
    },

    redo: () => {
      set((state) => {
        const { history } = state
        if (!history.future.length) return

        const snapshot = history.future.pop()!
        const currentSnapshot = createHistoryEntry(
          state.document,
          state.selection,
          snapshot.label,
        )
        history.past.push(currentSnapshot)
        trimStack(history.past, history.capacity)
        applyHistoryEntry(state, snapshot)
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
export const selectCanUndo = (state: AppStore) =>
  state.history.pending !== null || state.history.past.length > 0
export const selectCanRedo = (state: AppStore) =>
  state.history.future.length > 0

export const useAppSelector = <T,>(selector: (state: AppStore) => T) =>
  useAppStore(selector)

export const createShapeId = () => makeId()
