import type { Tool, Vec2 } from '../../types'
import { createShapeId, useAppStore } from '../../state/store'

export type PolylineState = {
  id: string
  tool: Extract<Tool, 'line' | 'arrow'>
  points: Vec2[]
  position: Vec2
  pointerId: number
  createdAt: number
  zIndex: number
  locked: boolean
}

const DEFAULT_STROKE = { r: 15, g: 23, b: 42, a: 1 }

export const beginPolyline = (
  tool: Extract<Tool, 'line' | 'arrow'>,
  point: Vec2,
  pointerId: number,
): PolylineState => {
  const timestamp = Date.now()
  const id = createShapeId()
  const store = useAppStore.getState()

  store.addShape({
    id,
    type: tool,
    position: point,
    points: [{ x: 0, y: 0 }],
    rotation: 0,
    zIndex: timestamp,
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(tool === 'arrow' ? { headSize: 16 } : {}),
  } as any)

  return {
    id,
    tool,
    points: [{ x: 0, y: 0 }],
    position: point,
    pointerId,
    createdAt: timestamp,
    zIndex: timestamp,
    locked: false,
  }
}

export const updatePolyline = (state: PolylineState, point: Vec2) => {
  const store = useAppStore.getState()
  const lastPoint = state.points[state.points.length - 1]
  state.points[state.points.length - 1] = {
    x: point.x - state.position.x,
    y: point.y - state.position.y,
  }

  store.addShape({
    id: state.id,
    type: state.tool,
    position: state.position,
    points: state.points,
    rotation: 0,
    zIndex: state.zIndex,
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    createdAt: state.createdAt,
    updatedAt: Date.now(),
    ...(state.tool === 'arrow' ? { headSize: 16 } : {}),
  } as any)

  state.points[state.points.length - 1] = lastPoint
}

export const extendPolyline = (state: PolylineState, point: Vec2) => {
  const relative: Vec2 = {
    x: point.x - state.position.x,
    y: point.y - state.position.y,
  }
  state.points.push(relative)
  updatePolyline(state, point)
}

export const finalizePolyline = (state: PolylineState) => {
  if (state.locked) return
  const store = useAppStore.getState()
  store.addShape({
    id: state.id,
    type: state.tool,
    position: state.position,
    points: state.points,
    rotation: 0,
    zIndex: state.zIndex,
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    createdAt: state.createdAt,
    updatedAt: Date.now(),
    ...(state.tool === 'arrow' ? { headSize: 16 } : {}),
  } as any)
  store.commit(state.tool === 'arrow' ? 'Draw arrow' : 'Draw line')
  store.select([state.id], 'set')
  state.locked = true
}

export const cancelPolyline = (state: PolylineState) => {
  if (state.locked) return
  useAppStore.getState().deleteShapes([state.id])
  state.locked = true
}
