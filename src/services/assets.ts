import { putAsset, getAsset, listAssetsForProject } from '../persistence/adapter'
import type { AssetRow } from '../persistence/db'

const SUPPORTED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const urlCache = new Map<string, string>()

const loadImageMetadata = (blob: Blob): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }
    image.onerror = (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    image.src = url
  })

export const isSupportedImage = (file: File) => SUPPORTED_IMAGE_MIME.has(file.type)

export const importImageAsset = async (
  projectId: string,
  file: File,
): Promise<{ id: string; width: number; height: number }> => {
  if (!isSupportedImage(file)) {
    throw new Error('Unsupported image type')
  }

  const meta = await loadImageMetadata(file)

  const assetId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `asset-${Math.random().toString(36).slice(2)}-${Date.now()}`

  await putAsset({
    id: assetId,
    projectId,
    kind: 'image',
    mime: file.type,
    blob: file,
    meta: {
      width: meta.width,
      height: meta.height,
      name: file.name,
    },
  })

  return { id: assetId, width: meta.width, height: meta.height }
}

export const getAssetUrl = async (assetId: string) => {
  if (urlCache.has(assetId)) {
    return urlCache.get(assetId)!
  }

  const asset = await getAsset(assetId)
  if (!asset) return null

  const url = URL.createObjectURL(asset.blob)
  urlCache.set(assetId, url)
  return url
}

export const revokeAssetUrl = (assetId: string) => {
  const url = urlCache.get(assetId)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(assetId)
  }
}

export const listProjectAssets = (projectId: string): Promise<AssetRow[]> =>
  listAssetsForProject(projectId)
