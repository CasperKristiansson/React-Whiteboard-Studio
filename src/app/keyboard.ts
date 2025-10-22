import { useEffect } from 'react'

import { type Tool, useAppStore } from '../state/store'

const TOOL_KEYMAP: Record<string, Tool> = {
  v: 'select',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  p: 'path',
  t: 'text',
  i: 'image',
}

const isTextInput = (target: EventTarget | null): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (target.isContentEditable) return true
  if (target.getAttribute('role') === 'textbox') return true
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

const isModifierPressed = (event: KeyboardEvent) => event.metaKey || event.ctrlKey

export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return

      if (isTextInput(event.target)) {
        return
      }

      const store = useAppStore.getState()
      const key = event.key.toLowerCase()

      if (isModifierPressed(event)) {
        if (key === 'z') {
          event.preventDefault()
          if (event.shiftKey) {
            store.redo()
          } else {
            store.undo()
          }
          return
        }

        if (!event.shiftKey && key === 'y') {
          event.preventDefault()
          store.redo()
          return
        }

        if (key === 'd') {
          event.preventDefault()
          store.duplicateSelection()
          const updated = useAppStore.getState()
          if (updated.history.pending) {
            updated.commit('Duplicate')
          }
          return
        }
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const selected = store.selection
          if (selected.length) {
            event.preventDefault()
            store.deleteShapes([...selected])
            const updated = useAppStore.getState()
            if (updated.history.pending) {
              updated.commit('Delete')
            }
          }
          return
        }

        const tool = TOOL_KEYMAP[key]
        if (tool) {
          store.setTool(tool)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}

export default useKeyboardShortcuts
