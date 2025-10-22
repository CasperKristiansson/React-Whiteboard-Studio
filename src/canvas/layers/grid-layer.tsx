import type { CSSProperties } from 'react'

import type { Transform } from '../../types'

type GridLayerProps = {
  viewport: Transform
  spacing?: number
}

const normalizeOffset = (value: number, spacing: number) => {
  const normalized = value % spacing
  return normalized >= 0 ? normalized : normalized + spacing
}

const GridLayer = ({ viewport, spacing = 5 }: GridLayerProps) => {
  const screenSpacing = spacing * viewport.scale

  if (screenSpacing < 2) {
    return null
  }

  const offsetX = normalizeOffset(-viewport.x * viewport.scale, screenSpacing)
  const offsetY = normalizeOffset(-viewport.y * viewport.scale, screenSpacing)

  const style: CSSProperties = {
    backgroundSize: `${screenSpacing}px ${screenSpacing}px`,
    backgroundPosition: `${offsetX}px ${offsetY}px`,
    backgroundImage:
      'linear-gradient(to right, rgba(100,116,139,0.18) 1px, transparent 1px), ' +
      'linear-gradient(to bottom, rgba(100,116,139,0.18) 1px, transparent 1px)',
  }

  return <div className="absolute inset-0 pointer-events-none" style={style} />
}

export default GridLayer
