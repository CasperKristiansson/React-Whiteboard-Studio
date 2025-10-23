import type { Shape, Vec2 } from '../types'
import type { ShapeBounds } from './geometry'
import { getShapeBounds } from './geometry'

type Axis = 'x' | 'y'

const centerOf = (min: number, max: number) => (min + max) / 2

const toWorldTolerance = (tolerance: number, viewportScale: number) =>
  tolerance / Math.max(viewportScale, 0.0001)

type SnapCalculationOptions = {
  enabled: boolean
  gridSize: number
  tolerance: number
  viewportScale: number
  otherBounds: ShapeBounds[]
}

export type ScaleMovingEdges = {
  minX: boolean
  maxX: boolean
  minY: boolean
  maxY: boolean
}

export type RotationSnapOptions = SnapCalculationOptions & {
  angleStep?: number
  angleTolerance?: number
}

const collectCandidatesForAxis = (bounds: ShapeBounds[], axis: Axis): number[] => {
  const candidates: number[] = []
  bounds.forEach((bound) => {
    if (axis === 'x') {
      candidates.push(bound.minX, centerOf(bound.minX, bound.maxX), bound.maxX)
    } else {
      candidates.push(bound.minY, centerOf(bound.minY, bound.maxY), bound.maxY)
    }
  })
  return candidates
}

const applyAxisSnap = (
  positions: { min: number; center: number; max: number },
  candidates: number[],
  gridSize: number,
  tolerance: number,
) => {
  let bestDiff = 0
  let bestDistance = Number.POSITIVE_INFINITY

  const test = (target: number, value: number) => {
    const diff = target - value
    const distance = Math.abs(diff)
    if (distance <= tolerance && distance < bestDistance) {
      bestDiff = diff
      bestDistance = distance
    }
  }

  const maybeSnapToGrid = (value: number) => {
    const snapped = Math.round(value / gridSize) * gridSize
    test(snapped, value)
  }

  maybeSnapToGrid(positions.min)
  maybeSnapToGrid(positions.center)
  maybeSnapToGrid(positions.max)

  candidates.forEach((candidate) => {
    test(candidate, positions.min)
    test(candidate, positions.center)
    test(candidate, positions.max)
  })

  return bestDistance === Number.POSITIVE_INFINITY ? 0 : bestDiff
}

const snapEdge = (
  value: number,
  candidates: number[],
  gridSize: number,
  tolerance: number,
) => {
  let bestDiff = 0
  let bestDistance = Number.POSITIVE_INFINITY

  const test = (target: number) => {
    const diff = target - value
    const distance = Math.abs(diff)
    if (distance <= tolerance && distance < bestDistance) {
      bestDiff = diff
      bestDistance = distance
    }
  }

  const snapped = Math.round(value / gridSize) * gridSize
  test(snapped)
  candidates.forEach(test)

  return bestDistance === Number.POSITIVE_INFINITY ? 0 : bestDiff
}

export const calculateTranslationSnap = (
  selectionBounds: ShapeBounds,
  delta: Vec2,
  options: SnapCalculationOptions,
): Vec2 => {
  if (!options.enabled) {
    return delta
  }

  const tolerance = toWorldTolerance(options.tolerance, options.viewportScale)
  const candidatesX = collectCandidatesForAxis(options.otherBounds, 'x')
  const candidatesY = collectCandidatesForAxis(options.otherBounds, 'y')

  const translatedX = {
    min: selectionBounds.minX + delta.x,
    max: selectionBounds.maxX + delta.x,
    center: centerOf(selectionBounds.minX + delta.x, selectionBounds.maxX + delta.x),
  }
  const translatedY = {
    min: selectionBounds.minY + delta.y,
    max: selectionBounds.maxY + delta.y,
    center: centerOf(selectionBounds.minY + delta.y, selectionBounds.maxY + delta.y),
  }

  const snapX = applyAxisSnap(translatedX, candidatesX, options.gridSize, tolerance)
  const snapY = applyAxisSnap(translatedY, candidatesY, options.gridSize, tolerance)

  return {
    x: delta.x + snapX,
    y: delta.y + snapY,
  }
}

export const calculateScaleSnap = (
  newBounds: ShapeBounds,
  moving: ScaleMovingEdges,
  options: SnapCalculationOptions,
  minSize = 1,
): ShapeBounds => {
  if (!options.enabled) {
    return newBounds
  }

  const tolerance = toWorldTolerance(options.tolerance, options.viewportScale)
  const candidatesX = collectCandidatesForAxis(options.otherBounds, 'x')
  const candidatesY = collectCandidatesForAxis(options.otherBounds, 'y')

  const result = { ...newBounds }

  if (moving.minX) {
    const diff = snapEdge(result.minX, candidatesX, options.gridSize, tolerance)
    if (diff !== 0) {
      result.minX += diff
    }
  }

  if (moving.maxX) {
    const diff = snapEdge(result.maxX, candidatesX, options.gridSize, tolerance)
    if (diff !== 0) {
      result.maxX += diff
    }
  }

  if (moving.minY) {
    const diff = snapEdge(result.minY, candidatesY, options.gridSize, tolerance)
    if (diff !== 0) {
      result.minY += diff
    }
  }

  if (moving.maxY) {
    const diff = snapEdge(result.maxY, candidatesY, options.gridSize, tolerance)
    if (diff !== 0) {
      result.maxY += diff
    }
  }

  if (result.maxX - result.minX < minSize) {
    if (moving.minX) {
      result.minX = result.maxX - minSize
    } else {
      result.maxX = result.minX + minSize
    }
  }

  if (result.maxY - result.minY < minSize) {
    if (moving.minY) {
      result.minY = result.maxY - minSize
    } else {
      result.maxY = result.minY + minSize
    }
  }

  return result
}

export const calculateRotationSnap = (
  angle: number,
  options: RotationSnapOptions,
): number => {
  if (!options.enabled) {
    return angle
  }

  const step = options.angleStep ?? Math.PI / 12
  const tolerance = options.angleTolerance ?? step / 2
  const snapped = Math.round(angle / step) * step
  return Math.abs(snapped - angle) <= tolerance ? snapped : angle
}

export const buildSnapOptions = ({
  enabled,
  gridSize,
  tolerance,
  viewportScale,
  shapes,
  selectionIds,
}: {
  enabled: boolean
  gridSize: number
  tolerance: number
  viewportScale: number
  shapes: Shape[]
  selectionIds: string[]
}): SnapCalculationOptions => {
  if (!enabled) {
    return {
      enabled: false,
      gridSize,
      tolerance,
      viewportScale,
      otherBounds: [],
    }
  }

  const selected = new Set(selectionIds)
  const otherBounds = shapes
    .filter((shape) => !selected.has(shape.id))
    .map((shape) => getShapeBounds(shape))

  return {
    enabled,
    gridSize,
    tolerance,
    viewportScale,
    otherBounds,
  }
}

export type { SnapCalculationOptions }
