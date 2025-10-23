import { useCallback, useMemo, useState } from 'react'

import { exportProjectToJson } from '../export/json'
import { exportDocumentToPNG } from '../export/png'
import { exportDocumentToSVG } from '../export/svg'
import {
  selectDocument,
  selectProjectId,
  selectSelection,
  useAppSelector,
} from '../state/store'
import { useErrorStore } from '../state/error'
import { toAppError } from '../errors'
import { LuFileJson, LuImage, LuLayers, LuFileCode2, LuShapes } from 'react-icons/lu'

const sanitizeFileName = (name: string) =>
  name.trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]+/gi, '').toLowerCase() || 'document'

const ExportDialog = () => {
  const projectId = useAppSelector(selectProjectId)
  const currentDocument = useAppSelector(selectDocument)
  const selection = useAppSelector(selectSelection)
  const [isExportingJson, setExportingJson] = useState(false)
  const [jsonMessage, setJsonMessage] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [isExportingPng, setExportingPng] = useState(false)
  const [pngMessage, setPngMessage] = useState<string | null>(null)
  const [pngError, setPngError] = useState<string | null>(null)
  const [isExportingSvg, setExportingSvg] = useState(false)
  const [svgMessage, setSvgMessage] = useState<string | null>(null)
  const [svgError, setSvgError] = useState<string | null>(null)
  const pushError = useErrorStore((state) => state.push)

  const fileName = useMemo(
    () => `${sanitizeFileName(currentDocument.name)}.wb.json`,
    [currentDocument.name],
  )

  const handleJsonExport = useCallback(async () => {
    if (!projectId) {
      setJsonError('No project loaded. Try again once autosave has finished initialising.')
      return
    }

    setExportingJson(true)
    setJsonMessage(null)
    setJsonError(null)

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
      setJsonMessage('Export ready')
    } catch (err) {
      const appError = toAppError(err, 'ExportError', 'Failed to export project')
      pushError(appError)
      setJsonError(appError.message)
    } finally {
      setExportingJson(false)
    }
  }, [currentDocument, fileName, projectId, pushError])

  const handlePngExport = useCallback(
    async (target: 'document' | 'selection') => {
      if (target === 'selection' && selection.length === 0) {
        setPngError('Select one or more shapes first.')
        return
      }

      setExportingPng(true)
      setPngMessage(null)
      setPngError(null)

      try {
        const blob = await exportDocumentToPNG(
          currentDocument,
          target === 'selection' ? { selection } : 'document',
          2,
        )
        const url = URL.createObjectURL(blob)
        const base = fileName.replace(/\.wb\.json$/i, '')
        const link = window.document.createElement('a')
        link.href = url
        link.download = `${base}-${target === 'selection' ? 'selection' : 'document'}.png`
        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setPngMessage('PNG exported')
      } catch (err) {
        const appError = toAppError(err, 'ExportError', 'Failed to export PNG')
        pushError(appError)
        setPngError(appError.message)
      } finally {
        setExportingPng(false)
      }
    },
    [currentDocument, fileName, pushError, selection],
  )

  const handleSvgExport = useCallback(
    async (target: 'document' | 'selection') => {
      if (target === 'selection' && selection.length === 0) {
        setSvgError('Select one or more shapes first.')
        return
      }

      setExportingSvg(true)
      setSvgMessage(null)
      setSvgError(null)

      try {
        const blob = await exportDocumentToSVG(
          currentDocument,
          target === 'selection' ? { selection } : 'document',
        )
        const url = URL.createObjectURL(blob)
        const base = fileName.replace(/\.wb\.json$/i, '')
        const suffix = target === 'selection' ? 'selection' : 'document'
        const link = window.document.createElement('a')
        link.href = url
        link.download = `${base}-${suffix}.svg`
        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setSvgMessage('SVG exported')
      } catch (err) {
        const appError = toAppError(err, 'ExportError', 'Failed to export SVG')
        pushError(appError)
        setSvgError(appError.message)
      } finally {
        setExportingSvg(false)
      }
    },
    [currentDocument, fileName, pushError, selection],
  )

  return (
    <section className="rounded-3xl border border-(--color-elevated-border) bg-(--color-elevated-bg) p-4 shadow">
      <header className="mb-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-(--color-app-foreground)">Export</h2>
          <p className="text-xs text-(--color-muted-foreground)">
            Download your project as a `.wb.json` file including embedded assets.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleJsonExport}
            disabled={isExportingJson || !projectId}
            className="flex w-full items-center justify-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuFileJson className="h-4 w-4" />
            {isExportingJson ? 'Preparing…' : 'Export .wb.json'}
          </button>
          <button
            type="button"
            onClick={() => handlePngExport('document')}
            disabled={isExportingPng}
            className="flex w-full items-center justify-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuImage className="h-4 w-4" />
            {isExportingPng ? 'Preparing…' : 'Export PNG'}
          </button>
          <button
            type="button"
            onClick={() => handlePngExport('selection')}
            disabled={isExportingPng}
            className="flex w-full items-center justify-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuLayers className="h-4 w-4" />
            {isExportingPng ? 'Preparing…' : 'PNG (selection)'}
          </button>
          <button
            type="button"
            onClick={() => handleSvgExport('document')}
            disabled={isExportingSvg}
            className="flex w-full items-center justify-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuFileCode2 className="h-4 w-4" />
            {isExportingSvg ? 'Preparing…' : 'Export SVG'}
          </button>
          <button
            type="button"
            onClick={() => handleSvgExport('selection')}
            disabled={isExportingSvg}
            className="flex w-full items-center justify-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuShapes className="h-4 w-4" />
            {isExportingSvg ? 'Preparing…' : 'SVG (selection)'}
          </button>
        </div>
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

      {jsonMessage ? (
        <p className="mt-3 text-xs text-green-500">{jsonMessage}</p>
      ) : null}
      {jsonError ? (
        <p className="mt-3 text-xs text-red-500">{jsonError}</p>
      ) : null}
      {pngMessage ? (
        <p className="mt-3 text-xs text-green-500">{pngMessage}</p>
      ) : null}
      {pngError ? (
        <p className="mt-1 text-xs text-red-500">{pngError}</p>
      ) : null}
      {svgMessage ? (
        <p className="mt-3 text-xs text-green-500">{svgMessage}</p>
      ) : null}
      {svgError ? (
        <p className="mt-1 text-xs text-red-500">{svgError}</p>
      ) : null}
    </section>
  )
}

export default ExportDialog
