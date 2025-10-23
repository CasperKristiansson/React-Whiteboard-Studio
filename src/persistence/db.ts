import Dexie, { type Table } from 'dexie'

import { DOCUMENT_VERSION, type DocumentV1 } from '../types'

export type ProjectRow = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type DocumentRow = {
  projectId: string
  version: number
  updatedAt: number
  payload: string
}

export type AssetRow = {
  id: string
  projectId: string
  kind: 'image' | 'font'
  mime: string
  createdAt: number
  updatedAt: number
  blob: Blob
  meta?: unknown
}

class WhiteboardDB extends Dexie {
  projects!: Table<ProjectRow, string>
  documents!: Table<DocumentRow, string>
  assets!: Table<AssetRow, string>

  constructor(name = 'whiteboard-db') {
    super(name)

    this.version(1).stores({
      projects: '&id, name, updatedAt, createdAt',
      documents: '&projectId, updatedAt',
      assets: '&id, projectId, kind, updatedAt',
    })

    this.on('blocked', () => {
      // If a new tab with a newer schema is open, close this connection
      // so Dexie can upgrade. The caller can reopen lazily.
      this.close()
    })
  }
}

export const db = new WhiteboardDB()

export const serializeDocument = (doc: DocumentV1) =>
  JSON.stringify({ ...doc, version: DOCUMENT_VERSION })

export const deserializeDocument = (raw: string): DocumentV1 => {
  const parsed = JSON.parse(raw) as DocumentV1
  return parsed
}
