import type { Vec2 } from '../../types'
import { DEFAULT_FILL, DEFAULT_STROKE } from '../../types/shapes'
import { createShapeId, useAppStore } from '../../state/store'

export type EllipseDragState = {
  id: string
  origin: Vec2
  current: Vec2
  pointerId: number
  createdAt: number
  zIndex: number
  committed: boolean
}

export const beginEllipse = (
  point: Vec2,
  pointerId: number,
): EllipseDragState => {
  const timestamp = Date.now()
  const id = createShapeId()
  const store = useAppStore.getState()

  store.addShape({
    id,
    type: 'ellipse',
    position: point,
    rx: 0,
    ry: 0,
    rotation: 0,
    zIndex: timestamp,
    stroke: DEFAULT_STROKE,
    strokeWidth: 1.5,
    fill: DEFAULT_FILL,
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

export const updateEllipse = (state: EllipseDragState, point: Vec2) => {
  state.current = point

  const rx = Math.abs(point.x - state.origin.x)
  const ry = Math.abs(point.y - state.origin.y)

  const position: Vec2 = {
    x: (state.origin.x + point.x) / 2,
    y: (state.origin.y + point.y) / 2,
  }

  useAppStore.getState().updateShape(state.id, (shape) => {
    if (shape.type !== 'ellipse') return
    shape.position = position
    shape.rx = rx
    shape.ry = ry
    shape.updatedAt = Date.now()
  })
}

export const finalizeEllipse = (state: EllipseDragState) => {
  if (state.committed) return
  const store = useAppStore.getState()
  store.updateShape(state.id, (shape) => {
    if (shape.type !== 'ellipse') return
    shape.rx = Math.max(shape.rx, 1)
    shape.ry = Math.max(shape.ry, 1)
    shape.updatedAt = Date.now()
  })
  store.commit('Draw ellipse')
  store.select([state.id], 'set')
  store.setTool('select')
  state.committed = true
}

export const cancelEllipse = (state: EllipseDragState) => {
  if (state.committed) return
  const store = useAppStore.getState()
  store.deleteShapes([state.id])
  store.clearSelection()
  store.setTool('select')
  state.committed = true
}
