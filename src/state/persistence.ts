import { useEffect, useRef } from 'react'

import { useAppStore } from './store'
import { loadDocument, saveDocument, type ProjectMeta, listProjects, createProject } from '../persistence/adapter'

const AUTOSAVE_DELAY_MS = 500

export const usePersistence = () => {
  const store = useAppStore()
  const projectRef = useRef<ProjectMeta | null>(null)
  const timerRef = useRef<number | null>(null)
  const isSavingRef = useRef(false)

  useEffect(() => {
    const setup = async () => {
      const projects = await listProjects()
      const selected = projects[0] ?? (await createProject('Untitled'))
      projectRef.current = selected
      const doc = await loadDocument(selected.id)
      if (doc) {
        store.replaceDocument(doc)
      }
    }
    void setup()

    const subscription = useAppStore.subscribe((subscriptionState) => {
      const { document, dirty } = subscriptionState
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
          useAppStore.setState((nextState) => {
            nextState.dirty = false
          })
        } catch (error) {
          console.error('Autosave failed', error)
        } finally {
          isSavingRef.current = false
        }
      }, AUTOSAVE_DELAY_MS)
    })

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
      subscription()
    }
  }, [store])

  return null
}
