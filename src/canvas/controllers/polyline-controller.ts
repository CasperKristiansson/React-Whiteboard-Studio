import type { Vec2, LineShape, ArrowShape } from '../../types'
import { createShapeId, useAppStore, type Tool } from '../../state/store'

export type PolylineState = {
  id: string
  tool: Extract<Tool, 'line' | 'arrow'>
  points: Vec2[]
  position: Vec2
  pointerId: number | null
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

  const shape: LineShape | ArrowShape =
    tool === 'arrow'
      ? {
          id,
          type: 'arrow',
          position: point,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ],
          rotation: 0,
          zIndex: timestamp,
          stroke: DEFAULT_STROKE,
          strokeWidth: 2,
          headSize: 16,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
      : {
          id,
          type: 'line',
          position: point,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ],
          rotation: 0,
          zIndex: timestamp,
          stroke: DEFAULT_STROKE,
          strokeWidth: 2,
          createdAt: timestamp,
          updatedAt: timestamp,
        }

  store.addShape(shape)

  return {
    id,
    tool,
    points: [point, point],
    position: point,
    pointerId,
    createdAt: timestamp,
    zIndex: timestamp,
    locked: false,
  }
}

const shouldSample = (current: Vec2, next: Vec2) =>
  Math.hypot(next.x - current.x, next.y - current.y) >= 0.5
const applyPolylineShape = (state: PolylineState, points: Vec2[]) => {
  const store = useAppStore.getState()
  const relativePoints = points.map((p) => ({
    x: p.x - state.position.x,
    y: p.y - state.position.y,
  }))

  const base = {
    id: state.id,
    position: state.position,
    points: relativePoints,
    rotation: 0,
    zIndex: state.zIndex,
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    createdAt: state.createdAt,
    updatedAt: Date.now(),
  } as LineShape | ArrowShape

  const shape: LineShape | ArrowShape =
    state.tool === 'arrow'
      ? ({
          ...base,
          type: 'arrow',
          headSize: 16,
        } as ArrowShape)
      : ({
          ...base,
          type: 'line',
        } as LineShape)

  store.addShape(shape)
}

export const updatePolyline = (
  state: PolylineState,
  point: Vec2,
  options?: { force?: boolean },
) => {
  const last = state.points[state.points.length - 1]
  if (!options?.force && !shouldSample(last, point)) return

  state.points[state.points.length - 1] = point
  applyPolylineShape(state, state.points)
}

export const commitPolylinePoint = (state: PolylineState, point: Vec2) => {
  state.points[state.points.length - 1] = point
  applyPolylineShape(state, state.points)
  state.points.push({ ...point })
  applyPolylineShape(state, state.points)
}

export const finalizePolyline = (state: PolylineState) => {
  if (state.locked) return
  const store = useAppStore.getState()

  const points =
    state.points.length > 1 ? state.points.slice(0, -1) : [...state.points]

  const relativePoints = points.map((p) => ({
    x: p.x - state.position.x,
    y: p.y - state.position.y,
  }))

  if (
    relativePoints.length <= 1 ||
    (relativePoints.length === 2 &&
      Math.hypot(
        relativePoints[1].x - relativePoints[0].x,
        relativePoints[1].y - relativePoints[0].y,
      ) < 2)
  ) {
    cancelPolyline(state)
    return
  }

  const shape: LineShape | ArrowShape =
    state.tool === 'arrow'
      ? {
          id: state.id,
          type: 'arrow',
          position: state.position,
          points: relativePoints,
          rotation: 0,
          zIndex: state.zIndex,
          stroke: DEFAULT_STROKE,
          strokeWidth: 2,
          headSize: 16,
          createdAt: state.createdAt,
          updatedAt: Date.now(),
        }
      : {
          id: state.id,
          type: 'line',
          position: state.position,
          points: relativePoints,
          rotation: 0,
          zIndex: state.zIndex,
          stroke: DEFAULT_STROKE,
          strokeWidth: 2,
          createdAt: state.createdAt,
          updatedAt: Date.now(),
        }

  store.addShape(shape)
  store.commit(state.tool === 'arrow' ? 'Draw arrow' : 'Draw line')
  store.select([state.id], 'set')
  state.locked = true
}

export const cancelPolyline = (state: PolylineState) => {
  if (state.locked) return
  useAppStore.getState().deleteShapes([state.id])
  state.locked = true
}
