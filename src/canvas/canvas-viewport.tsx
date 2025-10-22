import {
  useCallback,
  useEffect,
  useRef,
  type PointerEventHandler,
} from 'react'

import { applyZoomAtPoint, screenDeltaToWorld } from './transform'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  selectViewport,
  useAppSelector,
  useAppStore,
} from '../state/store'
import type { Vec2 } from '../types'

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
  const viewport = useAppSelector(selectViewport)
  const setViewport = useAppStore((state) => state.setViewport)
  const commit = useAppStore((state) => state.commit)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const pointerState = useRef<PointerState>({ ...initialPointerState })
  const spacePressed = useRef(false)
  const commitTimer = useRef<number | undefined>(undefined)

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

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
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
    if (!spacePressed.current && event.pointerType !== 'touch') return

    const node = containerRef.current
    if (!node) return

    node.setPointerCapture(event.pointerId)
    pointerState.current = {
      active: true,
      pointerId: event.pointerId,
      last: { x: event.clientX, y: event.clientY },
    }
    document.body.style.cursor = 'grabbing'
    event.preventDefault()
  }

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
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
    const node = containerRef.current
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
      className="relative flex h-[520px] w-full flex-1 select-none overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-slate-600">
        <p className="text-sm font-medium">
          Canvas viewport placeholder – pan with Space + drag, zoom with pinch/ctrl+wheel.
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded bg-slate-800/80 px-3 py-2 text-xs font-mono text-slate-200 shadow-lg">
        <div>Pan: x {viewport.x.toFixed(2)}, y {viewport.y.toFixed(2)}</div>
        <div>Zoom: {(viewport.scale * 100).toFixed(0)}%</div>
      </div>
    </div>
  )
}

export default CanvasViewport
