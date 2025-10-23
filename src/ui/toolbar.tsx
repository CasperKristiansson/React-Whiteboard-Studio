import clsx from 'clsx'
import { useCallback, useMemo, type ChangeEvent } from 'react'
import type { IconType } from 'react-icons'
import {
  LuPointer,
  LuSquare,
  LuCircle,
  LuPenLine,
  LuArrowUpRight,
  LuPenTool,
  LuType,
  LuImage,
  LuItalic,
  LuUnderline,
  LuAlignLeft,
  LuAlignCenter,
  LuAlignRight,
} from 'react-icons/lu'

import type { Tool } from '../state/store'
import {
  selectActiveTool,
  selectSelection,
  selectShapes,
  useAppSelector,
  useAppStore,
} from '../state/store'
import type { TextShape } from '../types'
import { updateTextShapeBounds } from '../utils/text-measure'

const TOOL_OPTIONS: { value: Tool; label: string; shortcut: string; icon: IconType }[] = [
  { value: 'select', label: 'Select', shortcut: 'V', icon: LuPointer },
  { value: 'rect', label: 'Rectangle', shortcut: 'R', icon: LuSquare },
  { value: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: LuCircle },
  { value: 'line', label: 'Line', shortcut: 'L', icon: LuPenLine },
  { value: 'arrow', label: 'Arrow', shortcut: 'A', icon: LuArrowUpRight },
  { value: 'path', label: 'Path', shortcut: 'P', icon: LuPenTool },
  { value: 'text', label: 'Text', shortcut: 'T', icon: LuType },
  { value: 'image', label: 'Image', shortcut: 'I', icon: LuImage },
]

const ToolbarButton = ({
  value,
  label,
  shortcut,
  icon: Icon,
  active,
  onSelect,
}: {
  value: Tool
  label: string
  shortcut: string
  icon: IconType
  active: boolean
  onSelect: (tool: Tool) => void
}) => {
  return (
    <button
      type="button"
      className={clsx(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
        active
          ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow-sm'
          : 'border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
      )}
      aria-pressed={active}
      aria-label={`${label} tool (${shortcut})`}
      onClick={() => onSelect(value)}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
      <kbd className="ml-auto rounded bg-(--color-accent)/10 px-1 text-[0.7rem] text-(--color-accent)">
        {shortcut}
      </kbd>
    </button>
  )
}

const getSharedValue = <T,>(
  shapes: TextShape[],
  accessor: (shape: TextShape) => T,
): T | undefined => {
  if (!shapes.length) return undefined
  const first = accessor(shapes[0])
  for (let index = 1; index < shapes.length; index += 1) {
    if (accessor(shapes[index]) !== first) {
      return undefined
    }
  }
  return first
}

const Toolbar = () => {
  const activeTool = useAppSelector(selectActiveTool)
  const selectionIds = useAppSelector(selectSelection)
  const shapes = useAppSelector(selectShapes)
  const setTool = useAppStore((state) => state.setTool)
  const updateShape = useAppStore((state) => state.updateShape)
  const commit = useAppStore((state) => state.commit)

  const textSelection = useMemo(
    () =>
      shapes.filter(
        (shape): shape is TextShape =>
          shape.type === 'text' && selectionIds.includes(shape.id),
      ),
    [selectionIds, shapes],
  )

  const sharedFontFamily = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.font.family),
    [textSelection],
  )
  const sharedFontSize = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.font.size),
    [textSelection],
  )
  const sharedFontWeight = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.font.weight),
    [textSelection],
  )
  const sharedLetterSpacing = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.letterSpacing ?? 0),
    [textSelection],
  )
  const sharedLineHeight = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.lineHeight ?? 1.4),
    [textSelection],
  )
  const sharedItalic = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.italic ?? false),
    [textSelection],
  )
  const sharedUnderline = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.underline ?? false),
    [textSelection],
  )
  const sharedAlign = useMemo(
    () => getSharedValue(textSelection, (shape) => shape.align ?? 'left'),
    [textSelection],
  )

  const applyTextStyle = useCallback(
    (label: string, updater: (shape: TextShape) => void) => {
      if (!textSelection.length) return
      textSelection.forEach((textShape) => {
        updateShape(textShape.id, (draft) => {
          if (draft.type !== 'text') return
          updater(draft)
        })
      })
      commit(label, { squash: true })
    },
    [commit, textSelection, updateShape],
  )

  const handleFontFamilyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      applyTextStyle('Change font family', (shape) => {
        shape.font.family = value || shape.font.family
        updateTextShapeBounds(shape)
      })
    },
    [applyTextStyle],
  )

  const handleFontSizeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      const next = Math.max(4, Math.min(512, value))
      applyTextStyle('Change font size', (shape) => {
        shape.font.size = next
        updateTextShapeBounds(shape)
      })
    },
    [applyTextStyle],
  )

  const handleFontWeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(event.target.value, 10)
      if (Number.isNaN(value)) return
      const next = Math.max(100, Math.min(900, value))
      applyTextStyle('Change font weight', (shape) => {
        shape.font.weight = next
        updateTextShapeBounds(shape)
      })
    },
    [applyTextStyle],
  )

  const handleLetterSpacingChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      applyTextStyle('Change letter spacing', (shape) => {
        shape.letterSpacing = value
        updateTextShapeBounds(shape)
      })
    },
    [applyTextStyle],
  )

  const handleLineHeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(event.target.value)
      if (Number.isNaN(value)) return
      const next = Math.max(0.5, Math.min(5, value))
      applyTextStyle('Change line height', (shape) => {
        shape.lineHeight = next
        updateTextShapeBounds(shape)
      })
    },
    [applyTextStyle],
  )

  const handleItalicToggle = useCallback(() => {
    const next = !(sharedItalic ?? false)
    applyTextStyle('Toggle italic', (shape) => {
      shape.italic = next
      updateTextShapeBounds(shape)
    })
  }, [applyTextStyle, sharedItalic])

  const handleUnderlineToggle = useCallback(() => {
    const next = !(sharedUnderline ?? false)
    applyTextStyle('Toggle underline', (shape) => {
      shape.underline = next
    })
  }, [applyTextStyle, sharedUnderline])

  const handleAlignChange = useCallback(
    (align: NonNullable<TextShape['align']>) => {
      applyTextStyle('Change text alignment', (shape) => {
        shape.align = align
      })
    },
    [applyTextStyle],
  )

  const showTextControls = textSelection.length > 0
  const italicMixed = sharedItalic === undefined
  const underlineMixed = sharedUnderline === undefined
  const alignValue = sharedAlign ?? 'left'

  return (
    <nav
      className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-(--color-elevated-border) bg-(--color-elevated-bg) px-4 py-3 shadow backdrop-blur"
      aria-label="Drawing tools"
    >
      {TOOL_OPTIONS.map((tool) => (
        <ToolbarButton
          key={tool.value}
          value={tool.value}
          label={tool.label}
          shortcut={tool.shortcut}
          icon={tool.icon}
          active={tool.value === activeTool}
          onSelect={setTool}
        />
      ))}
      {showTextControls ? (
        <div className="mt-3 w-full border-t border-(--color-elevated-border)/70 pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Font family
              </span>
              <input
                type="text"
                className="rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                value={sharedFontFamily ?? ''}
                placeholder={
                  sharedFontFamily === undefined ? 'Mixed' : undefined
                }
                onChange={handleFontFamilyChange}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Size
              </span>
              <input
                type="number"
                min="4"
                max="512"
                step="1"
                className="rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                value={sharedFontSize ?? ''}
                placeholder={sharedFontSize === undefined ? 'Mixed' : undefined}
                onChange={handleFontSizeChange}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Weight
              </span>
              <input
                type="number"
                min="100"
                max="900"
                step="100"
                className="rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                value={sharedFontWeight ?? ''}
                placeholder={
                  sharedFontWeight === undefined ? 'Mixed' : undefined
                }
                onChange={handleFontWeightChange}
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Letter spacing
              </span>
              <input
                type="number"
                step="0.1"
                className="rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                value={sharedLetterSpacing ?? ''}
                placeholder={
                  sharedLetterSpacing === undefined ? 'Mixed' : undefined
                }
                onChange={handleLetterSpacingChange}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-muted-foreground)">
                Line height
              </span>
              <input
                type="number"
                min="0.5"
                max="5"
                step="0.1"
                className="rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs font-medium text-(--color-app-foreground)"
                value={sharedLineHeight ?? ''}
                placeholder={
                  sharedLineHeight === undefined ? 'Mixed' : undefined
                }
                onChange={handleLineHeightChange}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={clsx(
                'flex items-center gap-2 rounded border px-2 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                sharedItalic
                  ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text)'
                  : 'border-(--color-elevated-border) bg-(--color-button-bg) text-(--color-button-muted-text)',
              )}
              onClick={handleItalicToggle}
            >
              <LuItalic className="h-3.5 w-3.5" /> Italic{italicMixed ? ' (mixed)' : ''}
            </button>
            <button
              type="button"
              className={clsx(
                'flex items-center gap-2 rounded border px-2 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                sharedUnderline
                  ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text)'
                  : 'border-(--color-elevated-border) bg-(--color-button-bg) text-(--color-button-muted-text)',
              )}
              onClick={handleUnderlineToggle}
            >
              <LuUnderline className="h-3.5 w-3.5" /> Underline{underlineMixed ? ' (mixed)' : ''}
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={clsx(
                  'flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                  alignValue === 'left'
                    ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text)'
                    : 'border-(--color-elevated-border) bg-(--color-button-bg) text-(--color-button-muted-text)',
                )}
                onClick={() => handleAlignChange('left')}
              >
                <LuAlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={clsx(
                  'flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                  alignValue === 'center'
                    ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text)'
                    : 'border-(--color-elevated-border) bg-(--color-button-bg) text-(--color-button-muted-text)',
                )}
                onClick={() => handleAlignChange('center')}
              >
                <LuAlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={clsx(
                  'flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                  alignValue === 'right'
                    ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text)'
                    : 'border-(--color-elevated-border) bg-(--color-button-bg) text-(--color-button-muted-text)',
                )}
                onClick={() => handleAlignChange('right')}
              >
                <LuAlignRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  )
}

export default Toolbar
