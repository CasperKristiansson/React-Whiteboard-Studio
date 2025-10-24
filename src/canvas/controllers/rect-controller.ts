import type { Vec2 } from '../../types'
import { createShapeId, useAppStore } from '../../state/store'

export type RectDragState = {
  id: string
  origin: Vec2
  current: Vec2
  pointerId: number
  createdAt: number
  zIndex: number
  committed: boolean
}

export const beginRect = (point: Vec2, pointerId: number): RectDragState => {
  const timestamp = Date.now()
  const id = createShapeId()
  const store = useAppStore.getState()

  store.addShape({
    id,
    type: 'rect',
    position: point,
    size: { x: 0, y: 0 },
    rotation: 0,
    zIndex: timestamp,
    stroke: { r: 15, g: 23, b: 42, a: 1 },
    strokeWidth: 2,
    fill: { r: 255, g: 255, b: 255, a: 1 },
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  return {
    id,
    origin: point,
    current: point,
    pointerId,
    createdAt: timestamp,
    zIndex: timestamp,
    committed: false,
  }
}

export const updateRect = (state: RectDragState, point: Vec2) => {
  state.current = point

  const width = Math.abs(point.x - state.origin.x)
  const height = Math.abs(point.y - state.origin.y)

  const position: Vec2 = {
    x: Math.min(state.origin.x, point.x),
    y: Math.min(state.origin.y, point.y),
  }

  useAppStore.getState().updateShape(state.id, (shape) => {
    if (shape.type !== 'rect') return
    shape.position = position
    shape.size = { x: width, y: height }
    shape.updatedAt = Date.now()
  })
}

export const finalizeRect = (state: RectDragState) => {
  if (state.committed) return
  const store = useAppStore.getState()
  store.updateShape(state.id, (shape) => {
    if (shape.type !== 'rect') return
    shape.size = {
      x: Math.max(shape.size.x, 1),
      y: Math.max(shape.size.y, 1),
    }
    shape.updatedAt = Date.now()
  })
  store.commit('Draw rectangle')
  store.select([state.id], 'set')
  store.setTool('select')
  state.committed = true
}

export const cancelRect = (state: RectDragState) => {
  if (state.committed) return
  const store = useAppStore.getState()
  store.deleteShapes([state.id])
  store.clearSelection()
  store.setTool('select')
  state.committed = true
}
