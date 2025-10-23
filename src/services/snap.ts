import type { Shape, Vec2 } from '../types'
import type { ShapeBounds } from './geometry'
import { getShapeBounds } from './geometry'

export type SnapGuideLine = {
  kind: 'line'
  axis: 'x' | 'y'
  position: number
  start: number
  end: number
  label?: string
}

export type SnapGuideAngle = {
  kind: 'angle'
  center: Vec2
  angle: number
  label: string
}

export type SnapGuide = SnapGuideLine | SnapGuideAngle

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

const collectCandidatesForAxis = (
  bounds: ShapeBounds[],
  axis: Axis,
): number[] => {
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

type AxisSnapCandidate = {
  diff: number
  target: number
  focus: 'min' | 'center' | 'max'
  source: 'grid' | 'shape'
  distance: number
}

const applyAxisSnap = (
  positions: { min: number; center: number; max: number },
  candidates: number[],
  gridSize: number,
  tolerance: number,
): AxisSnapCandidate | null => {
  let best: AxisSnapCandidate | null = null

  const consider = (
    target: number,
    focus: 'min' | 'center' | 'max',
    source: 'grid' | 'shape',
  ) => {
    const value = positions[focus]
    const diff = target - value
    const distance = Math.abs(diff)
    if (distance > tolerance) return
    if (!best || distance < best.distance) {
      best = { diff, target, focus, source, distance }
    }
  }

  const snapValue = (focus: 'min' | 'center' | 'max') => {
    const value = positions[focus]
    const snapped = Math.round(value / gridSize) * gridSize
    consider(snapped, focus, 'grid')
  }

  snapValue('min')
  snapValue('center')
  snapValue('max')

  candidates.forEach((candidate) => {
    consider(candidate, 'min', 'shape')
    consider(candidate, 'center', 'shape')
    consider(candidate, 'max', 'shape')
  })

  return best
}

const snapEdge = (
  value: number,
  candidates: number[],
  gridSize: number,
  tolerance: number,
): {
  diff: number
  target: number
  source: 'grid' | 'shape'
  distance: number
} | null => {
  let best: {
    diff: number
    target: number
    source: 'grid' | 'shape'
    distance: number
  } | null = null

  const consider = (target: number, source: 'grid' | 'shape') => {
    const diff = target - value
    const distance = Math.abs(diff)
    if (distance > tolerance) return
    if (!best || distance < best.distance) {
      best = { diff, target, source, distance }
    }
  }

  const snapped = Math.round(value / gridSize) * gridSize
  consider(snapped, 'grid')
  candidates.forEach((candidate) => consider(candidate, 'shape'))

  return best
}

export const calculateTranslationSnap = (
  selectionBounds: ShapeBounds,
  delta: Vec2,
  options: SnapCalculationOptions,
): { delta: Vec2; guides: SnapGuide[] } => {
  if (!options.enabled) {
    return { delta, guides: [] }
  }

  const tolerance = toWorldTolerance(options.tolerance, options.viewportScale)
  const candidatesX = collectCandidatesForAxis(options.otherBounds, 'x')
  const candidatesY = collectCandidatesForAxis(options.otherBounds, 'y')

  const translatedX = {
    min: selectionBounds.minX + delta.x,
    max: selectionBounds.maxX + delta.x,
    center: centerOf(
      selectionBounds.minX + delta.x,
      selectionBounds.maxX + delta.x,
    ),
  }
  const translatedY = {
    min: selectionBounds.minY + delta.y,
    max: selectionBounds.maxY + delta.y,
    center: centerOf(
      selectionBounds.minY + delta.y,
      selectionBounds.maxY + delta.y,
    ),
  }

  const snapX = applyAxisSnap(
    translatedX,
    candidatesX,
    options.gridSize,
    tolerance,
  )
  const snapY = applyAxisSnap(
    translatedY,
    candidatesY,
    options.gridSize,
    tolerance,
  )

  const resolvedDelta: Vec2 = {
    x: delta.x + (snapX ? snapX.diff : 0),
    y: delta.y + (snapY ? snapY.diff : 0),
  }

  const guides: SnapGuide[] = []
  const snappedBounds = {
    minX: selectionBounds.minX + resolvedDelta.x,
    maxX: selectionBounds.maxX + resolvedDelta.x,
    minY: selectionBounds.minY + resolvedDelta.y,
    maxY: selectionBounds.maxY + resolvedDelta.y,
  }

  if (snapX && snapX.diff !== 0) {
    guides.push({
      kind: 'line',
      axis: 'x',
      position: snapX.target,
      start: snappedBounds.minY,
      end: snappedBounds.maxY,
      label: `${Math.round(Math.abs(snapX.diff) * options.viewportScale)}px`,
    })
  }

  if (snapY && snapY.diff !== 0) {
    guides.push({
      kind: 'line',
      axis: 'y',
      position: snapY.target,
      start: snappedBounds.minX,
      end: snappedBounds.maxX,
      label: `${Math.round(Math.abs(snapY.diff) * options.viewportScale)}px`,
    })
  }

  return { delta: resolvedDelta, guides }
}

export const calculateScaleSnap = (
  newBounds: ShapeBounds,
  moving: ScaleMovingEdges,
  options: SnapCalculationOptions,
  minSize = 1,
): { bounds: ShapeBounds; guides: SnapGuide[] } => {
  if (!options.enabled) {
    return { bounds: newBounds, guides: [] }
  }

  const tolerance = toWorldTolerance(options.tolerance, options.viewportScale)
  const candidatesX = collectCandidatesForAxis(options.otherBounds, 'x')
  const candidatesY = collectCandidatesForAxis(options.otherBounds, 'y')

  const result = { ...newBounds }
  const guides: SnapGuide[] = []

  const minXSnap =
    moving.minX &&
    snapEdge(result.minX, candidatesX, options.gridSize, tolerance)
  if (minXSnap) {
    result.minX += minXSnap.diff
    guides.push({
      kind: 'line',
      axis: 'x',
      position: result.minX,
      start: result.minY,
      end: result.maxY,
      label: `${Math.round(Math.abs(minXSnap.diff) * options.viewportScale)}px`,
    })
  }

  const maxXSnap =
    moving.maxX &&
    snapEdge(result.maxX, candidatesX, options.gridSize, tolerance)
  if (maxXSnap) {
    result.maxX += maxXSnap.diff
    guides.push({
      kind: 'line',
      axis: 'x',
      position: result.maxX,
      start: result.minY,
      end: result.maxY,
      label: `${Math.round(Math.abs(maxXSnap.diff) * options.viewportScale)}px`,
    })
  }

  const minYSnap =
    moving.minY &&
    snapEdge(result.minY, candidatesY, options.gridSize, tolerance)
  if (minYSnap) {
    result.minY += minYSnap.diff
    guides.push({
      kind: 'line',
      axis: 'y',
      position: result.minY,
      start: result.minX,
      end: result.maxX,
      label: `${Math.round(Math.abs(minYSnap.diff) * options.viewportScale)}px`,
    })
  }

  const maxYSnap =
    moving.maxY &&
    snapEdge(result.maxY, candidatesY, options.gridSize, tolerance)
  if (maxYSnap) {
    result.maxY += maxYSnap.diff
    guides.push({
      kind: 'line',
      axis: 'y',
      position: result.maxY,
      start: result.minX,
      end: result.maxX,
      label: `${Math.round(Math.abs(maxYSnap.diff) * options.viewportScale)}px`,
    })
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

  return { bounds: result, guides }
}

export const calculateRotationSnap = (
  angle: number,
  options: RotationSnapOptions,
): { angle: number; snapped: boolean; diff: number } => {
  if (!options.enabled) {
    return { angle, snapped: false, diff: 0 }
  }

  const step = options.angleStep ?? Math.PI / 12
  const tolerance = options.angleTolerance ?? step / 2
  const snapped = Math.round(angle / step) * step
  if (Math.abs(snapped - angle) <= tolerance) {
    return { angle: snapped, snapped: true, diff: snapped - angle }
  }
  return { angle, snapped: false, diff: 0 }
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
