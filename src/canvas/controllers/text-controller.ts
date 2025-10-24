import type { Vec2 } from '../../types'
import { createShapeId, useAppStore } from '../../state/store'
import { getDefaultTextColor } from '../../utils/theme-colors'
import { updateTextShapeBounds } from '../../utils/text-measure'

export type TextCreationState = {
  id: string
  pointerId: number
  createdAt: number
}

const DEFAULT_TEXT_BOX = { x: 220, y: 120 }
const DEFAULT_FONT = {
  family: 'Inter',
  weight: 500,
  size: 20,
} as const

export const beginText = (
  point: Vec2,
  pointerId: number,
): TextCreationState => {
  const timestamp = Date.now()
  const id = createShapeId()
  const store = useAppStore.getState()
  const textColor = getDefaultTextColor()

  store.addShape({
    id,
    type: 'text',
    position: point,
    box: { ...DEFAULT_TEXT_BOX },
    rotation: 0,
    zIndex: timestamp,
    stroke: textColor,
    strokeWidth: 1,
    fill: textColor,
    text: '',
    font: {
      family: DEFAULT_FONT.family,
      weight: DEFAULT_FONT.weight,
      size: DEFAULT_FONT.size,
    },
    letterSpacing: 0,
    lineHeight: 1.4,
    align: 'left',
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  store.select([id], 'set')

  return {
    id,
    pointerId,
    createdAt: timestamp,
  }
}

export const cancelText = (id: string, label = 'Cancel text') => {
  const store = useAppStore.getState()
  const exists = store.document.shapes.find((shape) => shape.id === id)
  if (!exists) return

  store.deleteShapes([id])
  store.clearSelection()
  store.commit(label)
  store.setTool('select')
}

export const finalizeText = (id: string, label = 'Insert text') => {
  const store = useAppStore.getState()
  const shape = store.document.shapes.find((item) => item.id === id)
  if (!shape || shape.type !== 'text') {
    return
  }

  const content = shape.text.trim()
  if (!content.length) {
    cancelText(id, 'Cancel text')
    return
  }

  store.updateShape(id, (target) => {
    if (target.type !== 'text') return
    updateTextShapeBounds(target)
  })
  store.select([id], 'set')
  store.commit(label)
  store.setTool('select')
}
