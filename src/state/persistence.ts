import { useEffect, useRef } from 'react'

import { useAppStore } from './store'
import {
  createProject,
  listProjects,
  loadDocument,
  saveDocument,
  type ProjectMeta,
} from '../persistence/adapter'
import { toAppError } from '../errors'
import { useErrorStore } from './error'

const AUTOSAVE_DELAY_MS = 500

export const usePersistence = () => {
  const replaceDocument = useAppStore((state) => state.replaceDocument)
  const setProjectId = useAppStore((state) => state.setProjectId)
  const markClean = useAppStore((state) => state.markClean)
  const pushError = useErrorStore((state) => state.push)

  const projectRef = useRef<ProjectMeta | null>(null)
  const timerRef = useRef<number | null>(null)
  const isSavingRef = useRef(false)

  useEffect(() => {
    const initialise = async () => {
      try {
        const projects = await listProjects()
        const selected = projects[0] ?? (await createProject('Untitled'))
        projectRef.current = selected
        setProjectId(selected.id)
        const doc = await loadDocument(selected.id)
        if (doc) {
          replaceDocument(doc)
        } else {
          markClean()
        }
      } catch (error) {
        pushError(toAppError(error, 'PersistenceError', 'Unable to load projects'))
      }
    }

    void initialise()

    const unsubscribe = useAppStore.subscribe(({ document, dirty }) => {
      if (!dirty || !projectRef.current) {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current)
          timerRef.current = null
        }
        return
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }

      timerRef.current = window.setTimeout(async () => {
        if (!projectRef.current || isSavingRef.current) return
        try {
          isSavingRef.current = true
          await saveDocument(projectRef.current.id, document)
          markClean()
        } catch (error) {
          pushError(toAppError(error, 'PersistenceError', 'Autosave failed'))
        } finally {
          isSavingRef.current = false
        }
      }, AUTOSAVE_DELAY_MS)
    })

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
      unsubscribe()
    }
  }, [markClean, pushError, replaceDocument, setProjectId])

  return null
}
