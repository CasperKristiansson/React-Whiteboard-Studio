import type { TextShape } from '../types'

type MeasureOptions = {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number | string
  letterSpacing: number
  lineHeight: number
  italic: boolean
}

type TextMetrics = {
  width: number
  height: number
  lines: number
}

const HORIZONTAL_PADDING = 16
const VERTICAL_PADDING = 12

const cache = new Map<string, TextMetrics>()

let canvas: HTMLCanvasElement | null = null
let context: CanvasRenderingContext2D | null = null

const getContext = () => {
  if (context) return context
  if (typeof document === 'undefined') return null

  canvas = document.createElement('canvas')
  context = canvas.getContext('2d')
  return context
}

const createCacheKey = (options: MeasureOptions) =>
  [
    options.text,
    options.fontFamily,
    options.fontSize,
    options.fontWeight,
    options.letterSpacing,
    options.lineHeight,
    options.italic ? 1 : 0,
  ].join('|')

const approximateMetrics = (options: MeasureOptions): TextMetrics => {
  const lines = options.text.split(/\r?\n/)
  const longestLineLength = lines.reduce(
    (length, line) => Math.max(length, line.length),
    0,
  )
  const width =
    longestLineLength * (options.fontSize * 0.6 + options.letterSpacing)
  const height =
    Math.max(1, lines.length) * options.fontSize * options.lineHeight
  return {
    width,
    height,
    lines: Math.max(1, lines.length),
  }
}

export const measureTextMetrics = (options: MeasureOptions): TextMetrics => {
  const key = createCacheKey(options)
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const ctx = getContext()
  if (!ctx) {
    const metrics = approximateMetrics(options)
    cache.set(key, metrics)
    return metrics
  }

  const lines = options.text.split(/\r?\n/)
  const fontDescriptor = `${options.italic ? 'italic ' : ''}${options.fontWeight} ${
    options.fontSize
  }px ${options.fontFamily}`
  ctx.font = fontDescriptor
  ctx.textBaseline = 'top'

  let maxWidth = 0
  const spacingAdjustment = (line: string) =>
    options.letterSpacing > 0
      ? Math.max(0, line.length - 1) * options.letterSpacing
      : 0

  lines.forEach((line) => {
    const measurement = ctx.measureText(line || ' ')
    const width = measurement.width + spacingAdjustment(line)
    if (width > maxWidth) {
      maxWidth = width
    }
  })

  const height =
    Math.max(1, lines.length) *
    options.fontSize *
    Math.max(options.lineHeight, 0.5)

  const metrics: TextMetrics = {
    width: maxWidth,
    height,
    lines: Math.max(1, lines.length),
  }
  cache.set(key, metrics)
  return metrics
}

export const clearTextMeasureCache = () => {
  cache.clear()
}

export const DEFAULT_TEXT_SHADOW = {
  offset: { x: 2, y: 2 },
  blur: 6,
  color: { r: 15, g: 23, b: 42, a: 0.35 },
} as const

export const updateTextShapeBounds = (shape: TextShape) => {
  const metrics = measureTextMetrics({
    text: shape.text ?? '',
    fontFamily: shape.font.family,
    fontSize: shape.font.size,
    fontWeight: shape.font.weight,
    letterSpacing: shape.letterSpacing ?? 0,
    lineHeight: shape.lineHeight ?? 1.4,
    italic: shape.italic ?? false,
  })

  const width = Math.max(metrics.width + HORIZONTAL_PADDING, 64)
  const height = Math.max(
    metrics.height + VERTICAL_PADDING,
    shape.font.size * 1.2,
  )

  shape.box = {
    x: width,
    y: height,
  }
}
