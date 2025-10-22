import type { DocumentV1, UUID } from '../types'

export const HISTORY_CAPACITY = 200

export type HistoryEntry = {
  document: DocumentV1
  selection: UUID[]
  label: string
  at: number
}

export type HistoryState = {
  past: HistoryEntry[]
  future: HistoryEntry[]
  pending: HistoryEntry | null
  capacity: number
}

const hasStructuredClone = typeof structuredClone === 'function'

export const cloneDocument = (document: DocumentV1): DocumentV1 => {
  if (hasStructuredClone) {
    return structuredClone(document)
  }

  return JSON.parse(JSON.stringify(document)) as DocumentV1
}

export const cloneSelection = (selection: UUID[]): UUID[] => [...selection]

export const createHistoryEntry = (
  document: DocumentV1,
  selection: UUID[],
  label = '',
): HistoryEntry => ({
  document: cloneDocument(document),
  selection: cloneSelection(selection),
  label,
  at: Date.now(),
})

export const createHistoryState = (
  capacity = HISTORY_CAPACITY,
): HistoryState => ({
  past: [],
  future: [],
  pending: null,
  capacity,
})
