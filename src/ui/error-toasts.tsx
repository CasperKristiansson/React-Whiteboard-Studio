import { useEffect } from 'react'

import { useErrorStore } from '../state/error'

const ErrorToasts = () => {
  const errors = useErrorStore((state) => state.errors)
  const dismiss = useErrorStore((state) => state.dismiss)

  useEffect(() => {
    if (!errors.length) return
    const timers = errors.map((error) =>
      window.setTimeout(() => dismiss(error.id), 6000),
    )
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismiss, errors])

  if (!errors.length) return null

  return (
    <div className="pointer-events-none fixed right-6 bottom-6 flex w-72 flex-col gap-2">
      {errors.map((error) => (
        <div
          key={error.id}
          className="pointer-events-auto rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs text-red-200 shadow-lg backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <strong className="tracking-wide uppercase">{error.code}</strong>
            <button
              type="button"
              className="text-red-200/80 hover:text-red-100"
              onClick={() => dismiss(error.id)}
            >
              ×
            </button>
          </div>
          <p className="mt-1 text-[11px]">{error.message}</p>
        </div>
      ))}
    </div>
  )
}

export default ErrorToasts
