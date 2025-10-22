import type { Vec2 } from '../../types'
import { createShapeId, useAppStore } from '../../state/store'
import { ramerDouglasPeucker } from '../../utils/rdp'

export type PathState = {
  id: string
  points: Vec2[]
  position: Vec2
  pointerId: number
  createdAt: number
  zIndex: number
  committed: boolean
}

const DEFAULT_STROKE = { r: 15, g: 23, b: 42, a: 1 }
const SAMPLE_DISTANCE = 1.5
const SMOOTHING_EPSILON = 1.2

export const beginPath = (point: Vec2, pointerId: number): PathState => {
  const timestamp = Date.now()
  const id = createShapeId()
  const store = useAppStore.getState()

  store.addShape({
    id,
    type: 'path',
    position: point,
    d: [{ x: 0, y: 0 }],
    rotation: 0,
    zIndex: timestamp,
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  return {
    id,
    points: [point],
    position: point,
    pointerId,
    createdAt: timestamp,
    zIndex: timestamp,
    committed: false,
  }
}

const shouldSample = (current: Vec2, next: Vec2) =>
  Math.hypot(next.x - current.x, next.y - current.y) >= SAMPLE_DISTANCE

export const updatePath = (state: PathState, point: Vec2) => {
  const last = state.points[state.points.length - 1]
  if (!shouldSample(last, point)) return

  state.points.push(point)

  const store = useAppStore.getState()
  const relativePoints = state.points.map((p) => ({
    x: p.x - state.position.x,
    y: p.y - state.position.y,
  }))

  store.addShape({
    id: state.id,
    type: 'path',
    position: state.position,
    d: relativePoints,
    rotation: 0,
    zIndex: state.zIndex,
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    createdAt: state.createdAt,
    updatedAt: Date.now(),
  })
}

export const finalizePath = (state: PathState) => {
  if (state.committed) return

  const store = useAppStore.getState()
  const simplified = ramerDouglasPeucker(state.points, SMOOTHING_EPSILON)
  state.points = simplified

  const relativePoints = simplified.map((p) => ({
    x: p.x - state.position.x,
    y: p.y - state.position.y,
  }))

  if (relativePoints.length <= 1) {
    cancelPath(state)
    return
  }

  store.addShape({
    id: state.id,
    type: 'path',
    position: state.position,
    d: relativePoints,
    rotation: 0,
    zIndex: state.zIndex,
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    createdAt: state.createdAt,
    updatedAt: Date.now(),
  })

  store.commit('Draw path')
  store.select([state.id], 'set')
  state.committed = true
}

export const cancelPath = (state: PathState) => {
  if (state.committed) return
  useAppStore.getState().deleteShapes([state.id])
  state.committed = true
}
