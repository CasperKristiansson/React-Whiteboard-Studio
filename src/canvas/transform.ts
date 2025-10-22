import type { Transform, Vec2 } from '../types'

export const screenPointToWorld = (
  point: Vec2,
  viewport: Transform,
): Vec2 => ({
  x: point.x / viewport.scale + viewport.x,
  y: point.y / viewport.scale + viewport.y,
})

export const worldPointToScreen = (
  point: Vec2,
  viewport: Transform,
): Vec2 => ({
  x: (point.x - viewport.x) * viewport.scale,
  y: (point.y - viewport.y) * viewport.scale,
})

export const screenDeltaToWorld = (
  delta: Vec2,
  viewport: Transform,
): Vec2 => ({
  x: delta.x / viewport.scale,
  y: delta.y / viewport.scale,
})

export const applyZoomAtPoint = (
  viewport: Transform,
  screenPoint: Vec2,
  nextScale: number,
): Transform => {
  const worldPoint = screenPointToWorld(screenPoint, viewport)
  return {
    ...viewport,
    scale: nextScale,
    x: worldPoint.x - screenPoint.x / nextScale,
    y: worldPoint.y - screenPoint.y / nextScale,
  }
}
