import { useCallback, useState, useRef, type ChangeEvent } from 'react'
import clsx from 'clsx'

import { importProjectFromJson } from '../import/json'
import { selectProjectId, useAppSelector, useAppStore } from '../state/store'
import { useErrorStore } from '../state/error'
import { toAppError } from '../errors'
import { LuUpload } from 'react-icons/lu'

const ImportDialog = ({ disabled = false }: { disabled?: boolean }) => {
  const projectId = useAppSelector(selectProjectId)
  const replaceDocument = useAppStore((state) => state.replaceDocument)
  const markClean = useAppStore((state) => state.markClean)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pushError = useErrorStore((state) => state.push)

  const [isImporting, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTrigger = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!projectId) {
        setError('No project loaded.')
        return
      }

      const file = event.target.files?.[0]
      if (!file) return

      setImporting(true)
      setMessage(null)
      setError(null)

      try {
        const document = await importProjectFromJson(projectId, file)
        replaceDocument(document)
        markClean()
        setMessage('Import successful')
      } catch (err) {
        const appError = toAppError(
          err,
          'ImportError',
          'Failed to import file. Make sure it was exported from this app.',
        )
        pushError(appError)
        setError(appError.message)
      } finally {
        setImporting(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [markClean, projectId, pushError, replaceDocument],
  )

  return (
    <section
      className={clsx(
        'rounded-3xl border border-(--color-elevated-border) bg-(--color-elevated-bg) p-4 shadow',
        disabled && 'opacity-60',
      )}
      aria-disabled={disabled}
    >
      <header className="mb-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-(--color-app-foreground)">
            Import
          </h2>
          <p className="text-xs text-(--color-muted-foreground)">
            Restore a project from a `.wb.json` export.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTrigger}
          className="flex w-full items-center justify-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || !projectId || isImporting}
        >
          <LuUpload className="h-4 w-4" />
          {isImporting ? 'Importing…' : 'Import .wb.json'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          disabled={disabled}
          onChange={handleFileChange}
        />
      </header>

      {message ? <p className="text-xs text-green-500">{message}</p> : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </section>
  )
}

export default ImportDialog
