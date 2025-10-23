import type { PointerEvent } from 'react'

export type ScreenRect = {
  x: number
  y: number
  width: number
  height: number
}

export type HandlePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'

const HANDLE_POSITIONS: HandlePosition[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
]

const HANDLE_SIZE = 12
const ROTATION_HANDLE_SIZE = 16
const ROTATION_OFFSET = 32

const getHandleStyle = (
  position: HandlePosition,
  bounds: ScreenRect,
): React.CSSProperties => {
  const half = HANDLE_SIZE / 2
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2

  const style: React.CSSProperties = {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: '9999px',
    border: '1px solid rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.4)',
  }

  switch (position) {
    case 'top-left':
      style.left = bounds.x - half
      style.top = bounds.y - half
      break
    case 'top-right':
      style.left = bounds.x + bounds.width - half
      style.top = bounds.y - half
      break
    case 'bottom-left':
      style.left = bounds.x - half
      style.top = bounds.y + bounds.height - half
      break
    case 'bottom-right':
      style.left = bounds.x + bounds.width - half
      style.top = bounds.y + bounds.height - half
      break
    case 'top':
      style.left = centerX - half
      style.top = bounds.y - half
      break
    case 'bottom':
      style.left = centerX - half
      style.top = bounds.y + bounds.height - half
      break
    case 'left':
      style.left = bounds.x - half
      style.top = centerY - half
      break
    case 'right':
      style.left = bounds.x + bounds.width - half
      style.top = centerY - half
      break
  }

  return style
}

const SelectionOverlay = ({
  screenBounds,
  marquee,
  onMovePointerDown,
  onHandlePointerDown,
  onRotatePointerDown,
}: {
  screenBounds: ScreenRect | null
  marquee: ScreenRect | null
  onMovePointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  onHandlePointerDown?: (
    event: PointerEvent<HTMLDivElement>,
    handle: HandlePosition,
  ) => void
  onRotatePointerDown?: (event: PointerEvent<HTMLDivElement>) => void
}) => {
  return (
    <div className="pointer-events-none absolute inset-0">
      {screenBounds ? (
        <>
          <div
            className="pointer-events-auto absolute border border-(--color-accent)/80 bg-transparent"
            style={{
              left: screenBounds.x,
              top: screenBounds.y,
              width: Math.max(1, screenBounds.width),
              height: Math.max(1, screenBounds.height),
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
              onMovePointerDown?.(event)
            }}
          />

          {HANDLE_POSITIONS.map((position) => (
            <div
              key={position}
              data-handle={position}
              className="transform-handle pointer-events-auto absolute"
              style={getHandleStyle(position, screenBounds)}
              onPointerDown={(event) => {
                event.stopPropagation()
                onHandlePointerDown?.(event, position)
              }}
            />
          ))}

          <div
            className="pointer-events-none absolute"
            style={{
              left: screenBounds.x + screenBounds.width / 2 - 1,
              top: screenBounds.y - ROTATION_OFFSET + ROTATION_HANDLE_SIZE / 2,
              width: 2,
              height: ROTATION_OFFSET - ROTATION_HANDLE_SIZE,
              backgroundColor: 'rgba(37, 99, 235, 0.6)',
            }}
          />

          <div
            className="transform-rotate-handle pointer-events-auto absolute border border-[rgba(255,255,255,0.9)] bg-(--color-accent)"
            style={{
              left:
                screenBounds.x +
                screenBounds.width / 2 -
                ROTATION_HANDLE_SIZE / 2,
              top: screenBounds.y - ROTATION_OFFSET,
              width: ROTATION_HANDLE_SIZE,
              height: ROTATION_HANDLE_SIZE,
              borderRadius: '9999px',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.4)',
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
              onRotatePointerDown?.(event)
            }}
          />
        </>
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
