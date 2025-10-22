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
    size: { x: 1, y: 1 },
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

  const width = Math.max(1, Math.abs(point.x - state.origin.x))
  const height = Math.max(1, Math.abs(point.y - state.origin.y))

  const position: Vec2 = {
    x: Math.min(state.origin.x, point.x),
    y: Math.min(state.origin.y, point.y),
  }

  useAppStore.getState().addShape({
    id: state.id,
    type: 'rect',
    position,
    size: { x: width, y: height },
    rotation: 0,
    zIndex: state.zIndex,
    stroke: { r: 15, g: 23, b: 42, a: 1 },
    strokeWidth: 2,
    fill: { r: 255, g: 255, b: 255, a: 1 },
    createdAt: state.createdAt,
    updatedAt: Date.now(),
  })
}

export const finalizeRect = (state: RectDragState) => {
  if (state.committed) return
  const store = useAppStore.getState()
  store.commit('Draw rectangle')
  store.select([state.id], 'set')
  state.committed = true
}

export const cancelRect = (state: RectDragState) => {
  if (state.committed) return
  const store = useAppStore.getState()
  store.deleteShapes([state.id])
  state.committed = true
}
