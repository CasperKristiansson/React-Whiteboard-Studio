import { useAppStore } from '../../state/store'
import { getShapeBounds } from '../../services/geometry'
import type {
  Shape,
  ShapeBounds,
  Vec2,
  RectShape,
  EllipseShape,
  ImageShape,
  TextShape,
  LineShape,
  ArrowShape,
  PathShape,
} from '../../types'

const cloneShape = <T extends Shape>(shape: T): T =>
  'structuredClone' in globalThis ? structuredClone(shape) : JSON.parse(JSON.stringify(shape))

export type ShapeSnapshot = {
  id: string
  original: Shape
  bounds: ShapeBounds
}

export type TransformSnapshot = {
  selectionBounds: ShapeBounds
  shapes: ShapeSnapshot[]
}

const combineBounds = (boundsList: ShapeBounds[]): ShapeBounds => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  boundsList.forEach((bounds) => {
    if (bounds.minX < minX) minX = bounds.minX
    if (bounds.minY < minY) minY = bounds.minY
    if (bounds.maxX > maxX) maxX = bounds.maxX
    if (bounds.maxY > maxY) maxY = bounds.maxY
  })

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    minX = 0
    minY = 0
    maxX = 0
    maxY = 0
  }

  return { minX, minY, maxX, maxY }
}

export const createTransformSnapshot = (shapes: Shape[]): TransformSnapshot => {
  const shapeSnapshots = shapes.map((shape) => ({
    id: shape.id,
    original: cloneShape(shape),
    bounds: getShapeBounds(shape),
  }))

  const selectionBounds = combineBounds(shapeSnapshots.map((snapshot) => snapshot.bounds))

  return {
    selectionBounds,
    shapes: shapeSnapshots,
  }
}

export const restoreSnapshot = (snapshot: TransformSnapshot) => {
  const store = useAppStore.getState()
  snapshot.shapes.forEach(({ id, original }) => {
    const clone = cloneShape(original)
    store.updateShape(id, (shape) => {
      Object.assign(shape, clone)
    })
  })
}

export const applyTranslation = (snapshot: TransformSnapshot, delta: Vec2) => {
  const store = useAppStore.getState()
  snapshot.shapes.forEach(({ id, original }) => {
    const clone = cloneShape(original)
    clone.position = {
      x: clone.position.x + delta.x,
      y: clone.position.y + delta.y,
    }
    store.updateShape(id, (shape) => {
      Object.assign(shape, clone)
    })
  })
}

const transformCoordinate = (
  value: number,
  originalMin: number,
  originalSize: number,
  newMin: number,
  newSize: number,
) => newMin + ((value - originalMin) / originalSize) * newSize

const ensureSize = (size: number) => (Math.abs(size) < 1e-6 ? (size >= 0 ? 1e-6 : -1e-6) : size)

const scaleBoundsOfShape = (
  originalBounds: ShapeBounds,
  selectionBounds: ShapeBounds,
  newBounds: ShapeBounds,
) => {
  const originalWidth = ensureSize(selectionBounds.maxX - selectionBounds.minX)
  const originalHeight = ensureSize(selectionBounds.maxY - selectionBounds.minY)
  const newWidth = newBounds.maxX - newBounds.minX
  const newHeight = newBounds.maxY - newBounds.minY

  const minX = transformCoordinate(
    originalBounds.minX,
    selectionBounds.minX,
    originalWidth,
    newBounds.minX,
    newWidth,
  )
  const maxX = transformCoordinate(
    originalBounds.maxX,
    selectionBounds.minX,
    originalWidth,
    newBounds.minX,
    newWidth,
  )
  const minY = transformCoordinate(
    originalBounds.minY,
    selectionBounds.minY,
    originalHeight,
    newBounds.minY,
    newHeight,
  )
  const maxY = transformCoordinate(
    originalBounds.maxY,
    selectionBounds.minY,
    originalHeight,
    newBounds.minY,
    newHeight,
  )

  return { minX, minY, maxX, maxY }
}

const scaleWorldPoint = (
  point: Vec2,
  selectionBounds: ShapeBounds,
  newBounds: ShapeBounds,
): Vec2 => {
  const originalWidth = ensureSize(selectionBounds.maxX - selectionBounds.minX)
  const originalHeight = ensureSize(selectionBounds.maxY - selectionBounds.minY)
  const newWidth = newBounds.maxX - newBounds.minX
  const newHeight = newBounds.maxY - newBounds.minY

  return {
    x: transformCoordinate(point.x, selectionBounds.minX, originalWidth, newBounds.minX, newWidth),
    y: transformCoordinate(point.y, selectionBounds.minY, originalHeight, newBounds.minY, newHeight),
  }
}

export const applyScale = (snapshot: TransformSnapshot, newBounds: ShapeBounds) => {
  const store = useAppStore.getState()
  const { selectionBounds } = snapshot

  snapshot.shapes.forEach(({ id, original, bounds }) => {
    const clone = cloneShape(original)
    const scaledBounds = scaleBoundsOfShape(bounds, selectionBounds, newBounds)

    switch (clone.type) {
      case 'rect': {
        const rect = clone as RectShape
        rect.position = { x: scaledBounds.minX, y: scaledBounds.minY }
        rect.size = {
          x: Math.max(1, scaledBounds.maxX - scaledBounds.minX),
          y: Math.max(1, scaledBounds.maxY - scaledBounds.minY),
        }
        break
      }
      case 'image': {
        const image = clone as ImageShape
        image.position = { x: scaledBounds.minX, y: scaledBounds.minY }
        image.size = {
          x: Math.max(1, scaledBounds.maxX - scaledBounds.minX),
          y: Math.max(1, scaledBounds.maxY - scaledBounds.minY),
        }
        break
      }
      case 'text': {
        const text = clone as TextShape
        text.position = { x: scaledBounds.minX, y: scaledBounds.minY }
        text.box = {
          x: Math.max(1, scaledBounds.maxX - scaledBounds.minX),
          y: Math.max(1, scaledBounds.maxY - scaledBounds.minY),
        }
        break
      }
      case 'ellipse': {
        const ellipse = clone as EllipseShape
        const newCenterX = (scaledBounds.minX + scaledBounds.maxX) / 2
        const newCenterY = (scaledBounds.minY + scaledBounds.maxY) / 2
        const originalWidth = bounds.maxX - bounds.minX || 1
        const originalHeight = bounds.maxY - bounds.minY || 1
        const newWidth = scaledBounds.maxX - scaledBounds.minX
        const newHeight = scaledBounds.maxY - scaledBounds.minY
        ellipse.position = { x: newCenterX, y: newCenterY }
        ellipse.rx = Math.max(1, (ellipse.rx * newWidth) / originalWidth)
        ellipse.ry = Math.max(1, (ellipse.ry * newHeight) / originalHeight)
        break
      }
      case 'line':
      case 'arrow': {
        const line = clone as LineShape | ArrowShape
        const originalWorldPoints = original.points.map((point) => ({
          x: original.position.x + point.x,
          y: original.position.y + point.y,
        }))
        const newWorldPoints = originalWorldPoints.map((point) =>
          scaleWorldPoint(point, selectionBounds, newBounds),
        )
        line.position = { ...newWorldPoints[0] }
        line.points = newWorldPoints.map((point) => ({
          x: point.x - line.position.x,
          y: point.y - line.position.y,
        }))
        if (line.type === 'arrow') {
          const widthScale = Math.abs((newBounds.maxX - newBounds.minX) / (selectionBounds.maxX - selectionBounds.minX || 1))
          const heightScale = Math.abs((newBounds.maxY - newBounds.minY) / (selectionBounds.maxY - selectionBounds.minY || 1))
          const uniform = Math.sqrt(widthScale * heightScale)
          line.headSize = Math.max(4, line.headSize * uniform)
        }
        break
      }
      case 'path': {
        const path = clone as PathShape
        const originalWorldPoints = original.d.map((point) => ({
          x: original.position.x + point.x,
          y: original.position.y + point.y,
        }))
        const newWorldPoints = originalWorldPoints.map((point) =>
          scaleWorldPoint(point, selectionBounds, newBounds),
        )
        path.position = { ...newWorldPoints[0] }
        path.d = newWorldPoints.map((point) => ({
          x: point.x - path.position.x,
          y: point.y - path.position.y,
        }))
        break
      }
      default: {
        clone.position = {
          x: clone.position.x,
          y: clone.position.y,
        }
      }
    }

    store.updateShape(id, (shape) => {
      Object.assign(shape, clone)
    })
  })
}

const rotatePoint = (point: Vec2, center: Vec2, angle: number): Vec2 => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export const applyRotation = (snapshot: TransformSnapshot, angle: number, center: Vec2) => {
  const store = useAppStore.getState()
  const deltaDegrees = (angle * 180) / Math.PI

  snapshot.shapes.forEach(({ id, original }) => {
    const clone = cloneShape(original)

    switch (clone.type) {
      case 'rect':
      case 'ellipse':
      case 'image':
      case 'text': {
        clone.rotation = ((original.rotation ?? 0) + deltaDegrees) % 360
        clone.position = { ...original.position }
        break
      }
      case 'line':
      case 'arrow': {
        const line = clone as LineShape | ArrowShape
        const originalWorldPoints = original.points.map((point) => ({
          x: original.position.x + point.x,
          y: original.position.y + point.y,
        }))
        const rotatedPoints = originalWorldPoints.map((point) => rotatePoint(point, center, angle))
        line.position = { ...rotatedPoints[0] }
        line.points = rotatedPoints.map((point) => ({
          x: point.x - line.position.x,
          y: point.y - line.position.y,
        }))
        break
      }
      case 'path': {
        const path = clone as PathShape
        const originalWorldPoints = original.d.map((point) => ({
          x: original.position.x + point.x,
          y: original.position.y + point.y,
        }))
        const rotatedPoints = originalWorldPoints.map((point) => rotatePoint(point, center, angle))
        path.position = { ...rotatedPoints[0] }
        path.d = rotatedPoints.map((point) => ({
          x: point.x - path.position.x,
          y: point.y - path.position.y,
        }))
        break
      }
      default:
        clone.position = { ...original.position }
    }

    store.updateShape(id, (shape) => {
      Object.assign(shape, clone)
    })
  })
}
