import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  selectSelection,
  selectShapes,
  useAppSelector,
  useAppStore,
} from '../state/store'
import type {
  ArrowShape,
  EllipseShape,
  ImageShape,
  RectShape,
  Shape,
  TextShape,
} from '../types'

const toHex = (value: number) => {
  const clamped = Math.min(255, Math.max(0, Math.round(value)))
  return clamped.toString(16).padStart(2, '0')
}

const rgbaToHex = (color?: { r: number; g: number; b: number }): string => {
  if (!color) return '#000000'
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

const hexToRgba = (
  hex: string,
  fallback: { r: number; g: number; b: number; a: number },
): { r: number; g: number; b: number; a: number } => {
  let value = hex.trim().replace(/^#/, '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('')
  }

  if (value.length !== 6) return { ...fallback }

  const parsed = Number.parseInt(value, 16)
  if (Number.isNaN(parsed)) return { ...fallback }

  return {
    r: (parsed >> 16) & 0xff,
    g: (parsed >> 8) & 0xff,
    b: parsed & 0xff,
    a: fallback.a,
  }
}

const SHAPE_LABEL: Record<Shape['type'], string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  path: 'Path',
  text: 'Text',
  image: 'Image',
}

const supportsFill = (
  shape: Shape,
): shape is RectShape | EllipseShape | TextShape | ImageShape =>
  shape.type === 'rect' ||
  shape.type === 'ellipse' ||
  shape.type === 'text' ||
  shape.type === 'image'

const supportsCornerRadius = (shape: Shape): shape is RectShape => {
  return shape.type === 'rect'
}

const ShapeInspector = () => {
  const selection = useAppSelector(selectSelection)
  const shapes = useAppSelector(selectShapes)
  const updateShape = useAppStore((state) => state.updateShape)
  const commit = useAppStore((state) => state.commit)
  const clearSelection = useAppStore((state) => state.clearSelection)
  const [strokeWidthInput, setStrokeWidthInput] = useState('')
  const [cornerRadiusInput, setCornerRadiusInput] = useState('')
  const [arrowHeadInput, setArrowHeadInput] = useState('')

  const selectedShape = useMemo(() => {
    if (selection.length !== 1) return null
    return shapes.find((shape) => shape.id === selection[0]) ?? null
  }, [selection, shapes])

  useEffect(() => {
    if (!selectedShape) {
      setStrokeWidthInput('')
      setCornerRadiusInput('')
      setArrowHeadInput('')
      return
    }

    setStrokeWidthInput(
      Number.isFinite(selectedShape.strokeWidth)
        ? String(selectedShape.strokeWidth)
        : '0',
    )

    if (supportsCornerRadius(selectedShape)) {
      setCornerRadiusInput(String(selectedShape.radius ?? 0))
    } else {
      setCornerRadiusInput('')
    }

    if (selectedShape.type === 'arrow') {
      setArrowHeadInput(String((selectedShape as ArrowShape).headSize))
    } else {
      setArrowHeadInput('')
    }
  }, [selectedShape])

  const handleFillChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedShape || !supportsFill(selectedShape)) return
      const value = event.target.value
      updateShape(selectedShape.id, (shape) => {
        if (!supportsFill(shape)) return
        shape.fill = hexToRgba(value, {
          r: 255,
          g: 255,
          b: 255,
          a: shape.fill?.a ?? 1,
        })
      })
      commit('Change fill')
    },
    [commit, selectedShape, updateShape],
  )

  const handleStrokeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedShape) return
      const value = event.target.value
      updateShape(selectedShape.id, (shape) => {
        shape.stroke = hexToRgba(value, {
          r: shape.stroke.r,
          g: shape.stroke.g,
          b: shape.stroke.b,
          a: shape.stroke.a,
        })
      })
      commit('Change stroke')
    },
    [commit, selectedShape, updateShape],
  )

  const handleStrokeWidthChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedShape) return
      const value = event.target.value
      setStrokeWidthInput(value)
      if (value.trim() === '') return
      const parsed = Number.parseFloat(value)
      if (Number.isNaN(parsed)) return
      updateShape(selectedShape.id, (shape) => {
        shape.strokeWidth = Math.max(0, parsed)
        shape.updatedAt = Date.now()
      })
    },
    [selectedShape, updateShape],
  )

  const handleCornerRadiusChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedShape || !supportsCornerRadius(selectedShape)) return
      const value = event.target.value
      setCornerRadiusInput(value)
      if (value.trim() === '') return
      const parsed = Number.parseFloat(value)
      if (Number.isNaN(parsed)) return
      updateShape(selectedShape.id, (shape) => {
        if (!supportsCornerRadius(shape)) return
        shape.radius = Math.max(0, parsed)
        shape.updatedAt = Date.now()
      })
    },
    [selectedShape, updateShape],
  )

  const handleToggleVisibility = useCallback(() => {
    if (!selectedShape) return
    updateShape(selectedShape.id, (shape) => {
      shape.hidden = !shape.hidden
    })
    commit('Toggle visibility')
    clearSelection()
  }, [clearSelection, commit, selectedShape, updateShape])

  if (!selectedShape) return null

  const fillHex = supportsFill(selectedShape)
    ? rgbaToHex(selectedShape.fill ?? undefined)
    : null
  const strokeHex = rgbaToHex(selectedShape.stroke)

  const showCornerRadius = supportsCornerRadius(selectedShape)
  const shapeLabel = SHAPE_LABEL[selectedShape.type] ?? 'Shape'

  return (
    <div className="pointer-events-none fixed right-4 top-1/2 z-[60] -translate-y-1/2">
      <div className="pointer-events-auto w-72 rounded-2xl border border-(--color-elevated-border)/70 bg-(--color-elevated-bg)/95 p-4 shadow-2xl backdrop-blur">
        <header className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-muted-foreground)">
            Inspector
          </p>
          <h2 className="text-base font-semibold text-(--color-app-foreground)">
            {shapeLabel}
          </h2>
        </header>

        <div className="grid gap-3 text-sm text-(--color-app-foreground)">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-(--color-muted-foreground)">
              Stroke
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={strokeHex}
                onChange={handleStrokeChange}
                className="h-9 w-9 cursor-pointer rounded border border-(--color-elevated-border) bg-transparent"
              />
              <input
                type="number"
                min={0}
                step={0.5}
                value={strokeWidthInput}
                onChange={handleStrokeWidthChange}
                className="flex-1 rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-sm"
              />
            </div>
          </label>

          {fillHex ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Fill
              </span>
              <input
                type="color"
                value={fillHex}
                onChange={handleFillChange}
                className="h-9 w-9 cursor-pointer rounded border border-(--color-elevated-border) bg-transparent"
              />
            </label>
          ) : null}

          {showCornerRadius ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Corner radius
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={cornerRadiusInput}
                onChange={handleCornerRadiusChange}
                className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-sm"
              />
            </label>
          ) : null}

          {selectedShape.type === 'arrow' ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Arrow head size
              </span>
              <input
                type="number"
                min={4}
                step={1}
                value={arrowHeadInput}
                onChange={(event) => {
                  const value = event.target.value
                  setArrowHeadInput(value)
                  if (value.trim() === '') return
                  const parsed = Number.parseFloat(value)
                  if (Number.isNaN(parsed)) return
                  updateShape(selectedShape.id, (shape) => {
                    if (shape.type !== 'arrow') return
                    shape.headSize = Math.max(4, parsed)
                    shape.updatedAt = Date.now()
                  })
                }}
                className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-sm"
              />
            </label>
          ) : null}

          <button
            type="button"
            className="mt-1 inline-flex items-center justify-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-2 text-sm font-medium text-(--color-button-text) transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
            onClick={handleToggleVisibility}
          >
            {selectedShape.hidden ? 'Show shape' : 'Hide shape'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShapeInspector
