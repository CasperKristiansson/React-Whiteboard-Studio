import type {
  DocumentV1,
  Shape,
  Vec2,
  RectShape,
  EllipseShape,
  LineShape,
  ArrowShape,
  PathShape,
  TextShape,
  ImageShape,
  RGBA,
} from '../types'
import { getShapeBounds, expandBounds } from '../services/geometry'
import type { ShapeBounds } from '../services/geometry'
import { getAsset } from '../persistence/adapter'

type ExportTarget = 'document' | { selection: string[] }

const toCssColor = ({ r, g, b, a }: RGBA) => `rgba(${r}, ${g}, ${b}, ${a})`

const ensureCanvas = (width: number, height: number) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  throw new Error('Canvas API is not available in this environment')
}

const loadImageForShape = async (shape: ImageShape) => {
  const asset = await getAsset(shape.assetId)
  if (!asset) throw new Error('Missing asset for image shape')

  if (typeof createImageBitmap !== 'undefined') {
    return createImageBitmap(asset.blob)
  }

  if (typeof document === 'undefined') {
    throw new Error('Image asset cannot be loaded in this environment')
  }

  const img = new Image()
  const url = URL.createObjectURL(asset.blob)
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    img.src = url
  })
  return img
}

const drawRectangle = (ctx: CanvasRenderingContext2D, shape: RectShape) => {
  const drawAxisAligned = () => {
    if (shape.fill) {
      ctx.fillStyle = toCssColor(shape.fill)
      ctx.fillRect(shape.position.x, shape.position.y, shape.size.x, shape.size.y)
    }
    if (shape.strokeWidth > 0) {
      ctx.strokeStyle = toCssColor(shape.stroke)
      ctx.lineWidth = shape.strokeWidth
      ctx.strokeRect(shape.position.x, shape.position.y, shape.size.x, shape.size.y)
    }
  }

  const rotation = shape.rotation ?? 0
  if (!rotation) {
    drawAxisAligned()
    return
  }

  const center = {
    x: shape.position.x + shape.size.x / 2,
    y: shape.position.y + shape.size.y / 2,
  }

  ctx.save()
  ctx.translate(center.x, center.y)
  ctx.rotate((rotation * Math.PI) / 180)
  if (shape.fill) {
    ctx.fillStyle = toCssColor(shape.fill)
    ctx.fillRect(-shape.size.x / 2, -shape.size.y / 2, shape.size.x, shape.size.y)
  }
  if (shape.strokeWidth > 0) {
    ctx.strokeStyle = toCssColor(shape.stroke)
    ctx.lineWidth = shape.strokeWidth
    ctx.strokeRect(-shape.size.x / 2, -shape.size.y / 2, shape.size.x, shape.size.y)
  }
  ctx.restore()
}

const drawEllipse = (ctx: CanvasRenderingContext2D, shape: EllipseShape) => {
  ctx.beginPath()
  ctx.ellipse(shape.position.x, shape.position.y, shape.rx, shape.ry, 0, 0, Math.PI * 2)
  if (shape.fill) {
    ctx.fillStyle = toCssColor(shape.fill)
    ctx.fill()
  }
  if (shape.strokeWidth > 0) {
    ctx.strokeStyle = toCssColor(shape.stroke)
    ctx.lineWidth = shape.strokeWidth
    ctx.stroke()
  }
}

const drawPolyline = (ctx: CanvasRenderingContext2D, shape: LineShape | ArrowShape) => {
  if (shape.points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(shape.position.x, shape.position.y)
  shape.points.slice(1).forEach((point) => {
    ctx.lineTo(shape.position.x + point.x, shape.position.y + point.y)
  })
  ctx.strokeStyle = toCssColor(shape.stroke)
  ctx.lineWidth = shape.strokeWidth
  ctx.stroke()

  if (shape.type === 'arrow') {
    const last = shape.points[shape.points.length - 1]
    const prev = shape.points[shape.points.length - 2]
    const end: Vec2 = { x: shape.position.x + last.x, y: shape.position.y + last.y }
    const start: Vec2 = { x: shape.position.x + prev.x, y: shape.position.y + prev.y }
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const head = (shape as ArrowShape).headSize
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fillStyle = toCssColor(shape.stroke)
    ctx.fill()
  }
}

const drawPath = (ctx: CanvasRenderingContext2D, shape: PathShape) => {
  if (shape.d.length < 2) return
  ctx.beginPath()
  ctx.moveTo(shape.position.x, shape.position.y)
  shape.d.slice(1).forEach((point) => {
    ctx.lineTo(shape.position.x + point.x, shape.position.y + point.y)
  })
  ctx.strokeStyle = toCssColor(shape.stroke)
  ctx.lineWidth = shape.strokeWidth
  ctx.stroke()
}

const drawText = (ctx: CanvasRenderingContext2D, shape: TextShape) => {
  const italic = shape.italic ? 'italic ' : ''
  const font = `${italic}${shape.font.weight} ${shape.font.size}px ${shape.font.family}`
  const rotation = shape.rotation ?? 0
  if (rotation) {
    ctx.save()
    ctx.translate(shape.position.x, shape.position.y)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.font = font
    ctx.fillStyle = shape.fill ? toCssColor(shape.fill) : '#000'
    ctx.textBaseline = 'top'
    ctx.fillText(shape.text ?? '', 0, 0)
    ctx.restore()
  } else {
    ctx.font = font
    ctx.fillStyle = shape.fill ? toCssColor(shape.fill) : '#000'
    ctx.textBaseline = 'top'
    ctx.fillText(shape.text ?? '', shape.position.x, shape.position.y)
  }
}

const drawImage = (ctx: CanvasRenderingContext2D, shape: ImageShape, image: CanvasImageSource) => {
  const rotation = shape.rotation ?? 0
  if (rotation) {
    const center = {
      x: shape.position.x + shape.size.x / 2,
      y: shape.position.y + shape.size.y / 2,
    }
    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(image, -shape.size.x / 2, -shape.size.y / 2, shape.size.x, shape.size.y)
    ctx.restore()
  } else {
    ctx.drawImage(image, shape.position.x, shape.position.y, shape.size.x, shape.size.y)
  }
}

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

export const exportDocumentToPNG = async (
  document: DocumentV1,
  target: ExportTarget,
  scale = 2,
): Promise<Blob> => {
  const shapes = filterShapes(document.shapes, target)
  if (!shapes.length) {
    throw new Error('No shapes to export')
  }

  const bounds = expandBounds(computeBounds(shapes), 16)
  const width = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) * scale))
  const height = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) * scale))

  const canvas = ensureCanvas(width, height)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
  if (!ctx) {
    throw new Error('Unable to acquire 2D context')
  }

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(-bounds.minX, -bounds.minY)

  const images = new Map<string, CanvasImageSource>()
  const sorted = [...shapes].sort((a, b) => a.zIndex - b.zIndex)
  for (const shape of sorted) {
    if (shape.type === 'image') {
      images.set(shape.id, await loadImageForShape(shape))
    }
  }

  for (const shape of sorted) {
    switch (shape.type) {
      case 'rect':
        drawRectangle(ctx, shape)
        break
      case 'ellipse':
        drawEllipse(ctx, shape)
        break
      case 'line':
      case 'arrow':
        drawPolyline(ctx, shape)
        break
      case 'path':
        drawPath(ctx, shape)
        break
      case 'text':
        drawText(ctx, shape)
        break
      case 'image': {
        const image = images.get(shape.id)
        if (image) drawImage(ctx, shape, image)
        break
      }
      default:
        break
    }
  }

  ctx.restore()

  if ('convertToBlob' in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' })
  }

  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to produce PNG blob'))
    }, 'image/png')
  })
}
