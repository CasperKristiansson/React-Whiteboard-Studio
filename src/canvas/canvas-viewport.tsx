import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEventHandler,
} from 'react'

import {
  applyZoomAtPoint,
  screenDeltaToWorld,
  screenPointToWorld,
  worldPointToScreen,
} from './transform'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  selectActiveTool,
  selectSettings,
  selectShapes,
  selectSelection,
  selectViewport,
  useAppSelector,
  useAppStore,
} from '../state/store'
import type { ArrowShape, Shape, TextShape, Vec2 } from '../types'
import GridLayer from './layers/grid-layer'
import SelectionOverlay, {
  type ScreenRect,
  type HandlePosition,
} from './overlays/selection-overlay'
import {
  createTransformSnapshot,
  restoreSnapshot,
  applyTranslation,
  applyScale,
  applyRotation,
  type TransformSnapshot,
} from './controllers/transform-controller'
import GuidesOverlay from './overlays/guides-overlay'
import {
  buildSnapOptions,
  type ScaleMovingEdges,
  type SnapGuide,
} from '../services/snap'
import {
  createWorldMarquee,
  getShapesWithinBounds,
  hitTestShapes,
} from '../services/hittest'
import { getShapeBounds, type ShapeBounds } from '../services/geometry'
import {
  beginRect,
  cancelRect,
  finalizeRect,
  updateRect,
  type RectDragState,
} from './controllers/rect-controller'
import {
  beginEllipse,
  cancelEllipse,
  finalizeEllipse,
  updateEllipse,
  type EllipseDragState,
} from './controllers/ellipse-controller'
import {
  beginPolyline,
  cancelPolyline,
  finalizePolyline,
  commitPolylinePoint,
  updatePolyline,
  type PolylineState,
} from './controllers/polyline-controller'
import {
  beginPath,
  cancelPath,
  finalizePath,
  updatePath,
  type PathState,
} from './controllers/path-controller'
import {
  beginText,
  cancelText as cancelTextShape,
  finalizeText,
  type TextCreationState,
} from './controllers/text-controller'
import TextEditor from '../ui/text-editor'
import { updateTextShapeBounds } from '../utils/text-measure'
import { mark } from '../dev/perf'

const PAN_COMMIT_DELAY = 120
const ROTATE_SNAP_STEP_RADIANS = Math.PI / 12
const SNAP_GRID_SIZE = 5
const SNAP_PIXEL_TOLERANCE = 8

const createMovingEdges = (handle: HandlePosition) => ({
  minX: handle === 'left' || handle === 'top-left' || handle === 'bottom-left',
  maxX:
    handle === 'right' || handle === 'top-right' || handle === 'bottom-right',
  minY: handle === 'top' || handle === 'top-left' || handle === 'top-right',
  maxY:
    handle === 'bottom' ||
    handle === 'bottom-left' ||
    handle === 'bottom-right',
})

type MoveTransformState = {
  mode: 'move'
  pointerId: number
  snapshot: TransformSnapshot
  originalBounds: ShapeBounds
  startWorld: Vec2
}

type ScaleTransformState = {
  mode: 'scale'
  pointerId: number
  snapshot: TransformSnapshot
  originalBounds: ShapeBounds
  handle: HandlePosition
}

type RotateTransformState = {
  mode: 'rotate'
  pointerId: number
  snapshot: TransformSnapshot
  originalBounds: ShapeBounds
  center: Vec2
  startAngle: number
  currentAngle: number
}

type TransformState =
  | MoveTransformState
  | ScaleTransformState
  | RotateTransformState

const isTextInput = (element: EventTarget | null): boolean => {
  if (!(element instanceof HTMLElement)) return false
  const tag = element.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    element.isContentEditable ||
    element.getAttribute('role') === 'textbox'
  )
}

type PointerState = {
  active: boolean
  pointerId: number | null
  last: Vec2
}

const getBoundsCenter = (bounds: ShapeBounds): Vec2 => ({
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
})

const cornerHandles: HandlePosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

const computeScaledBounds = (
  handle: HandlePosition,
  bounds: ShapeBounds,
  pointer: Vec2,
  shiftKey: boolean,
): ShapeBounds => {
  const { minX, minY, maxX, maxY } = bounds

  let newMinX = minX
  let newMaxX = maxX
  let newMinY = minY
  let newMaxY = maxY

  switch (handle) {
    case 'top-left':
      newMinX = Math.min(pointer.x, maxX)
      newMinY = Math.min(pointer.y, maxY)
      break
    case 'top-right':
      newMaxX = Math.max(pointer.x, minX)
      newMinY = Math.min(pointer.y, maxY)
      break
    case 'bottom-left':
      newMinX = Math.min(pointer.x, maxX)
      newMaxY = Math.max(pointer.y, minY)
      break
    case 'bottom-right':
      newMaxX = Math.max(pointer.x, minX)
      newMaxY = Math.max(pointer.y, minY)
      break
    case 'top':
      newMinY = Math.min(pointer.y, maxY)
      break
    case 'bottom':
      newMaxY = Math.max(pointer.y, minY)
      break
    case 'left':
      newMinX = Math.min(pointer.x, maxX)
      break
    case 'right':
      newMaxX = Math.max(pointer.x, minX)
      break
  }

  let newWidth = newMaxX - newMinX
  let newHeight = newMaxY - newMinY

  if (shiftKey && cornerHandles.includes(handle)) {
    const originalWidth =
      bounds.maxX - bounds.minX || (newWidth === 0 ? 1 : Math.abs(newWidth))
    const originalHeight =
      bounds.maxY - bounds.minY || (newHeight === 0 ? 1 : Math.abs(newHeight))
    const aspect = originalHeight / originalWidth

    if (aspect > 0) {
      if (Math.abs(newWidth * aspect) > Math.abs(newHeight)) {
        newHeight = Math.abs(newWidth) * aspect
        if (handle === 'top-left' || handle === 'top-right') {
          newMinY = newMaxY - newHeight
        } else {
          newMaxY = newMinY + newHeight
        }
      } else {
        newWidth = Math.abs(newHeight) / aspect
        if (handle === 'top-left' || handle === 'bottom-left') {
          newMinX = newMaxX - newWidth
        } else {
          newMaxX = newMinX + newWidth
        }
      }
    }
  }

  return {
    minX: Math.min(newMinX, newMaxX),
    minY: Math.min(newMinY, newMaxY),
    maxX: Math.max(newMinX, newMaxX),
    maxY: Math.max(newMinY, newMaxY),
  }
}

const initialPointerState: PointerState = {
  active: false,
  pointerId: null,
  last: { x: 0, y: 0 },
}

export const CanvasViewport = () => {
  mark('canvas-viewport-render')
  const activeTool = useAppSelector(selectActiveTool)
  const viewport = useAppSelector(selectViewport)
  const settings = useAppSelector(selectSettings)
  const shapes = useAppSelector(selectShapes)
  const selectionIds = useAppSelector(selectSelection)
  const setViewport = useAppStore((state) => state.setViewport)
  const commit = useAppStore((state) => state.commit)
  const select = useAppStore((state) => state.select)
  const clearSelection = useAppStore((state) => state.clearSelection)
  const bringSelectionForward = useAppStore(
    (state) => state.bringSelectionForward,
  )
  const sendSelectionBackward = useAppStore(
    (state) => state.sendSelectionBackward,
  )
  const bringSelectionToFront = useAppStore(
    (state) => state.bringSelectionToFront,
  )
  const sendSelectionToBack = useAppStore((state) => state.sendSelectionToBack)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const pointerState = useRef<PointerState>({ ...initialPointerState })
  const panModifierPressed = useRef(false)
  const commitTimer = useRef<number | undefined>(undefined)
  const selectionSession = useRef<{
    active: boolean
    pointerId: number | null
    originWorld: Vec2
    originScreen: Vec2
    currentWorld: Vec2
    worldBounds: ShapeBounds | null
    moved: boolean
  } | null>(null)
  const [marquee, setMarquee] = useState<ScreenRect | null>(null)
  const rectState = useRef<RectDragState | null>(null)
  const ellipseState = useRef<EllipseDragState | null>(null)
  const polylineState = useRef<PolylineState | null>(null)
  const pathState = useRef<PathState | null>(null)
  const transformState = useRef<TransformState | null>(null)
  const pendingTextState = useRef<TextCreationState | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const updateShape = useAppStore((state) => state.updateShape)
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const isMacPlatform =
    typeof navigator !== 'undefined' &&
    /Mac|iP(hone|od|ad)/i.test(navigator.platform ?? navigator.userAgent)
  const panShortcutLabel = isMacPlatform ? '⌘ + drag' : 'Ctrl + drag'

  const toCssColor = useCallback(
    (color: { r: number; g: number; b: number; a: number }) => {
      const alpha = typeof color.a === 'number' ? color.a : 1
      return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    },
    [],
  )

  const shapeElements = useMemo(() => {
    const sorted = [...shapes].sort((a, b) => a.zIndex - b.zIndex)

    const elements = sorted.map((shape) => {
      if (editingTextId && shape.id === editingTextId) return null
      if (shape.hidden) return null

      switch (shape.type) {
        case 'rect': {
          const topLeft = worldPointToScreen(shape.position, viewport)
          const width = shape.size.x * viewport.scale
          const height = shape.size.y * viewport.scale
          if (width === 0 && height === 0) return null
          const stroke = toCssColor(shape.stroke)
          const fill = shape.fill ? toCssColor(shape.fill) : 'none'
          const radius = shape.radius ? shape.radius * viewport.scale : 0
          return (
            <rect
              key={shape.id}
              x={topLeft.x}
              y={topLeft.y}
              width={width}
              height={height}
              rx={radius}
              ry={radius}
              fill={fill}
              stroke={stroke}
              strokeWidth={Math.max(1, shape.strokeWidth * viewport.scale)}
            />
          )
        }
        case 'ellipse': {
          const center = worldPointToScreen(shape.position, viewport)
          const rx = shape.rx * viewport.scale
          const ry = shape.ry * viewport.scale
          if (rx === 0 && ry === 0) return null
          const stroke = toCssColor(shape.stroke)
          const fill = shape.fill ? toCssColor(shape.fill) : 'none'
          return (
            <ellipse
              key={shape.id}
              cx={center.x}
              cy={center.y}
              rx={rx}
              ry={ry}
              fill={fill}
              stroke={stroke}
              strokeWidth={Math.max(1, shape.strokeWidth * viewport.scale)}
            />
          )
        }
        case 'line':
        case 'arrow': {
          const points = shape.points.map((point) =>
            worldPointToScreen(
              {
                x: shape.position.x + point.x,
                y: shape.position.y + point.y,
              },
              viewport,
            ),
          )
          if (points.length < 2) return null
          const stroke = toCssColor(shape.stroke)
          const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ')
          const strokeWidth = Math.max(1, shape.strokeWidth * viewport.scale)

          if (shape.type === 'arrow') {
            const headSize = (shape as ArrowShape).headSize * viewport.scale * 3
            const markerId = `arrow-head-${shape.id}`
            return (
              <g key={shape.id}>
                <defs>
                  <marker
                    id={markerId}
                    markerWidth={headSize}
                    markerHeight={headSize}
                    refX={headSize * 0.6}
                    refY={headSize * 0.3}
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M 0 0 L ${headSize} ${headSize * 0.3} L 0 ${headSize * 0.6} z`}
                      fill={stroke}
                    />
                  </marker>
                </defs>
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={`url(#${markerId})`}
                />
              </g>
            )
          }

          return (
            <polyline
              key={shape.id}
              points={polylinePoints}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        }
        case 'path': {
          const points = shape.d.map((point) =>
            worldPointToScreen(
              {
                x: shape.position.x + point.x,
                y: shape.position.y + point.y,
              },
              viewport,
            ),
          )
          if (points.length < 2) return null
          const stroke = toCssColor(shape.stroke)
          const d = points
            .map((point, index) =>
              index === 0
                ? `M ${point.x} ${point.y}`
                : `L ${point.x} ${point.y}`,
            )
            .join(' ')
          return (
            <path
              key={shape.id}
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={Math.max(1, shape.strokeWidth * viewport.scale)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        }
        case 'text': {
          const position = worldPointToScreen(shape.position, viewport)
          const stroke = toCssColor(shape.stroke)
          return (
            <text
              key={shape.id}
              x={position.x}
              y={position.y}
              fill={shape.fill ? toCssColor(shape.fill) : stroke}
              fontFamily={shape.font.family}
              fontSize={shape.font.size * viewport.scale}
              fontWeight={shape.font.weight}
              textAnchor={
                shape.align === 'center'
                  ? 'middle'
                  : shape.align === 'right'
                    ? 'end'
                    : 'start'
              }
              dominantBaseline="text-before-edge"
            >
              {shape.text}
            </text>
          )
        }
        default:
          return null
      }
    })

    return elements.filter(Boolean)
  }, [
    editingTextId,
    shapes,
    toCssColor,
    viewport.x,
    viewport.y,
    viewport.scale,
  ])

  const selectedShapes = useMemo<Shape[]>(
    () => shapes.filter((shape) => selectionIds.includes(shape.id)),
    [shapes, selectionIds],
  )

  const selectionWorldBounds = useMemo<ShapeBounds | null>(() => {
    if (!selectedShapes.length) return null

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    selectedShapes.forEach((shape) => {
      const bounds = getShapeBounds(shape)
      if (bounds.minX < minX) minX = bounds.minX
      if (bounds.minY < minY) minY = bounds.minY
      if (bounds.maxX > maxX) maxX = bounds.maxX
      if (bounds.maxY > maxY) maxY = bounds.maxY
    })

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return null
    }

    return { minX, minY, maxX, maxY }
  }, [selectedShapes])

  const selectionScreenBounds = useMemo<ScreenRect | null>(() => {
    if (!selectionWorldBounds) return null
    const topLeft = worldPointToScreen(
      { x: selectionWorldBounds.minX, y: selectionWorldBounds.minY },
      viewport,
    )
    const bottomRight = worldPointToScreen(
      { x: selectionWorldBounds.maxX, y: selectionWorldBounds.maxY },
      viewport,
    )

    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    }
  }, [selectionWorldBounds, viewport])

  const editingTextShape = useMemo<TextShape | null>(() => {
    if (!editingTextId) return null
    const target = shapes.find((shape) => shape.id === editingTextId)
    return target && target.type === 'text' ? target : null
  }, [editingTextId, shapes])

  const textEditorBounds = useMemo(() => {
    if (!editingTextShape) return null
    const topLeft = worldPointToScreen(
      { x: editingTextShape.position.x, y: editingTextShape.position.y },
      viewport,
    )
    const bottomRight = worldPointToScreen(
      {
        x: editingTextShape.position.x + editingTextShape.box.x,
        y: editingTextShape.position.y + editingTextShape.box.y,
      },
      viewport,
    )

    return {
      left: Math.min(topLeft.x, bottomRight.x),
      top: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    }
  }, [editingTextShape, viewport])

  const handleTextChange = useCallback(
    (value: string) => {
      if (!editingTextShape) return
      updateShape(editingTextShape.id, (shape) => {
        if (shape.type === 'text') {
          shape.text = value
          updateTextShapeBounds(shape)
        }
      })
    },
    [editingTextShape, updateShape],
  )

  const handleTextCommit = useCallback(() => {
    if (!editingTextId) return
    finalizeText(editingTextId)
    setEditingTextId(null)
  }, [editingTextId])

  const handleTextCancel = useCallback(() => {
    if (!editingTextId) return
    cancelTextShape(editingTextId)
    setEditingTextId(null)
  }, [editingTextId])

  const handleSelectionMovePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!selectionWorldBounds || !selectedShapes.length) return

      const node = containerRef.current
      if (!node) return

      event.preventDefault()
      event.stopPropagation()

      const rect = node.getBoundingClientRect()
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport,
      )

      const snapshot = createTransformSnapshot(selectedShapes)
      transformState.current = {
        mode: 'move',
        pointerId: event.pointerId,
        snapshot,
        originalBounds: snapshot.selectionBounds,
        startWorld: worldPoint,
      }

      node.setPointerCapture(event.pointerId)
    },
    [selectedShapes, selectionWorldBounds],
  )

  const handleSelectionHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, handle: HandlePosition) => {
      if (!selectionWorldBounds || !selectedShapes.length) return

      const node = containerRef.current
      if (!node) return

      event.preventDefault()
      event.stopPropagation()

      const rect = node.getBoundingClientRect()
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport,
      )

      const snapshot = createTransformSnapshot(selectedShapes)
      transformState.current = {
        mode: 'scale',
        pointerId: event.pointerId,
        snapshot,
        originalBounds: snapshot.selectionBounds,
        handle,
      }

      const newBounds = computeScaledBounds(
        handle,
        snapshot.selectionBounds,
        worldPoint,
        event.shiftKey,
      )
      applyScale(snapshot, newBounds)
      node.setPointerCapture(event.pointerId)
    },
    [selectedShapes, selectionWorldBounds],
  )

  const handleSelectionRotatePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!selectionWorldBounds || !selectedShapes.length) return

      const node = containerRef.current
      if (!node) return

      event.preventDefault()
      event.stopPropagation()

      const rect = node.getBoundingClientRect()
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport,
      )

      const center = getBoundsCenter(selectionWorldBounds)
      const startAngle = Math.atan2(
        worldPoint.y - center.y,
        worldPoint.x - center.x,
      )

      const snapshot = createTransformSnapshot(selectedShapes)
      transformState.current = {
        mode: 'rotate',
        pointerId: event.pointerId,
        snapshot,
        originalBounds: snapshot.selectionBounds,
        center,
        startAngle,
        currentAngle: 0,
      }

      node.setPointerCapture(event.pointerId)
    },
    [selectedShapes, selectionWorldBounds],
  )

  const scheduleCommit = useCallback(
    (label: string) => {
      window.clearTimeout(commitTimer.current)
      commitTimer.current = window.setTimeout(() => {
        commit(label, { squash: true })
        commitTimer.current = undefined
      }, PAN_COMMIT_DELAY)
    },
    [commit],
  )

  useEffect(() => {
    const panKeyCodes = new Set(
      isMacPlatform
        ? ['MetaLeft', 'MetaRight']
        : ['ControlLeft', 'ControlRight'],
    )

    const handleKeyDown = (event: KeyboardEvent) => {
      if (panKeyCodes.has(event.code)) {
        if (isTextInput(event.target)) return
        panModifierPressed.current = true
      }

      if (event.code === 'Escape') {
        if (rectState.current) {
          cancelRect(rectState.current)
          if (rectState.current.pointerId != null) {
            const node = containerRef.current
            if (node && node.hasPointerCapture(rectState.current.pointerId)) {
              node.releasePointerCapture(rectState.current.pointerId)
            }
          }
          rectState.current = null
          event.preventDefault()
          return
        }

        if (polylineState.current) {
          const state = polylineState.current
          if (state.pointerId != null) {
            const node = containerRef.current
            if (node && node.hasPointerCapture(state.pointerId)) {
              node.releasePointerCapture(state.pointerId)
            }
          }
          cancelPolyline(state)
          polylineState.current = null
          event.preventDefault()
          return
        }

        if (pathState.current) {
          const state = pathState.current
          if (state.pointerId != null) {
            const node = containerRef.current
            if (node && node.hasPointerCapture(state.pointerId)) {
              node.releasePointerCapture(state.pointerId)
            }
          }
          cancelPath(state)
          pathState.current = null
          event.preventDefault()
          return
        }

        if (selectionSession.current) {
          const session = selectionSession.current
          if (session?.pointerId != null) {
            const node = containerRef.current
            if (node && node.hasPointerCapture(session.pointerId)) {
              node.releasePointerCapture(session.pointerId)
            }
          }
          selectionSession.current = null
          setMarquee(null)
          event.preventDefault()
          return
        }
      }

      if (event.code === 'Enter' && polylineState.current) {
        const state = polylineState.current
        if (state.pointerId != null) {
          const node = containerRef.current
          if (node && node.hasPointerCapture(state.pointerId)) {
            node.releasePointerCapture(state.pointerId)
          }
        }
        finalizePolyline(state)
        polylineState.current = null
        event.preventDefault()
        return
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (panKeyCodes.has(event.code)) {
        panModifierPressed.current = false
      }
    }

    const handleWindowBlur = () => {
      panModifierPressed.current = false
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isMacPlatform])

  const endPan = useCallback(
    (label: string) => {
      const current = pointerState.current
      if (!current.active) return
      current.active = false
      current.pointerId = null
      document.body.style.cursor = ''
      scheduleCommit(label)
    },
    [scheduleCommit],
  )

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0) return

    const node = containerRef.current
    if (!node) return

    if (contextMenu) {
      setContextMenu(null)
    }

    setSnapGuides([])

    if (editingTextId) {
      finalizeText(editingTextId)
      setEditingTextId(null)
      event.preventDefault()
      return
    }

    const rect = node.getBoundingClientRect()
    const screenPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const worldPoint = screenPointToWorld(
      screenPoint,
      useAppStore.getState().viewport,
    )

    if (activeTool === 'text') {
      const state = beginText(worldPoint, event.pointerId)
      pendingTextState.current = state
      node.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    if (activeTool === 'rect') {
      const state = beginRect(worldPoint, event.pointerId)
      rectState.current = state
      updateRect(state, worldPoint)
      node.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    if (activeTool === 'ellipse') {
      const state = beginEllipse(worldPoint, event.pointerId)
      ellipseState.current = state
      updateEllipse(state, worldPoint)
      node.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    if (activeTool === 'line' || activeTool === 'arrow') {
      const state = polylineState.current
      if (!state || state.locked) {
        const nextState = beginPolyline(activeTool, worldPoint, event.pointerId)
        polylineState.current = nextState
        node.setPointerCapture(event.pointerId)
        updatePolyline(nextState, worldPoint, { force: true })
      } else if (event.detail >= 2) {
        if (
          state.pointerId !== null &&
          node.hasPointerCapture(state.pointerId)
        ) {
          node.releasePointerCapture(state.pointerId)
        }
        state.pointerId = null
        finalizePolyline(state)
        polylineState.current = null
      } else {
        state.pointerId = event.pointerId
        updatePolyline(state, worldPoint, { force: true })
        node.setPointerCapture(event.pointerId)
      }
      event.preventDefault()
      return
    }

    if (activeTool === 'path') {
      const state = beginPath(worldPoint, event.pointerId)
      pathState.current = state
      updatePath(state, worldPoint)
      node.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    const modifierHeld =
      panModifierPressed.current ||
      event.metaKey ||
      (!isMacPlatform && event.ctrlKey)
    const storeState = useAppStore.getState()
    const shouldPan =
      modifierHeld || event.pointerType === 'touch' || activeTool !== 'select'

    if (shouldPan) {
      node.setPointerCapture(event.pointerId)
      pointerState.current = {
        active: true,
        pointerId: event.pointerId,
        last: { x: event.clientX, y: event.clientY },
      }
      document.body.style.cursor = 'grabbing'
      event.preventDefault()
      return
    }

    const hit = hitTestShapes(storeState.document.shapes, worldPoint)
    const isAlreadySelected = hit ? selectionIds.includes(hit.id) : false

    if (hit && !isAlreadySelected) {
      select([hit.id], event.shiftKey ? 'toggle' : 'set')
    }

    if (hit) {
      const targetSelection = selectionIds.includes(hit.id)
        ? selectedShapes
        : [...selectedShapes, hit]

      const snapshot = createTransformSnapshot(targetSelection)
      transformState.current = {
        mode: 'move',
        pointerId: event.pointerId,
        snapshot,
        originalBounds: snapshot.selectionBounds,
        startWorld: worldPoint,
      }
      node.setPointerCapture(event.pointerId)
      document.body.style.cursor = 'grabbing'
      event.preventDefault()
      return
    }

    selectionSession.current = {
      active: true,
      pointerId: event.pointerId,
      originWorld: worldPoint,
      currentWorld: worldPoint,
      worldBounds: null,
      originScreen: { x: event.clientX, y: event.clientY },
      moved: false,
    }

    node.setPointerCapture(event.pointerId)
    setMarquee(null)
    event.preventDefault()
  }

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (!selectionIds.length) return
      setContextMenu({ x: event.clientX, y: event.clientY })
    },
    [selectionIds.length],
  )

  const handleContextAction = useCallback(
    (action: 'forward' | 'backward' | 'front' | 'back') => {
      switch (action) {
        case 'forward':
          bringSelectionForward()
          commit('Bring forward')
          break
        case 'backward':
          sendSelectionBackward()
          commit('Send backward')
          break
        case 'front':
          bringSelectionToFront()
          commit('Bring to front')
          break
        case 'back':
          sendSelectionToBack()
          commit('Send to back')
          break
      }
      setContextMenu(null)
    },
    [
      bringSelectionForward,
      bringSelectionToFront,
      commit,
      sendSelectionBackward,
      sendSelectionToBack,
    ],
  )

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool !== 'select' || editingTextId) return
      const node = containerRef.current
      if (!node) return

      const rect = node.getBoundingClientRect()
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const store = useAppStore.getState()
      const worldPoint = screenPointToWorld(screenPoint, store.viewport)
      const hit = hitTestShapes(store.document.shapes, worldPoint)
      if (!hit || hit.type !== 'text') return

      event.preventDefault()
      event.stopPropagation()
      select([hit.id], 'set')
      setEditingTextId(hit.id)
    },
    [activeTool, editingTextId, select],
  )

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    const transform = transformState.current
    if (!transform && snapGuides.length) {
      setSnapGuides([])
    }
    if (
      transform &&
      transform.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const node = containerRef.current
      if (node) {
        const rect = node.getBoundingClientRect()
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const storeState = useAppStore.getState()
        const worldPoint = screenPointToWorld(screenPoint, storeState.viewport)
        const snapConfig = buildSnapOptions({
          enabled: settings.snapEnabled,
          gridSize: SNAP_GRID_SIZE,
          tolerance: SNAP_PIXEL_TOLERANCE,
          viewportScale: storeState.viewport.scale,
          shapes: storeState.document.shapes,
          selectionIds,
        })

        if (transform.mode === 'move') {
          const delta = {
            x: worldPoint.x - transform.startWorld.x,
            y: worldPoint.y - transform.startWorld.y,
          }
          const result = applyTranslation(transform.snapshot, delta, {
            snap: snapConfig,
          })
          setSnapGuides(result.guides)
        } else if (transform.mode === 'scale') {
          const newBounds = computeScaledBounds(
            transform.handle,
            transform.originalBounds,
            worldPoint,
            event.shiftKey,
          )
          const movingEdges: ScaleMovingEdges = createMovingEdges(
            transform.handle,
          )
          const result = applyScale(transform.snapshot, newBounds, {
            snap: { config: snapConfig, moving: movingEdges },
          })
          setSnapGuides(result.guides)
        } else if (transform.mode === 'rotate') {
          const rawAngle =
            Math.atan2(
              worldPoint.y - transform.center.y,
              worldPoint.x - transform.center.x,
            ) - transform.startAngle
          const rotationSnapConfig = {
            ...snapConfig,
            angleStep: ROTATE_SNAP_STEP_RADIANS,
            angleTolerance: ROTATE_SNAP_STEP_RADIANS / 2,
          }
          const result = applyRotation(
            transform.snapshot,
            rawAngle,
            transform.center,
            {
              snap: rotationSnapConfig,
              shiftSnap: event.shiftKey,
            },
          )
          transform.currentAngle = result.angle
          setSnapGuides(result.guides)
        }
      }

      event.preventDefault()
      return
    }

    if (rectState.current && containerRef.current) {
      const state = rectState.current
      const node = containerRef.current
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect()
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport,
        )
        updateRect(state, worldPoint)
        event.preventDefault()
        return
      }
    }

    if (ellipseState.current && containerRef.current) {
      const state = ellipseState.current
      const node = containerRef.current
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect()
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport,
        )
        updateEllipse(state, worldPoint)
        event.preventDefault()
        return
      }
    }

    if (polylineState.current && containerRef.current) {
      const state = polylineState.current
      const node = containerRef.current
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect()
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport,
        )
        updatePolyline(state, worldPoint)
        event.preventDefault()
        return
      }
    }

    if (pathState.current && containerRef.current) {
      const state = pathState.current
      const node = containerRef.current
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect()
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport,
        )
        updatePath(state, worldPoint, { force: true })
        event.preventDefault()
        return
      }
    }

    const node = containerRef.current
    const selection = selectionSession.current
    if (
      selection &&
      selection.active &&
      selection.pointerId === event.pointerId &&
      node
    ) {
      const rect = node.getBoundingClientRect()
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport,
      )

      selection.currentWorld = worldPoint

      const distance = Math.hypot(
        event.clientX - selection.originScreen.x,
        event.clientY - selection.originScreen.y,
      )
      if (!selection.moved && distance > 4) {
        selection.moved = true
      }

      if (selection.moved) {
        const bounds = createWorldMarquee(
          selection.originWorld,
          selection.currentWorld,
        )
        selection.worldBounds = bounds
        const topLeft = worldPointToScreen(
          { x: bounds.minX, y: bounds.minY },
          useAppStore.getState().viewport,
        )
        const bottomRight = worldPointToScreen(
          { x: bounds.maxX, y: bounds.maxY },
          useAppStore.getState().viewport,
        )
        setMarquee({
          x: Math.min(topLeft.x, bottomRight.x),
          y: Math.min(topLeft.y, bottomRight.y),
          width: Math.abs(bottomRight.x - topLeft.x),
          height: Math.abs(bottomRight.y - topLeft.y),
        })
      } else {
        setMarquee(null)
      }

      return
    }

    const current = pointerState.current
    if (!current.active || current.pointerId !== event.pointerId) return

    const dx = event.clientX - current.last.x
    const dy = event.clientY - current.last.y
    current.last = { x: event.clientX, y: event.clientY }

    const { viewport: vp } = useAppStore.getState()
    const delta = screenDeltaToWorld({ x: dx, y: dy }, vp)
    setViewport({ x: vp.x - delta.x, y: vp.y - delta.y })
  }

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    if (
      pendingTextState.current &&
      pendingTextState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = pendingTextState.current
      pendingTextState.current = null
      const node = containerRef.current
      if (node) {
        node.releasePointerCapture(event.pointerId)
      }
      setEditingTextId(state.id)
      event.preventDefault()
      return
    }

    const transform = transformState.current
    if (
      transform &&
      transform.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const node = containerRef.current
      const store = useAppStore.getState()
      const snapConfig = buildSnapOptions({
        enabled: settings.snapEnabled,
        gridSize: SNAP_GRID_SIZE,
        tolerance: SNAP_PIXEL_TOLERANCE,
        viewportScale: store.viewport.scale,
        shapes: store.document.shapes,
        selectionIds,
      })

      if (node) {
        const rect = node.getBoundingClientRect()
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const worldPoint = screenPointToWorld(screenPoint, store.viewport)

        if (transform.mode === 'move') {
          const delta = {
            x: worldPoint.x - transform.startWorld.x,
            y: worldPoint.y - transform.startWorld.y,
          }
          applyTranslation(transform.snapshot, delta, { snap: snapConfig })
          store.commit('Move selection')
        } else if (transform.mode === 'scale') {
          const newBounds = computeScaledBounds(
            transform.handle,
            transform.originalBounds,
            worldPoint,
            event.shiftKey,
          )
          const movingEdges: ScaleMovingEdges = createMovingEdges(
            transform.handle,
          )
          applyScale(transform.snapshot, newBounds, {
            snap: { config: snapConfig, moving: movingEdges },
          })
          store.commit('Resize selection')
        } else {
          const rawAngle =
            Math.atan2(
              worldPoint.y - transform.center.y,
              worldPoint.x - transform.center.x,
            ) - transform.startAngle
          const rotationSnapConfig = {
            ...snapConfig,
            angleStep: ROTATE_SNAP_STEP_RADIANS,
            angleTolerance: ROTATE_SNAP_STEP_RADIANS / 2,
          }
          const rotationResult = applyRotation(
            transform.snapshot,
            rawAngle,
            transform.center,
            {
              snap: rotationSnapConfig,
              shiftSnap: event.shiftKey,
            },
          )
          transform.currentAngle = rotationResult.angle
          store.commit('Rotate selection')
        }

        node.releasePointerCapture(event.pointerId)
      }

      transformState.current = null
      setSnapGuides([])
      event.preventDefault()
      return
    }

    if (
      rectState.current &&
      rectState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = rectState.current
      rectState.current = null
      containerRef.current.releasePointerCapture(event.pointerId)

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport,
        )
        updateRect(state, worldPoint)
      }

      if (
        Math.abs(state.current.x - state.origin.x) < 2 &&
        Math.abs(state.current.y - state.origin.y) < 2
      ) {
        cancelRect(state)
      } else {
        finalizeRect(state)
      }

      setSnapGuides([])
      event.preventDefault()
      return
    }

    if (
      ellipseState.current &&
      ellipseState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = ellipseState.current
      ellipseState.current = null
      containerRef.current.releasePointerCapture(event.pointerId)

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport,
        )
        updateEllipse(state, worldPoint)
      }

      if (
        Math.abs(state.current.x - state.origin.x) < 2 &&
        Math.abs(state.current.y - state.origin.y) < 2
      ) {
        cancelEllipse(state)
      } else {
        finalizeEllipse(state)
      }

      setSnapGuides([])
      event.preventDefault()
      return
    }

    if (
      polylineState.current &&
      polylineState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = polylineState.current
      const node = containerRef.current
      if (node) {
        node.releasePointerCapture(event.pointerId)
        const rect = node.getBoundingClientRect()
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport,
        )
        commitPolylinePoint(state, worldPoint)
        state.pointerId = null
      }
      if (state.tool === 'arrow') {
        finalizePolyline(state)
        polylineState.current = null
      }
      setSnapGuides([])
      event.preventDefault()
      return
    }

    if (
      pathState.current &&
      pathState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = pathState.current
      pathState.current = null
      containerRef.current.releasePointerCapture(event.pointerId)

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport,
        )
        updatePath(state, worldPoint, { force: true })
      }

      finalizePath(state)
      setSnapGuides([])
      event.preventDefault()
      return
    }

    const node = containerRef.current
    const selection = selectionSession.current

    if (
      selection &&
      selection.active &&
      selection.pointerId === event.pointerId
    ) {
      if (node && node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId)
      }

      const store = useAppStore.getState()
      const rect = node?.getBoundingClientRect()
      let worldPoint: Vec2 | null = null

      if (rect) {
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        worldPoint = screenPointToWorld(screenPoint, store.viewport)
      }

      if (selection.moved && selection.worldBounds) {
        const ids = getShapesWithinBounds(shapes, selection.worldBounds).map(
          (shape) => shape.id,
        )
        if (ids.length) {
          select(ids, event.shiftKey ? 'toggle' : 'set')
        } else if (!event.shiftKey) {
          clearSelection()
        }
      } else if (worldPoint) {
        const hit = hitTestShapes(shapes, worldPoint)
        if (hit) {
          select([hit.id], event.shiftKey ? 'toggle' : 'set')
        } else if (!event.shiftKey) {
          clearSelection()
        }
      }

      selectionSession.current = null
      setMarquee(null)
      event.preventDefault()
      return
    }

    if (node && node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId)
    }
    endPan('Pan')
  }

  const handlePointerCancel: PointerEventHandler<HTMLDivElement> = (event) => {
    if (
      transformState.current &&
      transformState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId)
      restoreSnapshot(transformState.current.snapshot)
      transformState.current = null
    }

    if (
      pendingTextState.current &&
      pendingTextState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId)
      cancelTextShape(pendingTextState.current.id)
      pendingTextState.current = null
    }

    if (
      rectState.current &&
      rectState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId)
      cancelRect(rectState.current)
      rectState.current = null
    }

    if (
      ellipseState.current &&
      ellipseState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId)
      cancelEllipse(ellipseState.current)
      ellipseState.current = null
    }

    if (
      polylineState.current &&
      polylineState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId)
      cancelPolyline(polylineState.current)
      polylineState.current = null
    }

    if (
      pathState.current &&
      pathState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId)
      cancelPath(pathState.current)
      pathState.current = null
    }

    selectionSession.current = null
    setMarquee(null)
    pointerState.current.active = false
    pointerState.current.pointerId = null
    document.body.style.cursor = ''
    setSnapGuides([])
  }

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const handleWheel = (event: WheelEvent) => {
      const store = useAppStore.getState()
      const { viewport: vp } = store

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        // Trackpad pan (two-finger drag)
        event.preventDefault()
        const delta = screenDeltaToWorld(
          { x: event.deltaX, y: event.deltaY },
          vp,
        )
        store.setViewport({ x: vp.x + delta.x, y: vp.y + delta.y })
        scheduleCommit('Pan')
        return
      }

      // Zoom gesture (pinch or ctrl+wheel)
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      const cursor: Vec2 = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      const zoomFactor = Math.exp(-event.deltaY * 0.002)
      const nextScale = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, vp.scale * zoomFactor),
      )
      const nextViewport = applyZoomAtPoint(vp, cursor, nextScale)
      store.setViewport(nextViewport)
      scheduleCommit('Zoom')
    }

    node.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      node.removeEventListener('wheel', handleWheel)
    }
  }, [scheduleCommit])

  useEffect(() => {
    return () => {
      window.clearTimeout(commitTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!settings.snapEnabled) {
      setSnapGuides([])
    }
  }, [settings.snapEnabled])

  useEffect(() => {
    if (!contextMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      const menuNode = contextMenuRef.current
      if (menuNode && menuNode.contains(event.target as Node)) {
        return
      }
      setContextMenu(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [contextMenu])

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full overflow-hidden bg-(--color-canvas-bg) transition-colors select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerUp}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {settings.gridVisible ? <GridLayer viewport={viewport} /> : null}

      <GuidesOverlay guides={snapGuides} viewport={viewport} />

      <svg
        className="pointer-events-none absolute inset-0"
        width="100%"
        height="100%"
      >
        {shapeElements}
      </svg>

      <SelectionOverlay
        screenBounds={selectionScreenBounds}
        marquee={marquee}
        onMovePointerDown={handleSelectionMovePointerDown}
        onHandlePointerDown={handleSelectionHandlePointerDown}
        onRotatePointerDown={handleSelectionRotatePointerDown}
      />

      {editingTextShape && textEditorBounds ? (
        <TextEditor
          shape={editingTextShape}
          bounds={textEditorBounds}
          scale={viewport.scale}
          onChange={handleTextChange}
          onCommit={handleTextCommit}
          onCancel={handleTextCancel}
        />
      ) : null}

      {shapeElements.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-(--color-muted-foreground)">
          <p className="text-sm font-medium">
            Canvas viewport placeholder – pan with {panShortcutLabel}, zoom with
            pinch/ctrl+wheel.
          </p>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="pointer-events-auto fixed z-70 min-w-[180px] rounded-lg border border-(--color-elevated-border)/70 bg-(--color-elevated-bg)/95 py-2 shadow-xl backdrop-blur"
          onPointerDown={(event) => {
            // Prevent the canvas pointer logic from hijacking menu clicks
            event.stopPropagation()
          }}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-(--color-app-foreground) transition hover:bg-(--color-button-hover-bg)"
            onClick={() => handleContextAction('forward')}
          >
            Bring forward
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-(--color-app-foreground) transition hover:bg-(--color-button-hover-bg)"
            onClick={() => handleContextAction('backward')}
          >
            Send backward
          </button>
          <div className="my-1 h-px bg-(--color-elevated-border)/60" />
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-(--color-app-foreground) transition hover:bg-(--color-button-hover-bg)"
            onClick={() => handleContextAction('front')}
          >
            Bring to front
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-(--color-app-foreground) transition hover:bg-(--color-button-hover-bg)"
            onClick={() => handleContextAction('back')}
          >
            Send to back
          </button>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-4 rounded border border-(--color-elevated-border) bg-(--color-elevated-bg) px-3 py-2 font-mono text-xs text-(--color-elevated-foreground) shadow-lg backdrop-blur">
        <div>
          Pan: x {viewport.x.toFixed(2)}, y {viewport.y.toFixed(2)}
        </div>
        <div>Zoom: {(viewport.scale * 100).toFixed(0)}%</div>
      </div>
    </div>
  )
}

export default CanvasViewport
