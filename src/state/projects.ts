import { useCallback, useEffect, useState } from 'react'

import {
  listProjects,
  createProject,
  renameProject,
  duplicateProject,
  deleteProject,
  loadDocument,
  type ProjectMeta,
} from '../persistence/adapter'
import { toAppError } from '../errors'
import { useErrorStore } from './error'
import { useAppStore } from './store'

export const useProjects = () => {
  const replaceDocument = useAppStore((state) => state.replaceDocument)
  const setProjectId = useAppStore((state) => state.setProjectId)
  const markClean = useAppStore((state) => state.markClean)
  const dirty = useAppStore((state) => state.dirty)
  const pushError = useErrorStore((state) => state.push)

  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectProject = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)
      try {
        if (dirty) {
          // Autosave already handles persisting the active document; rely on it.
        }
        const doc = await loadDocument(id)
        if (doc) {
          replaceDocument(doc)
          markClean()
        }
        setProjectId(id)
        setCurrentProjectId(id)
      } catch (err) {
        console.error('Failed to load project', err)
        const appError = toAppError(
          err,
          'PersistenceError',
          'Could not load project',
        )
        pushError(appError)
        setError(appError.message)
      } finally {
        setLoading(false)
      }
    },
    [dirty, markClean, pushError, replaceDocument, setProjectId],
  )

  useEffect(() => {
    const init = async () => {
      try {
        const list = await listProjects()
        if (!list.length) {
          const project = await createProject('Untitled')
          setProjects([project])
          await selectProject(project.id)
        } else {
          setProjects(list)
          await selectProject(list[0].id)
        }
      } catch (error) {
        pushError(
          toAppError(error, 'PersistenceError', 'Unable to load projects'),
        )
      }
    }
    void init()
  }, [pushError, selectProject])

  const create = useCallback(
    async (name: string) => {
      try {
        const project = await createProject(name)
        setProjects((prev) => [project, ...prev])
        await selectProject(project.id)
      } catch (error) {
        pushError(
          toAppError(error, 'PersistenceError', 'Failed to create project'),
        )
      }
    },
    [pushError, selectProject],
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      try {
        await renameProject(id, name)
        setProjects((prev) =>
          prev.map((project) =>
            project.id === id ? { ...project, name } : project,
          ),
        )
      } catch (error) {
        pushError(
          toAppError(error, 'PersistenceError', 'Failed to rename project'),
        )
      }
    },
    [pushError],
  )

  const duplicate = useCallback(
    async (id: string) => {
      try {
        const project = await duplicateProject(id)
        setProjects((prev) => [project, ...prev])
      } catch (error) {
        pushError(
          toAppError(error, 'PersistenceError', 'Failed to duplicate project'),
        )
      }
    },
    [pushError],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteProject(id)
        let nextProjectId: string | null = null
        setProjects((prev) => {
          const nextList = prev.filter((project) => project.id !== id)
          if (currentProjectId === id && nextList.length) {
            nextProjectId = nextList[0].id
          }
          return nextList
        })
        if (nextProjectId) {
          await selectProject(nextProjectId)
        } else if (currentProjectId === id) {
          setCurrentProjectId(null)
          setProjectId(null)
        }
      } catch (error) {
        pushError(
          toAppError(error, 'PersistenceError', 'Failed to delete project'),
        )
      }
    },
    [currentProjectId, pushError, selectProject, setProjectId],
  )

  return {
    projects,
    currentProjectId,
    loading,
    error,
    create,
    rename,
    duplicate,
    remove,
    selectProject,
  }
}
