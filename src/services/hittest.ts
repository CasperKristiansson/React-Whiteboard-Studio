import type { Shape, Vec2 } from '../types'
import {
  boundsContainBounds,
  boundsContainPoint,
  createBoundsFromPoints,
  getShapeBounds,
  type ShapeBounds,
} from './geometry'

const toWorldPoints = (origin: Vec2, points: Vec2[]): Vec2[] =>
  points.map((point) => ({
    x: origin.x + point.x,
    y: origin.y + point.y,
  }))

const distancePointToSegment = (point: Vec2, a: Vec2, b: Vec2): number => {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = point.x - a.x
  const apy = point.y - a.y
  const abLengthSquared = abx * abx + aby * aby
  if (abLengthSquared === 0) {
    return Math.hypot(apx, apy)
  }
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLengthSquared))
  const closestX = a.x + t * abx
  const closestY = a.y + t * aby
  return Math.hypot(point.x - closestX, point.y - closestY)
}

const pointInEllipse = (point: Vec2, center: Vec2, rx: number, ry: number): boolean => {
  const normalizedX = (point.x - center.x) / rx
  const normalizedY = (point.y - center.y) / ry
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1
}

const pointInPolygon = (point: Vec2, vertices: Vec2[]): boolean => {
  let inside = false
  const { length } = vertices
  for (let i = 0, j = length - 1; i < length; j = i += 1) {
    const xi = vertices[i].x
    const yi = vertices[i].y
    const xj = vertices[j].x
    const yj = vertices[j].y

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

const pointInShape = (shape: Shape, point: Vec2): boolean => {
  switch (shape.type) {
    case 'rect':
    case 'text':
    case 'image':
      return boundsContainPoint(getShapeBounds(shape), point)
    case 'ellipse':
      return pointInEllipse(point, shape.position, shape.rx, shape.ry)
    case 'line':
    case 'arrow': {
      const worldPoints = toWorldPoints(shape.position, shape.points)
      const tolerance = Math.max(4, shape.strokeWidth)
      for (let i = 0; i < worldPoints.length - 1; i += 1) {
        if (distancePointToSegment(point, worldPoints[i], worldPoints[i + 1]) <= tolerance) {
          return true
        }
      }
      return false
    }
    case 'path': {
      const worldPoints = toWorldPoints(shape.position, shape.d)
      if (shape.closed) {
        return pointInPolygon(point, worldPoints)
      }
      const tolerance = Math.max(4, shape.strokeWidth ?? 4)
      for (let i = 0; i < worldPoints.length - 1; i += 1) {
        if (distancePointToSegment(point, worldPoints[i], worldPoints[i + 1]) <= tolerance) {
          return true
        }
      }
      return false
    }
    default:
      return false
  }
}

export const hitTestShapes = (shapes: Shape[], point: Vec2): Shape | null => {
  const sorted = [...shapes].sort((a, b) => b.zIndex - a.zIndex)
  for (let index = 0; index < sorted.length; index += 1) {
    const shape = sorted[index]
    if (pointInShape(shape, point)) {
      return shape
    }
  }
  return null
}

export const getShapesWithinBounds = (shapes: Shape[], bounds: ShapeBounds): Shape[] =>
  shapes.filter((shape) => boundsContainBounds(bounds, getShapeBounds(shape)))

export const createWorldMarquee = (start: Vec2, end: Vec2): ShapeBounds =>
  createBoundsFromPoints(start, end)
