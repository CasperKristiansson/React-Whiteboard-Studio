import { useEffect, useRef, useState } from 'react'

import {
  selectDirty,
  selectDocument,
  selectSelection,
  selectViewport,
  useAppSelector,
} from '../state/store'

type DebugOverlayProps = {
  enabled: boolean
}

const DebugOverlay = ({ enabled }: DebugOverlayProps) => {
  const shapeCount = useAppSelector(
    (state) => selectDocument(state).shapes.length,
  )
  const selection = useAppSelector(selectSelection)
  const viewport = useAppSelector(selectViewport)
  const dirty = useAppSelector(selectDirty)

  const [fps, setFps] = useState(0)
  const frame = useRef<number | null>(null)
  const lastTimestamp = useRef(
    typeof performance !== 'undefined' ? performance.now() : 0,
  )

  useEffect(() => {
    if (!enabled) {
      setFps(0)
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current)
        frame.current = null
      }
      return undefined
    }

    const tick = (timestamp: number) => {
      const delta = timestamp - lastTimestamp.current
      lastTimestamp.current = timestamp
      const nextFps = delta > 0 ? Math.min(999, Math.round(1000 / delta)) : 0
      setFps((prev) =>
        Number.isFinite(nextFps)
          ? Math.round(prev * 0.8 + nextFps * 0.2 || nextFps)
          : prev,
      )
      frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <aside className="pointer-events-none fixed bottom-6 left-6 rounded-lg border border-(--color-elevated-border) bg-(--color-elevated-bg)/90 px-4 py-3 font-mono text-xs text-(--color-elevated-foreground) shadow-lg backdrop-blur">
      <div>FPS: {fps}</div>
      <div>Shapes: {shapeCount}</div>
      <div>Selection: {selection.length}</div>
      <div>
        Viewport: x {viewport.x.toFixed(1)} y {viewport.y.toFixed(1)} scale{' '}
        {(viewport.scale * 100).toFixed(0)}%
      </div>
      <div>Dirty: {dirty ? 'yes' : 'no'}</div>
    </aside>
  )
}

export default DebugOverlay
