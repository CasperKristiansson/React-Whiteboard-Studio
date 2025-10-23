export const mark = (label: string) => {
  if (typeof performance !== 'undefined' && 'mark' in performance) {
    performance.mark(label)
  }
}

export const measure = (name: string, start: string, end: string) => {
  if (typeof performance === 'undefined' || !('measure' in performance)) return
  try {
    performance.measure(name, start, end)
  } catch {
    // ignore invalid marks
  }
}

export const clearMarks = (label?: string) => {
  if (typeof performance !== 'undefined' && 'clearMarks' in performance) {
    performance.clearMarks(label)
  }
}

export const clearMeasures = (label?: string) => {
  if (typeof performance !== 'undefined' && 'clearMeasures' in performance) {
    performance.clearMeasures(label)
  }
}
