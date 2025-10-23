export type AppErrorCode =
  | 'PersistenceError'
  | 'ValidationError'
  | 'AssetError'
  | 'ImportError'
  | 'ExportError'
  | 'Unsupported'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly cause?: unknown

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

export const toAppError = (
  error: unknown,
  fallback: AppErrorCode,
  message: string,
) => {
  if (error instanceof AppError) return error
  return new AppError(fallback, message, error)
}
