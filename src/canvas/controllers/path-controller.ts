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
  smoothingEpsilon: number
}

const DEFAULT_STROKE = { r: 15, g: 23, b: 42, a: 1 }
const SAMPLE_DISTANCE = 1.5
const DEFAULT_SMOOTHING_EPSILON = 1.2

export const beginPath = (point: Vec2, pointerId: number): PathState => {
  const timestamp = Date.now()
  const id = createShapeId()
  const store = useAppStore.getState()
  const smoothingEpsilon =
    store.settings.pathSmoothingEpsilon ?? DEFAULT_SMOOTHING_EPSILON

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
    smoothingEpsilon,
  }
}

type UpdateOptions = {
  force?: boolean
}

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

export const updatePath = (
  state: PathState,
  point: Vec2,
  options?: UpdateOptions,
) => {
  const { force = false } = options ?? {}
  const lastIndex = state.points.length - 1
  const last = state.points[lastIndex]
  const distance = distanceBetween(last, point)

  if (distance < SAMPLE_DISTANCE) {
    if (!force || distance === 0) {
      return
    }

    if (state.points.length === 1) {
      state.points.push(point)
    } else {
      state.points[lastIndex] = point
    }
  } else {
    state.points.push(point)
  }

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
  const epsilon =
    Number.isFinite(state.smoothingEpsilon) && state.smoothingEpsilon > 0
      ? state.smoothingEpsilon
      : DEFAULT_SMOOTHING_EPSILON
  const simplified = ramerDouglasPeucker(state.points, epsilon)
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
  store.setTool('select')
  state.committed = true
}

export const cancelPath = (state: PathState) => {
  if (state.committed) return
  const store = useAppStore.getState()
  store.deleteShapes([state.id])
  store.clearSelection()
  store.setTool('select')
  state.committed = true
}
