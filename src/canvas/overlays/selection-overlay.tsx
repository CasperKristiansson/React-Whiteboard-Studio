import type { Shape, Transform } from '../../types'
import { getShapeBounds } from '../../services/geometry'
import { worldPointToScreen } from '../transform'

export type ScreenRect = {
  x: number
  y: number
  width: number
  height: number
}

const SelectionOverlay = ({
  selectedShapes,
  viewport,
  marquee,
}: {
  selectedShapes: Shape[]
  viewport: Transform
  marquee: ScreenRect | null
}) => {
  if (!selectedShapes.length && !marquee) {
    return null
  }

  const bbox = selectedShapes.length
    ? selectedShapes.reduce(
        (acc, shape) => {
          const bounds = getShapeBounds(shape)
          const topLeft = worldPointToScreen(
            { x: bounds.minX, y: bounds.minY },
            viewport,
          )
          const bottomRight = worldPointToScreen(
            { x: bounds.maxX, y: bounds.maxY },
            viewport,
          )

          return {
            minX: Math.min(acc.minX, topLeft.x),
            minY: Math.min(acc.minY, topLeft.y),
            maxX: Math.max(acc.maxX, bottomRight.x),
            maxY: Math.max(acc.maxY, bottomRight.y),
          }
        },
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      )
    : null

  return (
    <div className="pointer-events-none absolute inset-0">
      {bbox && Number.isFinite(bbox.minX) && Number.isFinite(bbox.minY) ? (
        <div
          className="absolute rounded border border-dashed border-(--color-accent)/70 bg-(--color-accent)/5"
          style={{
            left: bbox.minX,
            top: bbox.minY,
            width: Math.max(1, bbox.maxX - bbox.minX),
            height: Math.max(1, bbox.maxY - bbox.minY),
          }}
        />
      ) : null}

      {marquee ? (
        <div
          className="absolute border border-dashed border-(--color-accent) bg-(--color-accent)/10"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: Math.max(1, marquee.width),
            height: Math.max(1, marquee.height),
          }}
        />
      ) : null}
    </div>
  )
}

export default SelectionOverlay
