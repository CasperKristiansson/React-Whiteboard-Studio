import { serializeDocument } from '../persistence/db'
import { listAssetsForProject } from '../persistence/adapter'
import { AppError } from '../errors'
import type { DocumentV1 } from '../types'

type ExportAsset = {
  id: string
  kind: 'image' | 'font'
  mime: string
  dataUrl: string
  meta?: unknown
  createdAt: number
  updatedAt: number
}

export type ExportBundleV1 = {
  version: 1
  document: DocumentV1
  assets: ExportAsset[]
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = (error) => {
      reject(error)
    }
    reader.readAsDataURL(blob)
  })

export const exportProjectToJson = async (
  projectId: string,
  document: DocumentV1,
): Promise<Blob> => {
  try {
    const assets = await listAssetsForProject(projectId)
    const referencedAssetIds = new Set(
      document.shapes
        .filter((shape) => shape.type === 'image')
        .map((shape) => shape.assetId)
        .filter(Boolean) as string[],
    )

    const serializedAssets: ExportAsset[] = []
    for (const asset of assets) {
      if (asset.kind === 'image' && referencedAssetIds.size && !referencedAssetIds.has(asset.id)) {
        continue
      }
      const dataUrl = await blobToDataUrl(asset.blob)
      serializedAssets.push({
        id: asset.id,
        kind: asset.kind,
        mime: asset.mime,
        dataUrl,
        meta: asset.meta,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      })
    }

    const bundle: ExportBundleV1 = {
      version: 1,
      document: JSON.parse(serializeDocument(document)) as DocumentV1,
      assets: serializedAssets,
    }

    const json = JSON.stringify(bundle, null, 2)
    return new Blob([json], { type: 'application/json' })
  } catch (error) {
    throw new AppError('ExportError', 'Failed to prepare JSON export', error)
  }
}
