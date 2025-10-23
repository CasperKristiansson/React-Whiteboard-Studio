import type { DocumentV1 } from '../types'
import { deserializeDocument } from '../persistence/db'
import { putAsset } from '../persistence/adapter'

type ImportAsset = {
  id: string
  kind: 'image' | 'font'
  mime: string
  dataUrl: string
  meta?: unknown
  createdAt: number
  updatedAt: number
}

type ImportBundleV1 = {
  version: 1
  document: DocumentV1
  assets: ImportAsset[]
}

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl)
  if (!response.ok) {
    throw new Error('Failed to decode asset data URL')
  }
  return response.blob()
}

const parseBundle = async (file: File): Promise<ImportBundleV1> => {
  const text = await file.text()
  const parsed = JSON.parse(text) as ImportBundleV1
  if (parsed.version !== 1) {
    throw new Error(`Unsupported export version: ${parsed.version}`)
  }
  return parsed
}

export const importProjectFromJson = async (projectId: string, file: File) => {
  const bundle = await parseBundle(file)
  const document = deserializeDocument(JSON.stringify(bundle.document))

  if (Array.isArray(bundle.assets)) {
    await Promise.all(
      bundle.assets.map(async (asset) => {
        const blob = await dataUrlToBlob(asset.dataUrl)
        await putAsset({
          id: asset.id,
          projectId,
          kind: asset.kind,
          mime: asset.mime,
          blob,
          meta: asset.meta,
        })
      }),
    )
  }

  return document
}

