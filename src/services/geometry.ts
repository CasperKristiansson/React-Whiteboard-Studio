import type { Shape, Vec2 } from '../types'

export type ShapeBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const createBounds = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ShapeBounds => ({
  minX,
  minY,
  maxX,
  maxY,
})

const addPosition = (position: Vec2, point: Vec2) => ({
  x: position.x + point.x,
  y: position.y + point.y,
})

const boundsFromPoints = (points: Vec2[]): ShapeBounds => {
  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  return createBounds(minX, minY, maxX, maxY)
}

export const getShapeBounds = (shape: Shape): ShapeBounds => {
  if (shape.type === 'rect') {
    return createBounds(
      shape.position.x,
      shape.position.y,
      shape.position.x + shape.size.x,
      shape.position.y + shape.size.y,
    )
  }

  if (shape.type === 'ellipse') {
    const minX = shape.position.x - shape.rx
    const minY = shape.position.y - shape.ry
    return createBounds(minX, minY, minX + shape.rx * 2, minY + shape.ry * 2)
  }

  if (shape.type === 'text') {
    return createBounds(
      shape.position.x,
      shape.position.y,
      shape.position.x + shape.box.x,
      shape.position.y + shape.box.y,
    )
  }

  if (shape.type === 'image') {
    return createBounds(
      shape.position.x,
      shape.position.y,
      shape.position.x + shape.size.x,
      shape.position.y + shape.size.y,
    )
  }

  if (shape.type === 'line' || shape.type === 'arrow') {
    const points = shape.points.map((point) =>
      addPosition(shape.position, point),
    )
    return boundsFromPoints(points)
  }

  if (shape.type === 'path') {
    const points = shape.d.map((point) => addPosition(shape.position, point))
    return boundsFromPoints(points)
  }

  const fallbackPosition = (shape as Shape).position
  return createBounds(
    fallbackPosition.x,
    fallbackPosition.y,
    fallbackPosition.x,
    fallbackPosition.y,
  )
}

export const expandBounds = (
  bounds: ShapeBounds,
  padding: number,
): ShapeBounds => ({
  minX: bounds.minX - padding,
  minY: bounds.minY - padding,
  maxX: bounds.maxX + padding,
  maxY: bounds.maxY + padding,
})

export const boundsContainPoint = (bounds: ShapeBounds, point: Vec2): boolean =>
  point.x >= bounds.minX &&
  point.x <= bounds.maxX &&
  point.y >= bounds.minY &&
  point.y <= bounds.maxY

export const boundsContainBounds = (
  outer: ShapeBounds,
  inner: ShapeBounds,
): boolean =>
  outer.minX <= inner.maxX &&
  outer.maxX >= inner.minX &&
  outer.minY <= inner.maxY &&
  outer.maxY >= inner.minY

export const createBoundsFromPoints = (start: Vec2, end: Vec2): ShapeBounds =>
  createBounds(
    Math.min(start.x, end.x),
    Math.min(start.y, end.y),
    Math.max(start.x, end.x),
    Math.max(start.y, end.y),
  )
