import type { SnapGuide } from '../../services/snap'
import type { Transform, Vec2 } from '../../types'
import { worldPointToScreen } from '../transform'

type GuidesOverlayProps = {
  guides: SnapGuide[]
  viewport: Transform
}

const lineStyle =
  'pointer-events-none absolute bg-(--color-accent)/70 shadow-[0_0_0_1px_rgba(37,99,235,0.4)]'

const labelStyle =
  'pointer-events-none absolute rounded bg-(--color-accent)/80 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow'

const GuidesOverlay = ({ guides, viewport }: GuidesOverlayProps) => {
  if (!guides.length) return null

  const toScreen = (point: Vec2) => worldPointToScreen(point, viewport)

  return (
    <div className="pointer-events-none absolute inset-0">
      {guides.map((guide, index) => {
        if (guide.kind === 'line') {
          const startWorld =
            guide.axis === 'x'
              ? { x: guide.position, y: guide.start }
              : { x: guide.start, y: guide.position }
          const endWorld =
            guide.axis === 'x'
              ? { x: guide.position, y: guide.end }
              : { x: guide.end, y: guide.position }

          const start = toScreen(startWorld)
          const end = toScreen(endWorld)

          if (guide.axis === 'x') {
            const top = Math.min(start.y, end.y)
            const height = Math.abs(end.y - start.y) || 1
            const left = Math.round(start.x) - 1
            const labelTop = top + height / 2 - 10
            return (
              <div key={`guide-${index}`}>
                <div
                  className={lineStyle}
                  style={{
                    left,
                    top,
                    width: 2,
                    height,
                  }}
                />
                {guide.label ? (
                  <span
                    className={labelStyle}
                    style={{
                      left: left + 6,
                      top: labelTop,
                    }}
                  >
                    {guide.label}
                  </span>
                ) : null}
              </div>
            )
          }

          const left = Math.min(start.x, end.x)
          const width = Math.abs(end.x - start.x) || 1
          const top = Math.round(start.y) - 1
          const labelLeft = left + width / 2 - 12
          return (
            <div key={`guide-${index}`}>
              <div
                className={lineStyle}
                style={{
                  left,
                  top,
                  width,
                  height: 2,
                }}
              />
              {guide.label ? (
                <span
                  className={labelStyle}
                  style={{
                    left: labelLeft,
                    top: top - 18,
                  }}
                >
                  {guide.label}
                </span>
              ) : null}
            </div>
          )
        }

        const center = toScreen(guide.center)
        return (
          <span
            key={`guide-angle-${index}`}
            className={labelStyle}
            style={{
              left: center.x + 8,
              top: center.y - 20,
            }}
          >
            {guide.label}
          </span>
        )
      })}
    </div>
  )
}

export default GuidesOverlay
