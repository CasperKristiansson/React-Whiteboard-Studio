import { useCallback, useMemo, type ChangeEvent } from 'react'

import {
  selectSelection,
  selectShapes,
  useAppSelector,
  useAppStore,
} from '../state/store'
import type {
  EllipseShape,
  ImageShape,
  RectShape,
  RGBA,
  Shape,
  TextShape,
} from '../types'
import {
  DEFAULT_TEXT_SHADOW,
  updateTextShapeBounds,
} from '../utils/text-measure'

const toHex = (value: number) => {
  const clamped = Math.min(255, Math.max(0, Math.round(value)))
  return clamped.toString(16).padStart(2, '0')
}

const rgbaToHex = (color: RGBA | undefined): string => {
  if (!color) return '#000000'
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

const hexToRgba = (hex: string, fallback: RGBA): RGBA => {
  let value = hex.trim().replace(/^#/, '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('')
  }

  if (value.length !== 6) {
    return { ...fallback }
  }

  const parsed = Number.parseInt(value, 16)
  if (Number.isNaN(parsed)) {
    return { ...fallback }
  }

  return {
    r: (parsed >> 16) & 0xff,
    g: (parsed >> 8) & 0xff,
    b: parsed & 0xff,
    a: fallback.a,
  }
}

const getSharedValue = <S extends Shape, T>(
  shapes: S[],
  accessor: (shape: S) => T | null | undefined,
): T | null => {
  if (!shapes.length) return null

  let shared: T | undefined
  for (let index = 0; index < shapes.length; index += 1) {
    const value = accessor(shapes[index])
    if (value === null || value === undefined) {
      return null
    }

    if (index === 0) {
      shared = value
    } else if (shared !== value) {
      return null
    }
  }

  return shared ?? null
}

const supportsFill = (
  shape: Shape,
): shape is RectShape | EllipseShape | TextShape | ImageShape => {
  return (
    shape.type === 'rect' ||
    shape.type === 'ellipse' ||
    shape.type === 'text' ||
    shape.type === 'image'
  )
}

const isTextShape = (shape: Shape): shape is TextShape => shape.type === 'text'

const formatMixedLabel = (label: string, mixed: boolean) =>
  mixed ? `${label} (mixed)` : label

const strokeLabel = 'Stroke'
const fillLabel = 'Fill'

const ContextPanel = () => {
  const shapes = useAppSelector(selectShapes)
  const selectionIds = useAppSelector(selectSelection)
  const updateShape = useAppStore((state) => state.updateShape)
  const commit = useAppStore((state) => state.commit)

  const selectedShapes = useMemo(
    () => shapes.filter((shape) => selectionIds.includes(shape.id)),
    [shapes, selectionIds],
  )

  const hasSelection = selectedShapes.length > 0
  const allSupportFill =
    hasSelection && selectedShapes.every((shape) => supportsFill(shape))
  const anySupportsFill =
    hasSelection && selectedShapes.some((shape) => supportsFill(shape))
  const strokeMixed =
    getSharedValue(selectedShapes, (shape) =>
      shape.stroke ? rgbaToHex(shape.stroke) : null,
    ) === null

  const sharedStroke = useMemo(() => {
    const value = getSharedValue(selectedShapes, (shape) => shape.stroke)
    return value ? rgbaToHex(value) : '#000000'
  }, [selectedShapes])

  const fillMixed = allSupportFill
    ? getSharedValue(selectedShapes, (shape) =>
        supportsFill(shape) ? rgbaToHex(shape.fill ?? undefined) : null,
      ) === null
    : false

  const sharedFill = useMemo(() => {
    if (!allSupportFill) return '#ffffff'
    const value = getSharedValue(selectedShapes, (shape) =>
      supportsFill(shape) ? (shape.fill ?? undefined) : null,
    )
    return value ? rgbaToHex(value) : '#ffffff'
  }, [selectedShapes, allSupportFill])

  const strokeWidthMixed =
    getSharedValue(selectedShapes, (shape) => shape.strokeWidth) === null
  const sharedStrokeWidth = useMemo(() => {
    const value = getSharedValue(selectedShapes, (shape) => shape.strokeWidth)
    return value ?? 2
  }, [selectedShapes])

  const textShapes = useMemo(
    () =>
      selectedShapes.filter((shape): shape is TextShape => isTextShape(shape)),
    [selectedShapes],
  )
  const allText = hasSelection && textShapes.length === selectedShapes.length

  const sharedFontFamily = useMemo(() => {
    if (!allText) return ''
    return getSharedValue(textShapes, (shape) => shape.font.family) ?? ''
  }, [textShapes, allText])

  const sharedFontSize = useMemo(() => {
    if (!allText) return ''
    const value = getSharedValue(textShapes, (shape) => shape.font.size)
    return value ?? ''
  }, [textShapes, allText])

  const sharedFontWeight = useMemo(() => {
    if (!allText) return ''
    const value = getSharedValue(textShapes, (shape) => shape.font.weight)
    return value ?? ''
  }, [textShapes, allText])

  const sharedAlign = useMemo(() => {
    if (!allText) return ''
    return getSharedValue(textShapes, (shape) => shape.align ?? 'left') ?? ''
  }, [textShapes, allText])

  const sharedLetterSpacing = useMemo(() => {
    if (!allText) return ''
    const value = getSharedValue(
      textShapes,
      (shape) => shape.letterSpacing ?? 0,
    )
    return value ?? ''
  }, [textShapes, allText])

  const sharedLineHeight = useMemo(() => {
    if (!allText) return ''
    const value = getSharedValue(textShapes, (shape) => shape.lineHeight ?? 1.2)
    return value ?? ''
  }, [textShapes, allText])

  const italicMixed =
    allText &&
    getSharedValue(textShapes, (shape) => shape.italic ?? false) === null
  const sharedItalic = useMemo(() => {
    if (!allText) return false
    const value = getSharedValue(textShapes, (shape) => shape.italic ?? false)
    return value ?? false
  }, [textShapes, allText])

  const underlineMixed =
    allText &&
    getSharedValue(textShapes, (shape) => shape.underline ?? false) === null
  const sharedUnderline = useMemo(() => {
    if (!allText) return false
    const value = getSharedValue(
      textShapes,
      (shape) => shape.underline ?? false,
    )
    return value ?? false
  }, [textShapes, allText])

  const shadowsEqual = useCallback(
    (a: TextShape['shadow'] | null, b: TextShape['shadow'] | null) => {
      if (a === b) return true
      if (!a || !b) return false
      return (
        a.offset.x === b.offset.x &&
        a.offset.y === b.offset.y &&
        a.blur === b.blur &&
        a.color.r === b.color.r &&
        a.color.g === b.color.g &&
        a.color.b === b.color.b &&
        a.color.a === b.color.a
      )
    },
    [],
  )

  const shadowState = useMemo(() => {
    if (!allText || !textShapes.length) {
      return { shadow: null as TextShape['shadow'] | null, mixed: false }
    }
    const firstShadow = textShapes[0].shadow ?? null
    for (let index = 1; index < textShapes.length; index += 1) {
      const current = textShapes[index].shadow ?? null
      if (!shadowsEqual(firstShadow, current)) {
        return { shadow: null, mixed: true }
      }
    }
    return { shadow: firstShadow, mixed: false }
  }, [allText, shadowsEqual, textShapes])

  const shadowEnabled = shadowState.shadow !== null
  const shadowMixed = shadowState.mixed
  const shadowColorHex = shadowState.shadow
    ? rgbaToHex(shadowState.shadow.color)
    : rgbaToHex(DEFAULT_TEXT_SHADOW.color)
  const shadowOpacityValue = shadowState.shadow
    ? shadowState.shadow.color.a
    : DEFAULT_TEXT_SHADOW.color.a
  const shadowOffsetXValue = shadowState.shadow
    ? shadowState.shadow.offset.x
    : DEFAULT_TEXT_SHADOW.offset.x
  const shadowOffsetYValue = shadowState.shadow
    ? shadowState.shadow.offset.y
    : DEFAULT_TEXT_SHADOW.offset.y
  const shadowBlurValue = shadowState.shadow
    ? shadowState.shadow.blur
    : DEFAULT_TEXT_SHADOW.blur

  const applyChange = useCallback(
    (label: string, updater: (shape: Shape) => void) => {
      selectionIds.forEach((id) => {
        updateShape(id, (shape) => {
          updater(shape)
        })
      })
      commit(label, { squash: true })
    },
    [selectionIds, updateShape, commit],
  )

  const handleStrokeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextColor = hexToRgba(event.target.value, {
        r: 0,
        g: 0,
        b: 0,
        a: 1,
      })
      applyChange('Change stroke', (shape) => {
        shape.stroke = { ...nextColor }
      })
    },
    [applyChange],
  )

  const handleStrokeWidthChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      const next = Math.max(0.5, Math.min(64, value))
      applyChange('Change stroke width', (shape) => {
        shape.strokeWidth = next
      })
    },
    [applyChange],
  )

  const handleFillChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextColor = hexToRgba(event.target.value, {
        r: 255,
        g: 255,
        b: 255,
        a: 1,
      })
      applyChange('Change fill', (shape) => {
        if (supportsFill(shape)) {
          shape.fill = { ...nextColor }
        }
      })
    },
    [applyChange],
  )

  const handleFontFamilyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      applyChange('Change font family', (shape) => {
        if (isTextShape(shape)) {
          shape.font.family = value || shape.font.family
          updateTextShapeBounds(shape)
        }
      })
    },
    [applyChange],
  )

  const handleFontSizeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      const next = Math.max(4, Math.min(512, value))
      applyChange('Change font size', (shape) => {
        if (isTextShape(shape)) {
          shape.font.size = next
          updateTextShapeBounds(shape)
        }
      })
    },
    [applyChange],
  )

  const handleFontWeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(event.target.value, 10)
      if (Number.isNaN(value)) return
      const next = Math.max(100, Math.min(900, value))
      applyChange('Change font weight', (shape) => {
        if (isTextShape(shape)) {
          shape.font.weight = next
          updateTextShapeBounds(shape)
        }
      })
    },
    [applyChange],
  )

  const handleAlignChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as TextShape['align']
      applyChange('Change text alignment', (shape) => {
        if (isTextShape(shape)) {
          shape.align = value
        }
      })
    },
    [applyChange],
  )

  const handleLetterSpacingChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      applyChange('Change letter spacing', (shape) => {
        if (isTextShape(shape)) {
          shape.letterSpacing = value
          updateTextShapeBounds(shape)
        }
      })
    },
    [applyChange],
  )

  const handleLineHeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      const next = Math.max(0.5, Math.min(5, value))
      applyChange('Change line height', (shape) => {
        if (isTextShape(shape)) {
          shape.lineHeight = next
          updateTextShapeBounds(shape)
        }
      })
    },
    [applyChange],
  )

  const handleItalicToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      applyChange('Toggle italic', (shape) => {
        if (isTextShape(shape)) {
          shape.italic = checked
          updateTextShapeBounds(shape)
        }
      })
    },
    [applyChange],
  )

  const handleUnderlineToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      applyChange('Toggle underline', (shape) => {
        if (isTextShape(shape)) {
          shape.underline = checked
        }
      })
    },
    [applyChange],
  )

  const handleShadowToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const enabled = event.target.checked
      applyChange(
        enabled ? 'Enable text shadow' : 'Disable text shadow',
        (shape) => {
          if (!isTextShape(shape)) return
          if (enabled) {
            const existing = shape.shadow ?? {
              offset: { ...DEFAULT_TEXT_SHADOW.offset },
              blur: DEFAULT_TEXT_SHADOW.blur,
              color: { ...DEFAULT_TEXT_SHADOW.color },
            }
            shape.shadow = {
              offset: { ...existing.offset },
              blur: existing.blur,
              color: { ...existing.color },
            }
          } else {
            shape.shadow = undefined
          }
        },
      )
    },
    [applyChange],
  )

  const handleShadowColorChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = hexToRgba(event.target.value, DEFAULT_TEXT_SHADOW.color)
      applyChange('Change text shadow color', (shape) => {
        if (!isTextShape(shape)) return
        const shadow = shape.shadow ?? {
          offset: { ...DEFAULT_TEXT_SHADOW.offset },
          blur: DEFAULT_TEXT_SHADOW.blur,
          color: { ...DEFAULT_TEXT_SHADOW.color },
        }
        shape.shadow = {
          offset: { ...shadow.offset },
          blur: shadow.blur,
          color: { ...shadow.color, r: next.r, g: next.g, b: next.b },
        }
      })
    },
    [applyChange],
  )

  const handleShadowOpacityChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      const next = Math.min(1, Math.max(0, value))
      applyChange('Change text shadow opacity', (shape) => {
        if (!isTextShape(shape) || !shape.shadow) return
        shape.shadow = {
          ...shape.shadow,
          color: { ...shape.shadow.color, a: next },
        }
      })
    },
    [applyChange],
  )

  const handleShadowOffsetChange = useCallback(
    (axis: 'x' | 'y') => (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      applyChange('Change text shadow offset', (shape) => {
        if (!isTextShape(shape) || !shape.shadow) return
        shape.shadow = {
          ...shape.shadow,
          offset: {
            ...shape.shadow.offset,
            [axis]: value,
          },
        }
      })
    },
    [applyChange],
  )

  const handleShadowBlurChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      const next = Math.max(0, value)
      applyChange('Change text shadow blur', (shape) => {
        if (!isTextShape(shape) || !shape.shadow) return
        shape.shadow = {
          ...shape.shadow,
          blur: next,
        }
      })
    },
    [applyChange],
  )

  const selectionSummary = useMemo(() => {
    if (!hasSelection) return 'No selection'
    const counts = new Map<Shape['type'], number>()
    selectedShapes.forEach((shape) => {
      counts.set(shape.type, (counts.get(shape.type) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([type, count]) => `${count}× ${type}`)
      .join(', ')
  }, [selectedShapes, hasSelection])

  return (
    <aside className="flex h-full min-h-80 flex-col gap-4 rounded-3xl border border-(--color-elevated-border) bg-(--color-elevated-bg) p-5 text-sm text-(--color-elevated-foreground) shadow-lg backdrop-blur">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-(--color-app-foreground)">
          Properties
        </h2>
        <p className="text-xs text-(--color-muted-foreground)">
          {selectionSummary}
        </p>
      </header>

      {!hasSelection ? (
        <p className="text-xs text-(--color-muted-foreground)">
          Select one or more shapes to edit their appearance.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-wide text-(--color-muted-foreground)">
              Appearance
            </h3>

            <label className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                {formatMixedLabel(strokeLabel, strokeMixed)}
              </span>
              <input
                aria-label="Stroke color"
                className="h-8 w-12 cursor-pointer rounded border border-(--color-elevated-border) bg-transparent"
                type="color"
                value={sharedStroke}
                onChange={handleStrokeChange}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                {formatMixedLabel('Stroke width', strokeWidthMixed)}
              </span>
              <input
                aria-label="Stroke width"
                className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                type="number"
                min="0.5"
                max="64"
                step="0.5"
                value={strokeWidthMixed ? '' : sharedStrokeWidth}
                placeholder={strokeWidthMixed ? 'Mixed' : undefined}
                onChange={handleStrokeWidthChange}
              />
            </label>

            {anySupportsFill ? (
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-(--color-muted-foreground)">
                  {formatMixedLabel(fillLabel, fillMixed)}
                  {!allSupportFill ? (
                    <span className="ml-2 text-[10px] tracking-wide text-(--color-muted-foreground) uppercase">
                      limited
                    </span>
                  ) : null}
                </span>
                <input
                  aria-label="Fill color"
                  className="h-8 w-12 cursor-pointer rounded border border-(--color-elevated-border) bg-transparent"
                  type="color"
                  value={sharedFill}
                  onChange={handleFillChange}
                  disabled={!allSupportFill}
                />
              </label>
            ) : null}
          </section>

          {allText ? (
            <section className="flex flex-col gap-3 border-t border-(--color-elevated-border)/60 pt-4">
              <h3 className="text-xs font-semibold tracking-wide text-(--color-muted-foreground)">
                Text
              </h3>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-(--color-muted-foreground)">
                  Font family
                </span>
                <input
                  aria-label="Font family"
                  className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                  type="text"
                  value={sharedFontFamily}
                  placeholder={sharedFontFamily ? undefined : 'Mixed'}
                  onChange={handleFontFamilyChange}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-(--color-muted-foreground)">
                    Font size
                  </span>
                  <input
                    aria-label="Font size"
                    className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                    type="number"
                    min="4"
                    max="512"
                    step="1"
                    value={sharedFontSize}
                    placeholder={sharedFontSize ? undefined : 'Mixed'}
                    onChange={handleFontSizeChange}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-(--color-muted-foreground)">
                    Font weight
                  </span>
                  <input
                    aria-label="Font weight"
                    className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                    type="number"
                    min="100"
                    max="900"
                    step="100"
                    value={sharedFontWeight}
                    placeholder={sharedFontWeight ? undefined : 'Mixed'}
                    onChange={handleFontWeightChange}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-(--color-muted-foreground)">
                  Align
                </span>
                <select
                  aria-label="Text alignment"
                  className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                  value={sharedAlign || 'left'}
                  onChange={handleAlignChange}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-(--color-muted-foreground)">
                    Letter spacing
                  </span>
                  <input
                    aria-label="Letter spacing"
                    className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                    type="number"
                    step="0.1"
                    value={sharedLetterSpacing}
                    placeholder={sharedLetterSpacing ? undefined : 'Mixed'}
                    onChange={handleLetterSpacingChange}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-(--color-muted-foreground)">
                    Line height
                  </span>
                  <input
                    aria-label="Line height"
                    className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                    type="number"
                    step="0.1"
                    value={sharedLineHeight}
                    placeholder={sharedLineHeight ? undefined : 'Mixed'}
                    onChange={handleLineHeightChange}
                  />
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    aria-label="Italic"
                    type="checkbox"
                    checked={sharedItalic}
                    onChange={handleItalicToggle}
                  />
                  <span className="text-xs font-medium text-(--color-muted-foreground)">
                    {formatMixedLabel('Italic', italicMixed)}
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    aria-label="Underline"
                    type="checkbox"
                    checked={sharedUnderline}
                    onChange={handleUnderlineToggle}
                  />
                  <span className="text-xs font-medium text-(--color-muted-foreground)">
                    {formatMixedLabel('Underline', underlineMixed)}
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-3 border-t border-(--color-elevated-border)/60 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide text-(--color-muted-foreground)">
                    {shadowMixed ? 'Shadow (mixed)' : 'Shadow'}
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      aria-label="Toggle text shadow"
                      type="checkbox"
                      checked={shadowEnabled}
                      onChange={handleShadowToggle}
                    />
                    <span className="text-xs text-(--color-muted-foreground)">
                      Enabled
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-(--color-muted-foreground)">
                      Color
                    </span>
                    <input
                      aria-label="Shadow color"
                      className="h-8 w-full cursor-pointer rounded border border-(--color-elevated-border) bg-transparent"
                      type="color"
                      value={shadowColorHex}
                      onChange={handleShadowColorChange}
                      disabled={!shadowEnabled || shadowMixed}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-(--color-muted-foreground)">
                      Opacity
                    </span>
                    <input
                      aria-label="Shadow opacity"
                      className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={
                        shadowEnabled && !shadowMixed
                          ? shadowOpacityValue.toFixed(2)
                          : ''
                      }
                      placeholder={shadowMixed ? 'Mixed' : undefined}
                      onChange={handleShadowOpacityChange}
                      disabled={!shadowEnabled}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-(--color-muted-foreground)">
                      Offset X
                    </span>
                    <input
                      aria-label="Shadow offset X"
                      className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                      type="number"
                      step="1"
                      value={
                        shadowEnabled && !shadowMixed ? shadowOffsetXValue : ''
                      }
                      placeholder={shadowMixed ? 'Mixed' : undefined}
                      onChange={handleShadowOffsetChange('x')}
                      disabled={!shadowEnabled}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-(--color-muted-foreground)">
                      Offset Y
                    </span>
                    <input
                      aria-label="Shadow offset Y"
                      className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                      type="number"
                      step="1"
                      value={
                        shadowEnabled && !shadowMixed ? shadowOffsetYValue : ''
                      }
                      placeholder={shadowMixed ? 'Mixed' : undefined}
                      onChange={handleShadowOffsetChange('y')}
                      disabled={!shadowEnabled}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-(--color-muted-foreground)">
                      Blur
                    </span>
                    <input
                      aria-label="Shadow blur"
                      className="w-full rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                      type="number"
                      min="0"
                      step="1"
                      value={
                        shadowEnabled && !shadowMixed ? shadowBlurValue : ''
                      }
                      placeholder={shadowMixed ? 'Mixed' : undefined}
                      onChange={handleShadowBlurChange}
                      disabled={!shadowEnabled}
                    />
                  </label>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </aside>
  )
}

export default ContextPanel
