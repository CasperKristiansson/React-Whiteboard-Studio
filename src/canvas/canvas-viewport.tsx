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
import type { Shape, Vec2 } from '../types'
import GridLayer from './layers/grid-layer'
import SelectionOverlay, {
  type ScreenRect,
} from './overlays/selection-overlay'
import {
  createWorldMarquee,
  getShapesWithinBounds,
  hitTestShapes,
} from '../services/hittest'
import type { ShapeBounds } from '../services/geometry'
import {
  beginRect,
  cancelRect,
  finalizeRect,
  updateRect,
  type RectDragState,
} from './controllers/rect-controller'

const PAN_COMMIT_DELAY = 120

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

const initialPointerState: PointerState = {
  active: false,
  pointerId: null,
  last: { x: 0, y: 0 },
}

export const CanvasViewport = () => {
  const activeTool = useAppSelector(selectActiveTool)
  const viewport = useAppSelector(selectViewport)
  const settings = useAppSelector(selectSettings)
  const shapes = useAppSelector(selectShapes)
  const selectionIds = useAppSelector(selectSelection)
  const setViewport = useAppStore((state) => state.setViewport)
  const commit = useAppStore((state) => state.commit)
  const setSettings = useAppStore((state) => state.setSettings)
  const select = useAppStore((state) => state.select)
  const clearSelection = useAppStore((state) => state.clearSelection)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const pointerState = useRef<PointerState>({ ...initialPointerState })
  const spacePressed = useRef(false)
  const commitTimer = useRef<number | undefined>(undefined)
  const selectionSession = useRef<
    | {
        active: boolean
        pointerId: number | null
        originWorld: Vec2
        originScreen: Vec2
        currentWorld: Vec2
        worldBounds: ShapeBounds | null
      moved: boolean
    }
    | null
  >(null)
  const [marquee, setMarquee] = useState<ScreenRect | null>(null)
  const rectState = useRef<RectDragState | null>(null)

  const selectedShapes = useMemo<Shape[]>(
    () => shapes.filter((shape) => selectionIds.includes(shape.id)),
    [shapes, selectionIds],
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (isTextInput(event.target)) return
      if (spacePressed.current) return
      spacePressed.current = true
      event.preventDefault()
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spacePressed.current = false
    }

    const handleKeyDownWithEscape = (event: KeyboardEvent) => {
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

      handleKeyDown(event)
    }

    window.addEventListener('keydown', handleKeyDownWithEscape, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDownWithEscape, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [])

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

    const rect = node.getBoundingClientRect()
    const screenPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const worldPoint = screenPointToWorld(screenPoint, useAppStore.getState().viewport)

    if (activeTool === 'rect') {
      const state = beginRect(worldPoint, event.pointerId)
      rectState.current = state
      updateRect(state, worldPoint)
      node.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    const shouldPan =
      spacePressed.current || event.pointerType === 'touch' || activeTool !== 'select'

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

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (rectState.current && containerRef.current) {
      const state = rectState.current
      const node = containerRef.current
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect()
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const worldPoint = screenPointToWorld(screenPoint, useAppStore.getState().viewport)
        updateRect(state, worldPoint)
        event.preventDefault()
        return
      }
    }

    const node = containerRef.current
    const selection = selectionSession.current
    if (selection && selection.active && selection.pointerId === event.pointerId && node) {
      const rect = node.getBoundingClientRect()
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const worldPoint = screenPointToWorld(screenPoint, useAppStore.getState().viewport)

      selection.currentWorld = worldPoint

      const distance = Math.hypot(
        event.clientX - selection.originScreen.x,
        event.clientY - selection.originScreen.y,
      )
      if (!selection.moved && distance > 4) {
        selection.moved = true
      }

      if (selection.moved) {
        const bounds = createWorldMarquee(selection.originWorld, selection.currentWorld)
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
      rectState.current &&
      rectState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = rectState.current
      rectState.current = null
      containerRef.current.releasePointerCapture(event.pointerId)

      if (Math.abs(state.current.x - state.origin.x) < 2 && Math.abs(state.current.y - state.origin.y) < 2) {
        cancelRect(state)
      } else {
        finalizeRect(state)
      }

      event.preventDefault()
      return
    }

    const node = containerRef.current
    const selection = selectionSession.current

    if (selection && selection.active && selection.pointerId === event.pointerId) {
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

  return (
    <div
      ref={containerRef}
      className="relative flex h-[520px] w-full flex-1 select-none overflow-hidden rounded-xl border border-(--color-elevated-border) bg-(--color-canvas-bg) backdrop-blur-sm transition-colors"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {settings.gridVisible ? <GridLayer viewport={viewport} /> : null}

      <SelectionOverlay
        selectedShapes={selectedShapes}
        viewport={viewport}
        marquee={marquee}
      />

      <div className="pointer-events-none absolute inset-0 grid place-items-center text-(--color-muted-foreground)">
        <p className="text-sm font-medium">
          Canvas viewport placeholder – pan with Space + drag, zoom with pinch/ctrl+wheel.
        </p>
      </div>

      <div className="absolute bottom-4 left-4 rounded border border-(--color-elevated-border) bg-(--color-elevated-bg) px-3 py-2 text-xs font-mono text-(--color-elevated-foreground) shadow-lg backdrop-blur">
        <div>Pan: x {viewport.x.toFixed(2)}, y {viewport.y.toFixed(2)}</div>
        <div>Zoom: {(viewport.scale * 100).toFixed(0)}%</div>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSettings({ gridVisible: !settings.gridVisible })}
          className="rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          aria-pressed={settings.gridVisible}
          aria-label={settings.gridVisible ? 'Hide grid' : 'Show grid'}
        >
          {settings.gridVisible ? 'Hide grid' : 'Show grid'}
        </button>
      </div>
    </div>
  )
}

export default CanvasViewport
