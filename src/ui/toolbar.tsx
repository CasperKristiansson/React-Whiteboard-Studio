import clsx from 'clsx'

import type { Tool } from '../state/store'
import { selectActiveTool, useAppSelector, useAppStore } from '../state/store'

const TOOL_OPTIONS: { value: Tool; label: string; shortcut: string }[] = [
  { value: 'select', label: 'Select', shortcut: 'V' },
  { value: 'rect', label: 'Rectangle', shortcut: 'R' },
  { value: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { value: 'line', label: 'Line', shortcut: 'L' },
  { value: 'arrow', label: 'Arrow', shortcut: 'A' },
  { value: 'path', label: 'Path', shortcut: 'P' },
  { value: 'text', label: 'Text', shortcut: 'T' },
  { value: 'image', label: 'Image', shortcut: 'I' },
]

const ToolbarButton = ({
  value,
  label,
  shortcut,
  active,
  onSelect,
}: {
  value: Tool
  label: string
  shortcut: string
  active: boolean
  onSelect: (tool: Tool) => void
}) => {
  return (
    <button
      type="button"
      className={clsx(
    'flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
        active
          ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow-sm'
          : 'border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
      )}
      aria-pressed={active}
      aria-label={`${label} tool (${shortcut})`}
      onClick={() => onSelect(value)}
    >
      <span className="text-sm">{label}</span>
      <kbd className={clsx('rounded bg-(--color-accent)/10 px-1 text-[0.7rem] text-(--color-accent)')}>{shortcut}</kbd>
    </button>
  )
}

const Toolbar = () => {
  const activeTool = useAppSelector(selectActiveTool)
  const setTool = useAppStore((state) => state.setTool)

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
          active={tool.value === activeTool}
          onSelect={setTool}
        />
      ))}
    </nav>
  )
}

export default Toolbar
