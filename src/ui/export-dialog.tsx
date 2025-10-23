import { useCallback, useMemo, useState } from 'react'

import { exportProjectToJson } from '../export/json'
import {
  selectDocument,
  selectProjectId,
  useAppSelector,
} from '../state/store'

const sanitizeFileName = (name: string) =>
  name.trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]+/gi, '').toLowerCase() || 'document'

const ExportDialog = () => {
  const projectId = useAppSelector(selectProjectId)
  const currentDocument = useAppSelector(selectDocument)
  const [isExporting, setExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileName = useMemo(
    () => `${sanitizeFileName(currentDocument.name)}.wb.json`,
    [currentDocument.name],
  )

  const handleExport = useCallback(async () => {
    if (!projectId) {
      setError('No project loaded. Try again once autosave has finished initialising.')
      return
    }

    setExporting(true)
    setMessage(null)
    setError(null)

    try {
      const blob = await exportProjectToJson(projectId, currentDocument)
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = fileName
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setMessage('Export ready')
    } catch (err) {
      console.error('Export failed', err)
      setError('Failed to export. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [currentDocument, fileName, projectId])

  return (
    <section className="rounded-3xl border border-(--color-elevated-border) bg-(--color-elevated-bg) p-4 shadow">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-(--color-app-foreground)">Export</h2>
          <p className="text-xs text-(--color-muted-foreground)">
            Download your project as a `.wb.json` file including embedded assets.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || !projectId}
          className="rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? 'Preparing…' : 'Export .wb.json'}
        </button>
      </header>

      <dl className="grid gap-2 text-xs text-(--color-muted-foreground)">
        <div className="flex justify-between">
          <dt>File name</dt>
          <dd className="font-mono text-(--color-app-foreground)">{fileName}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Shapes</dt>
          <dd>{currentDocument.shapes.length}</dd>
        </div>
      </dl>

      {message ? (
        <p className="mt-3 text-xs text-green-500">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-red-500">{error}</p>
      ) : null}
    </section>
  )
}

export default ExportDialog
