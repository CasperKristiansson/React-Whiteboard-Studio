import type {
  DocumentV1,
  Shape,
  RectShape,
  EllipseShape,
  LineShape,
  ArrowShape,
  PathShape,
  TextShape,
  ImageShape,
  RGBA,
  Vec2,
} from '../types'
import { getShapeBounds, expandBounds } from '../services/geometry'
import type { ShapeBounds } from '../services/geometry'
import { getAsset } from '../persistence/adapter'

type ExportTarget = 'document' | { selection: string[] }

const toCssColor = ({ r, g, b, a }: RGBA) => `rgba(${r}, ${g}, ${b}, ${a})`

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const filterShapes = (shapes: Shape[], target: ExportTarget): Shape[] => {
  if (target === 'document') return shapes
  const selection = new Set(target.selection)
  return shapes.filter((shape) => selection.has(shape.id))
}

const computeBounds = (shapes: Shape[]): ShapeBounds => {
  const bounds = shapes.map((shape) => getShapeBounds(shape))
  if (!bounds.length) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  }
  return bounds.reduce((acc, current) => ({
    minX: Math.min(acc.minX, current.minX),
    minY: Math.min(acc.minY, current.minY),
    maxX: Math.max(acc.maxX, current.maxX),
    maxY: Math.max(acc.maxY, current.maxY),
  }))
}

const rectToSvg = (shape: RectShape, offset: Vec2) => {
  const x = shape.position.x - offset.x
  const y = shape.position.y - offset.y
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${shape.size.x}"`,
    `height="${shape.size.y}"`,
    shape.fill ? `fill="${toCssColor(shape.fill)}"` : 'fill="none"',
    shape.strokeWidth > 0 ? `stroke="${toCssColor(shape.stroke)}" stroke-width="${shape.strokeWidth}"` : 'stroke="none"',
    shape.rotation ? `transform="rotate(${shape.rotation}, ${x + shape.size.x / 2}, ${y + shape.size.y / 2})"` : '',
  ]
  return `<rect ${attrs.filter(Boolean).join(' ')} />`
}

const ellipseToSvg = (shape: EllipseShape, offset: Vec2) => {
  const cx = shape.position.x - offset.x
  const cy = shape.position.y - offset.y
  const attrs = [
    `cx="${cx}"`,
    `cy="${cy}"`,
    `rx="${shape.rx}"`,
    `ry="${shape.ry}"`,
    shape.fill ? `fill="${toCssColor(shape.fill)}"` : 'fill="none"',
    shape.strokeWidth > 0 ? `stroke="${toCssColor(shape.stroke)}" stroke-width="${shape.strokeWidth}"` : 'stroke="none"',
    shape.rotation ? `transform="rotate(${shape.rotation}, ${cx}, ${cy})"` : '',
  ]
  return `<ellipse ${attrs.filter(Boolean).join(' ')} />`
}

const pointsToPath = (start: Vec2, points: Vec2[]) =>
  `M ${start.x} ${start.y} ${points
    .map((point) => `L ${start.x + point.x} ${start.y + point.y}`)
    .join(' ')}`

const polylineToSvg = (shape: LineShape | ArrowShape, offset: Vec2) => {
  const d = pointsToPath(shape.position, shape.points.slice(1))
  const attrs = [
    `d="${d}"`,
    `fill="none"`,
    `stroke="${toCssColor(shape.stroke)}"`,
    `stroke-width="${shape.strokeWidth}"`,
    `transform="translate(${shape.position.x - offset.x}, ${shape.position.y - offset.y})"`,
    shape.type === 'arrow'
      ? 'marker-end="url(#arrowhead)"'
      : '',
  ]
  return `<path ${attrs.filter(Boolean).join(' ')} />`
}

const pathToSvg = (shape: PathShape, offset: Vec2) => {
  const start = { x: shape.position.x - offset.x, y: shape.position.y - offset.y }
  const commands = [`M ${start.x} ${start.y}`]
  shape.d.slice(1).forEach((point) => {
    commands.push(`L ${start.x + point.x} ${start.y + point.y}`)
  })
  const attrs = [
    `d="${commands.join(' ')}"`,
    `fill="none"`,
    `stroke="${toCssColor(shape.stroke)}"`,
    `stroke-width="${shape.strokeWidth}"`,
  ]
  return `<path ${attrs.join(' ')} />`
}

const textToSvg = (shape: TextShape, offset: Vec2) => {
  const x = shape.position.x - offset.x
  const y = shape.position.y - offset.y
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    shape.fill ? `fill="${toCssColor(shape.fill)}"` : 'fill="#000"',
    `font-family="${escapeXml(shape.font.family)}"`,
    `font-weight="${shape.font.weight}"`,
    `font-size="${shape.font.size}"`,
    shape.italic ? 'font-style="italic"' : '',
    shape.underline ? 'text-decoration="underline"' : '',
    shape.align ? `text-anchor="${shape.align === 'center' ? 'middle' : shape.align === 'right' ? 'end' : 'start'}"` : '',
    shape.rotation ? `transform="rotate(${shape.rotation}, ${x}, ${y})"` : '',
  ]
  return `<text ${attrs.filter(Boolean).join(' ')}>${escapeXml(shape.text ?? '')}</text>`
}

const imageToSvg = async (shape: ImageShape, offset: Vec2) => {
  const asset = await getAsset(shape.assetId)
  if (!asset) return null
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = reject
    reader.readAsDataURL(asset.blob)
  })

  const x = shape.position.x - offset.x
  const y = shape.position.y - offset.y
  const attrs = [
    `xlink:href="${dataUrl}"`,
    `x="${x}"`,
    `y="${y}"`,
    `width="${shape.size.x}"`,
    `height="${shape.size.y}"`,
    shape.rotation
      ? `transform="rotate(${shape.rotation}, ${x + shape.size.x / 2}, ${y + shape.size.y / 2})"`
      : '',
  ]
  return `<image ${attrs.filter(Boolean).join(' ')} />`
}

export const exportDocumentToSVG = async (
  document: DocumentV1,
  target: ExportTarget,
): Promise<Blob> => {
  const shapes = filterShapes(document.shapes, target)
  if (!shapes.length) {
    throw new Error('No shapes to export')
  }

  const bounds = expandBounds(computeBounds(shapes), 16)
  const width = Math.max(1, Math.ceil(bounds.maxX - bounds.minX))
  const height = Math.max(1, Math.ceil(bounds.maxY - bounds.minY))
  const offset = { x: bounds.minX, y: bounds.minY }

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  )
  parts.push('<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="currentColor" /></marker></defs>')

  const imageElements: string[] = []
  for (const shape of shapes.sort((a, b) => a.zIndex - b.zIndex)) {
    switch (shape.type) {
      case 'rect':
        parts.push(rectToSvg(shape, offset))
        break
      case 'ellipse':
        parts.push(ellipseToSvg(shape, offset))
        break
      case 'line':
      case 'arrow':
        parts.push(polylineToSvg(shape, offset))
        break
      case 'path':
        parts.push(pathToSvg(shape, offset))
        break
      case 'text':
        parts.push(textToSvg(shape, offset))
        break
      case 'image': {
        const element = await imageToSvg(shape, offset)
        if (element) imageElements.push(element)
        break
      }
      default:
        break
    }
  }

  parts.push(...imageElements)
  parts.push('</svg>')

  const svg = parts.join('')
  return new Blob([svg], { type: 'image/svg+xml' })
}

