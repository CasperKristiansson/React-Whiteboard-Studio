import { DEFAULT_TRANSFORM, DOCUMENT_VERSION, type DocumentV1 } from '../types'
import {
  db,
  deserializeDocument,
  serializeDocument,
  type AssetRow,
  type ProjectRow,
} from './db'
import { AppError } from '../errors'

export type ProjectMeta = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`

const createDefaultDocument = (name: string): DocumentV1 => ({
  id: createId(),
  name,
  shapes: [],
  viewport: { ...DEFAULT_TRANSFORM },
  theme: 'system',
  version: DOCUMENT_VERSION,
})

const toMeta = ({
  id,
  name,
  createdAt,
  updatedAt,
}: ProjectRow): ProjectMeta => ({
  id,
  name,
  createdAt,
  updatedAt,
})

export const listProjects = async (): Promise<ProjectMeta[]> => {
  try {
    const rows = await db.projects.orderBy('updatedAt').reverse().toArray()
    return rows.map(toMeta)
  } catch (error) {
    throw new AppError('PersistenceError', 'Failed to list projects', error)
  }
}

export const createProject = async (name: string): Promise<ProjectMeta> => {
  const projectId = createId()
  const now = Date.now()
  const meta: ProjectRow = {
    id: projectId,
    name,
    createdAt: now,
    updatedAt: now,
  }
  const doc = createDefaultDocument(name)
  try {
    await db.transaction('rw', db.projects, db.documents, async () => {
      await db.projects.add(meta)
      await db.documents.put({
        projectId,
        version: DOCUMENT_VERSION,
        updatedAt: now,
        payload: serializeDocument(doc),
      })
    })
    return toMeta(meta)
  } catch (error) {
    throw new AppError('PersistenceError', 'Failed to create project', error)
  }
}

export const renameProject = async (
  projectId: string,
  name: string,
): Promise<void> => {
  const now = Date.now()
  try {
    await db.projects.update(projectId, { name, updatedAt: now })
  } catch (error) {
    throw new AppError('PersistenceError', 'Failed to rename project', error)
  }
}

export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    await db.transaction(
      'rw',
      db.projects,
      db.documents,
      db.assets,
      async () => {
        await db.projects.delete(projectId)
        await db.documents.delete(projectId)
        await db.assets.where('projectId').equals(projectId).delete()
      },
    )
  } catch (error) {
    throw new AppError('PersistenceError', 'Failed to delete project', error)
  }
}

export const duplicateProject = async (
  projectId: string,
): Promise<ProjectMeta> => {
  const sourceProject = await db.projects.get(projectId)
  if (!sourceProject) {
    throw new Error('Project not found')
  }

  const sourceDocument = await db.documents.get(projectId)
  if (!sourceDocument) {
    throw new Error('Document not found')
  }

  const newProjectId = createId()
  const now = Date.now()
  const copyName = `${sourceProject.name} Copy`
  const meta: ProjectRow = {
    id: newProjectId,
    name: copyName,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.transaction(
      'rw',
      db.projects,
      db.documents,
      db.assets,
      async () => {
        await db.projects.add(meta)
        await db.documents.put({
          projectId: newProjectId,
          version: sourceDocument.version,
          updatedAt: now,
          payload: sourceDocument.payload,
        })

        const assetRows = await db.assets
          .where('projectId')
          .equals(projectId)
          .toArray()
        await Promise.all(
          assetRows.map((asset) =>
            db.assets.add({
              ...asset,
              id: createId(),
              projectId: newProjectId,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        )
      },
    )

    return toMeta(meta)
  } catch (error) {
    throw new AppError('PersistenceError', 'Failed to duplicate project', error)
  }
}

export const loadDocument = async (
  projectId: string,
): Promise<DocumentV1 | null> => {
  try {
    const row = await db.documents.get(projectId)
    if (!row) return null
    return deserializeDocument(row.payload)
  } catch (error) {
    throw new AppError('PersistenceError', 'Failed to load document', error)
  }
}

export const saveDocument = async (
  projectId: string,
  document: DocumentV1,
): Promise<void> => {
  const now = Date.now()
  const payload = serializeDocument(document)
  try {
    await db.transaction('rw', db.projects, db.documents, async () => {
      await db.projects.update(projectId, { updatedAt: now })
      await db.documents.put({
        projectId,
        version: document.version ?? DOCUMENT_VERSION,
        updatedAt: now,
        payload,
      })
    })
  } catch (error) {
    throw new AppError('PersistenceError', 'Failed to save document', error)
  }
}

export const putAsset = async (asset: {
  id: string
  projectId: string
  kind: AssetRow['kind']
  mime: string
  blob: Blob
  meta?: unknown
}): Promise<void> => {
  const now = Date.now()
  await db.assets.put({
    ...asset,
    createdAt: now,
    updatedAt: now,
  })
}

export const getAsset = async (
  id: string,
): Promise<{ blob: Blob; mime: string; meta?: unknown } | null> => {
  const row = await db.assets.get(id)
  if (!row) return null
  return { blob: row.blob, mime: row.mime, meta: row.meta }
}

export const removeAsset = async (id: string): Promise<void> => {
  await db.assets.delete(id)
}

export const listAssetsForProject = async (
  projectId: string,
): Promise<AssetRow[]> =>
  db.assets.where('projectId').equals(projectId).toArray()
