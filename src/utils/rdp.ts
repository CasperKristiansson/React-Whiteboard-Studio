import type { Vec2 } from '../types'

const getPerpendicularDistance = (
  point: Vec2,
  lineStart: Vec2,
  lineEnd: Vec2,
): number => {
  const { x, y } = point
  const { x: x1, y: y1 } = lineStart
  const { x: x2, y: y2 } = lineEnd

  const dx = x2 - x1
  const dy = y2 - y1

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1)
  }

  const numerator = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1)
  const denominator = Math.sqrt(dx * dx + dy * dy)
  return numerator / denominator
}

export const ramerDouglasPeucker = (
  points: Vec2[],
  epsilon: number,
): Vec2[] => {
  if (points.length < 3) return points

  let maxDistance = 0
  let index = 0

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = getPerpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1],
    )
    if (distance > maxDistance) {
      index = i
      maxDistance = distance
    }
  }

  if (maxDistance > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), epsilon)
    const right = ramerDouglasPeucker(points.slice(index), epsilon)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}
