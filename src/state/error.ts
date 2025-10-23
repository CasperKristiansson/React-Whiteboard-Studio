import { create } from 'zustand'

import type { AppErrorCode } from '../errors'
import { AppError } from '../errors'

export type ErrorEntry = {
  id: string
  code: AppErrorCode
  message: string
  timestamp: number
}

type ErrorStore = {
  errors: ErrorEntry[]
  push: (error: AppError) => void
  dismiss: (id: string) => void
  clear: () => void
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `error-${Math.random().toString(36).slice(2)}-${Date.now()}`

export const useErrorStore = create<ErrorStore>((set) => ({
  errors: [],
  push: (error) => {
    set((state) => ({
      errors: [
        {
          id: createId(),
          code: error.code,
          message: error.message,
          timestamp: Date.now(),
        },
        ...state.errors,
      ].slice(0, 5),
    }))
  },
  dismiss: (id) => {
    set((state) => ({
      errors: state.errors.filter((error) => error.id !== id),
    }))
  },
  clear: () => set({ errors: [] }),
}))
