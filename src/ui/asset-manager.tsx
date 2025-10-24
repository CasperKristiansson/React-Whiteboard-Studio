import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import clsx from 'clsx'

import {
  useAppSelector,
  useAppStore,
  selectProjectId,
  selectViewport,
} from '../state/store'
import {
  listProjectAssets,
  importImageAsset,
  getAssetUrl,
  revokeAssetUrl,
} from '../services/assets'
import { createShapeId } from '../state/store'
import { getDefaultStrokeColor } from '../utils/theme-colors'
import { useErrorStore } from '../state/error'
import { toAppError } from '../errors'
import { LuUpload, LuMoveRight, LuLayers } from 'react-icons/lu'

type AssetPreview = {
  id: string
  name: string
  mime: string
  url: string
  width: number
  height: number
  createdAt: number
}

const MAX_SHAPE_DIMENSION = 360

const scaleDimensions = (width: number, height: number) => {
  if (width <= MAX_SHAPE_DIMENSION && height <= MAX_SHAPE_DIMENSION) {
    return { width, height }
  }
  const ratio = Math.min(
    MAX_SHAPE_DIMENSION / width,
    MAX_SHAPE_DIMENSION / height,
  )
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

type AssetManagerVariant = 'default' | 'dropdown'

const AssetManager = ({
  variant = 'default',
}: {
  variant?: AssetManagerVariant
}) => {
  const projectId = useAppSelector(selectProjectId)
  const viewport = useAppSelector(selectViewport)
  const addShape = useAppStore((state) => state.addShape)
  const commit = useAppStore((state) => state.commit)
  const select = useAppStore((state) => state.select)

  const [assets, setAssets] = useState<AssetPreview[]>([])
  const [isUploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pushError = useErrorStore((state) => state.push)

  useEffect(() => {
    if (!projectId) {
      setAssets([])
      return
    }

    let cancelled = false
    const loadedIds: string[] = []

    const load = async () => {
      try {
        const rows = await listProjectAssets(projectId)
        if (cancelled) return
        const previews: AssetPreview[] = []
        for (const row of rows) {
          const url = await getAssetUrl(row.id)
          if (!url) continue
          loadedIds.push(row.id)
          const meta = (row.meta ?? {}) as {
            width?: number
            height?: number
            name?: string
          }
          previews.push({
            id: row.id,
            name: meta?.name ?? 'Untitled asset',
            mime: row.mime,
            url,
            width: meta?.width ?? 200,
            height: meta?.height ?? 200,
            createdAt: row.createdAt,
          })
        }
        if (!cancelled) {
          setAssets(previews.sort((a, b) => b.createdAt - a.createdAt))
        }
      } catch (err) {
        pushError(toAppError(err, 'PersistenceError', 'Failed to load assets'))
      }
    }

    void load()

    return () => {
      cancelled = true
      loadedIds.forEach((id) => revokeAssetUrl(id))
    }
  }, [projectId, pushError])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!projectId) return
      const files = event.target.files
      if (!files?.length) return

      setUploading(true)
      setError(null)
      try {
        for (const file of Array.from(files)) {
          try {
            const result = await importImageAsset(projectId, file)
            const url = await getAssetUrl(result.id)
            if (!url) continue

            setAssets((previous) => {
              const next: AssetPreview = {
                id: result.id,
                name: file.name,
                mime: file.type,
                url,
                width: result.width,
                height: result.height,
                createdAt: Date.now(),
              }
              return [next, ...previous]
            })
          } catch (fileError) {
            const appError = toAppError(
              fileError,
              'AssetError',
              'Failed to import asset',
            )
            pushError(appError)
            setError(appError.message)
          }
        }
      } finally {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [projectId, pushError],
  )

  const handleInsert = useCallback(
    (asset: AssetPreview) => {
      const shapeId = createShapeId()
      const now = Date.now()
      const { width, height } = scaleDimensions(asset.width, asset.height)
      const position = {
        x: viewport.x + 100,
        y: viewport.y + 100,
      }

      const stroke = getDefaultStrokeColor()

      addShape({
        id: shapeId,
        type: 'image',
        position,
        size: { x: width, y: height },
        rotation: 0,
        zIndex: now,
        stroke,
        strokeWidth: 0,
        assetId: asset.id,
        objectFit: 'contain',
        createdAt: now,
        updatedAt: now,
      })
      select([shapeId], 'set')
      commit('Insert image')
    },
    [addShape, commit, select, viewport.x, viewport.y],
  )

  const sortedAssets = useMemo(
    () => [...assets].sort((a, b) => b.createdAt - a.createdAt),
    [assets],
  )

  const containerClassName =
    variant === 'dropdown'
      ? 'space-y-3 rounded-2xl border border-(--color-elevated-border)/60 bg-(--color-elevated-bg)/85 p-3 shadow-sm backdrop-blur'
      : 'rounded-3xl border border-(--color-elevated-border) bg-(--color-elevated-bg) p-4 shadow'

  const headerClassName = clsx(
    'flex flex-wrap items-center justify-between gap-2',
    variant === 'default' && 'mb-3',
  )

  const importButtonClassName = clsx(
    'flex items-center gap-2 rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
    variant === 'dropdown' && 'w-full justify-center sm:w-auto',
  )

  const assetsWrapperClassName =
    variant === 'dropdown' ? 'max-h-[50vh] overflow-y-auto pr-1' : undefined

  const assetsGridClassName = clsx(
    'grid gap-3',
    variant === 'dropdown' ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
  )

  const assetCardClassName = clsx(
    'overflow-hidden rounded-lg border border-(--color-elevated-border) bg-(--color-elevated-bg) shadow-sm',
    variant === 'dropdown' &&
      'border-(--color-elevated-border)/60 bg-(--color-elevated-bg)/90',
  )

  const insertButtonClassName = clsx(
    'flex items-center justify-center gap-1 rounded border border-(--color-button-border) bg-(--color-button-bg) px-2 py-1 text-xs font-medium text-(--color-button-text) transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
    variant === 'dropdown' && 'w-full',
  )

  return (
    <section className={containerClassName}>
      <header className={headerClassName}>
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-(--color-app-foreground)">
            <LuLayers className="h-4 w-4" /> Assets
          </h2>
          <p className="text-xs text-(--color-muted-foreground)">
            Import images for reuse across the project.
          </p>
        </div>
        <button
          type="button"
          onClick={handleUploadClick}
          className={importButtonClassName}
          disabled={!projectId || isUploading}
        >
          <LuUpload className="h-4 w-4" />
          {isUploading ? 'Uploading…' : 'Import images'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </header>

      {!projectId ? (
        <p className="text-xs text-(--color-muted-foreground)">
          Create or select a project to manage assets.
        </p>
      ) : sortedAssets.length === 0 ? (
        <p className="text-xs text-(--color-muted-foreground)">
          No assets yet. Import images to reuse them on the canvas.
        </p>
      ) : (
        <div className={assetsWrapperClassName}>
          <ul className={assetsGridClassName}>
            {sortedAssets.map((asset) => (
              <li key={asset.id} className={assetCardClassName}>
                <div className="aspect-video bg-(--color-muted)">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2 px-3 py-2">
                  <div>
                    <p className="truncate text-xs font-semibold text-(--color-app-foreground)">
                      {asset.name}
                    </p>
                    <p className="text-[10px] tracking-wide text-(--color-muted-foreground) uppercase">
                      {asset.mime}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={insertButtonClassName}
                    onClick={() => handleInsert(asset)}
                  >
                    <LuMoveRight className="h-4 w-4" />
                    Insert
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error ? <p className="mt-3 text-xs text-red-500">{error}</p> : null}
    </section>
  )
}

export default AssetManager
