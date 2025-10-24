import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import type { TextShape } from '../types'
import { sanitizePlainText } from '../security/sanitize'

type TextEditorProps = {
  shape: TextShape
  bounds: {
    left: number
    top: number
    width: number
    height: number
  }
  scale: number
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}

const TextEditor = ({
  shape,
  bounds,
  scale,
  onChange,
  onCommit,
  onCancel,
}: TextEditorProps) => {
  const [value, setValue] = useState(shape.text)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    setValue(shape.text)
    committedRef.current = false
  }, [shape.id, shape.text])

  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    const focus = () => {
      node.focus({ preventScroll: true })
      node.select()
    }
    const id = window.requestAnimationFrame(focus)
    return () => {
      window.cancelAnimationFrame(id)
    }
  }, [shape.id])

  const commit = useCallback(() => {
    if (committedRef.current) return
    committedRef.current = true
    onCommit()
  }, [onCommit])

  const cancel = useCallback(() => {
    if (committedRef.current) return
    committedRef.current = true
    onCancel()
  }, [onCancel])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      const sanitized = sanitizePlainText(next)
      setValue(sanitized)
      onChange(sanitized)
    },
    [onChange],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        commit()
      }
    },
    [cancel, commit],
  )

  const textColor = useMemo(() => {
    const color = shape.fill ?? shape.stroke
    if (!color) return undefined
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${
      typeof color.a === 'number' ? color.a : 1
    })`
  }, [shape.fill, shape.stroke])

  const styles = useMemo<CSSProperties>(
    () => ({
      fontFamily: shape.font.family,
      fontWeight: shape.font.weight,
      fontSize: `${shape.font.size * scale}px`,
      letterSpacing:
        shape.letterSpacing !== undefined
          ? `${shape.letterSpacing}px`
          : undefined,
      lineHeight: shape.lineHeight ?? undefined,
      textAlign: shape.align ?? 'left',
      color: textColor,
      fontStyle: shape.italic ? 'italic' : undefined,
      textDecoration: shape.underline ? 'underline' : undefined,
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      padding: 0,
    }),
    [
      scale,
      shape.align,
      shape.font.family,
      shape.font.size,
      shape.font.weight,
      shape.italic,
      shape.letterSpacing,
      shape.lineHeight,
      shape.underline,
      textColor,
    ],
  )

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      <textarea
        ref={textareaRef}
        className="pointer-events-auto h-full w-full resize-none rounded-none border-none bg-transparent p-0 text-[inherit] focus:outline-none"
        style={styles}
        value={value}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onPointerDown={(event: PointerEvent<HTMLTextAreaElement>) => {
          event.stopPropagation()
        }}
        spellCheck
      />
    </div>
  )
}

export default TextEditor
