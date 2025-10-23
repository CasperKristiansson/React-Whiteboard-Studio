import { useState } from 'react'

import { useProjects } from '../state/projects'

const ProjectManager = () => {
  const {
    projects,
    currentProjectId,
    loading,
    error,
    create,
    rename,
    duplicate,
    remove,
    selectProject,
  } = useProjects()
  const [newProjectName, setNewProjectName] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newProjectName.trim()) return
    setStatus(null)
    await create(newProjectName.trim())
    setNewProjectName('')
    setStatus('Project created')
  }

  const handleRename = async (id: string, currentName: string) => {
    const next = window.prompt('Rename project', currentName)
    if (!next || next.trim() === currentName) return
    await rename(id, next.trim())
    setStatus('Project renamed')
  }

  const handleDuplicate = async (id: string) => {
    await duplicate(id)
    setStatus('Project duplicated')
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project and its assets?')) return
    await remove(id)
    setStatus(null)
  }

  return (
    <section className="rounded-3xl border border-(--color-elevated-border) bg-(--color-elevated-bg) p-4 shadow">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-(--color-app-foreground)">
            Projects
          </h2>
          <p className="text-xs text-(--color-muted-foreground)">
            Switch between projects or manage their lifecycle.
          </p>
        </div>
      </header>

      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <input
          type="text"
          className="flex-1 rounded border border-(--color-elevated-border) bg-(--color-input-bg) px-2 py-1 text-xs text-(--color-app-foreground) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          placeholder="New project name"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
        />
        <button
          type="submit"
          className="rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
        >
          Create
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-(--color-muted-foreground)">Loading…</p>
      ) : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      {status ? <p className="text-xs text-green-500">{status}</p> : null}

      <ul className="mt-3 grid gap-2">
        {projects.map((project) => {
          const isActive = project.id === currentProjectId
          return (
            <li
              key={project.id}
              className="flex items-center justify-between rounded border border-(--color-elevated-border) bg-(--color-elevated-bg) px-3 py-2 text-xs text-(--color-app-foreground)"
            >
              <button
                type="button"
                onClick={() => selectProject(project.id, project)}
                className={`flex-1 text-left font-medium ${isActive ? 'text-(--color-accent)' : ''}`}
              >
                {project.name}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRename(project.id, project.name)}
                  className="rounded border border-(--color-button-border) bg-(--color-button-bg) px-2 py-1 text-[11px] text-(--color-button-text) transition hover:bg-(--color-button-hover-bg)"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(project.id)}
                  className="rounded border border-(--color-button-border) bg-(--color-button-bg) px-2 py-1 text-[11px] text-(--color-button-text) transition hover:bg-(--color-button-hover-bg)"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(project.id)}
                  className="rounded border border-red-500 bg-red-500/10 px-2 py-1 text-[11px] text-red-500 transition hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ProjectManager
