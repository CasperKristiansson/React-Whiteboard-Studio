import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  LuCheck,
  LuChevronDown,
  LuCopy,
  LuGrid2X2,
  LuMagnet,
  LuPencil,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu'

import Toolbar from './toolbar'
import ContextPanel from './context-panel'
import AssetManager from './asset-manager'
import ExportDialog from './export-dialog'
import ImportDialog from './import-dialog'
import { selectSettings, useAppSelector, useAppStore } from '../state/store'
import { useProjects } from '../state/projects'

type NavDropdownProps = {
  id: string
  label: string
  isOpen: boolean
  onToggle: (id: string) => void
  children: ReactNode
  align?: 'left' | 'right'
  contentClassName?: string
}

const NavDropdown = ({
  id,
  label,
  isOpen,
  onToggle,
  children,
  align = 'left',
  contentClassName,
}: NavDropdownProps) => {
  return (
    <div className="relative">
      <button
        type="button"
        className={clsx(
          'flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
          isOpen
            ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow'
            : 'border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
        )}
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={() => onToggle(id)}
      >
        <span>{label}</span>
        <LuChevronDown
          className={clsx(
            'h-3.5 w-3.5 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen ? (
        <div
          id={`${id}-menu`}
          role="menu"
          className={clsx(
            'absolute z-50 mt-3 max-h-[70vh] max-w-[min(90vw,56rem)] min-w-[240px] overflow-auto rounded-2xl border border-(--color-elevated-border) bg-(--color-elevated-bg) shadow-2xl backdrop-blur',
            align === 'right' ? 'right-0' : 'left-0',
            contentClassName ?? 'p-3',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

type ProjectsMenuProps = {
  isOpen: boolean
}

const ProjectsMenu = ({ isOpen }: ProjectsMenuProps) => {
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

  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [deleteProjectName, setDeleteProjectName] = useState('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setOpenProjectId(null)
      setStatus(null)
      setRenameProjectId(null)
      setRenameValue('')
      setDeleteProjectId(null)
      setDeleteProjectName('')
    }
  }, [isOpen])

  useEffect(() => {
    if (
      openProjectId &&
      !projects.some((project) => project.id === openProjectId)
    ) {
      setOpenProjectId(null)
    }
  }, [openProjectId, projects])

  useEffect(() => {
    if (renameProjectId) {
      renameInputRef.current?.focus()
    }
  }, [renameProjectId])

  const handleCreate = useCallback(async () => {
    const name = window.prompt('Create new project', 'Untitled project')
    if (!name) return
    const trimmed = name.trim()
    if (!trimmed) return
    await create(trimmed)
    setStatus('Project created')
    setOpenProjectId(null)
  }, [create])

  const handleProjectClick = useCallback(
    async (projectId: string) => {
      await selectProject(projectId)
      setOpenProjectId((current) => (current === projectId ? null : projectId))
      setStatus(null)
      setRenameProjectId(null)
      setRenameValue('')
      setDeleteProjectId(null)
      setDeleteProjectName('')
    },
    [selectProject],
  )

  const handleRenameStart = useCallback(
    (projectId: string, currentName: string) => {
      setRenameProjectId(projectId)
      setRenameValue(currentName)
      setStatus(null)
      setDeleteProjectId(null)
      setDeleteProjectName('')
    },
    [],
  )

  const handleRenameCancel = useCallback(() => {
    setRenameProjectId(null)
    setRenameValue('')
  }, [])

  const handleRenameSubmit = useCallback(async () => {
    if (!renameProjectId) return
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setStatus('Name cannot be empty')
      return
    }

    const target = projects.find((project) => project.id === renameProjectId)
    if (target && target.name === trimmed) {
      setStatus('Name unchanged')
      setRenameProjectId(null)
      return
    }

    await rename(renameProjectId, trimmed)
    setStatus('Project renamed')
    setRenameProjectId(null)
    setRenameValue('')
  }, [projects, rename, renameProjectId, renameValue])

  const handleDuplicate = useCallback(
    async (projectId: string) => {
      await duplicate(projectId)
      setStatus('Project duplicated')
      setOpenProjectId(null)
      setRenameProjectId(null)
      setRenameValue('')
      setDeleteProjectId(null)
      setDeleteProjectName('')
    },
    [duplicate],
  )

  const handleDeleteRequest = useCallback(
    (projectId: string, projectName: string) => {
      setDeleteProjectId(projectId)
      setDeleteProjectName(projectName)
      setRenameProjectId(null)
      setRenameValue('')
      setStatus(null)
    },
    [],
  )

  const handleDeleteCancel = useCallback(() => {
    setDeleteProjectId(null)
    setDeleteProjectName('')
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteProjectId) return
    await remove(deleteProjectId)
    setStatus('Project deleted')
    setDeleteProjectId(null)
    setDeleteProjectName('')
    setOpenProjectId(null)
    setRenameProjectId(null)
    setRenameValue('')
  }, [deleteProjectId, remove])

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-(--color-button-border) bg-(--color-button-bg) px-3 py-2 text-sm font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
        onClick={handleCreate}
      >
        <LuPlus className="h-4 w-4" />
        New project
      </button>

      {loading ? (
        <p className="text-xs text-(--color-muted-foreground)">
          Loading projects…
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      {status && status !== 'Project loaded' ? (
        <p className="text-xs text-green-500">{status}</p>
      ) : null}

      <div className="max-h-[50vh] overflow-y-auto pr-1">
        <ul className="grid gap-2">
          {projects.map((project) => {
            const isActive = project.id === currentProjectId
            const isOpen = openProjectId === project.id

            return (
              <li
                key={project.id}
                className="rounded-xl border border-(--color-elevated-border)/70 bg-(--color-elevated-bg)/85 shadow-sm"
              >
                <button
                  type="button"
                  className={clsx(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                    isActive
                      ? 'bg-(--color-button-active-bg) text-(--color-button-text)'
                      : 'text-(--color-app-foreground) hover:bg-(--color-button-hover-bg)/60',
                  )}
                  onClick={() => void handleProjectClick(project.id)}
                >
                  <span className="truncate text-left font-medium">
                    {project.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-(--color-muted-foreground)">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-(--color-accent)">
                        <LuCheck className="h-4 w-4" /> Active
                      </span>
                    ) : null}
                    <LuChevronDown
                      className={clsx(
                        'h-3.5 w-3.5 transition-transform',
                        isOpen ? 'rotate-180' : undefined,
                      )}
                    />
                  </span>
                </button>

                {isOpen ? (
                  <div className="rounded-b-xl border-t border-(--color-elevated-border)/60 bg-(--color-elevated-bg)/90 px-3 py-2 text-xs text-(--color-muted-foreground)">
                    {renameProjectId === project.id ? (
                      <form
                        className="grid gap-2"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void handleRenameSubmit()
                        }}
                      >
                        <label className="flex flex-col gap-1 text-left text-(--color-app-foreground)">
                          <span className="text-[10px] font-semibold tracking-wide text-(--color-muted-foreground) uppercase">
                            Rename project
                          </span>
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameValue}
                            onChange={(event) =>
                              setRenameValue(event.target.value)
                            }
                            className="w-full rounded-lg border border-(--color-elevated-border) bg-(--color-elevated-bg) px-3 py-2 text-sm text-(--color-app-foreground) shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                            placeholder="Project name"
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 rounded-lg border border-(--color-button-border) bg-(--color-button-bg) px-3 py-2 text-sm font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded-lg border border-transparent bg-(--color-elevated-bg) px-3 py-2 text-sm font-medium text-(--color-muted-foreground) transition hover:border-(--color-elevated-border) hover:bg-(--color-button-bg)/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                            onClick={handleRenameCancel}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : deleteProjectId === project.id ? (
                      <div className="grid gap-3">
                        <p className="text-left text-sm text-(--color-app-foreground)">
                          Delete project “{deleteProjectName}” and its assets?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex-1 rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                            onClick={() => void handleDeleteConfirm()}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded-lg border border-transparent bg-(--color-elevated-bg) px-3 py-2 text-sm font-medium text-(--color-muted-foreground) transition hover:border-(--color-elevated-border) hover:bg-(--color-button-bg)/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                            onClick={handleDeleteCancel}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left font-medium text-(--color-app-foreground) transition hover:border-(--color-button-border) hover:bg-(--color-button-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                          onClick={() =>
                            handleRenameStart(project.id, project.name)
                          }
                        >
                          <LuPencil className="h-4 w-4" /> Rename
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left font-medium text-(--color-app-foreground) transition hover:border-(--color-button-border) hover:bg-(--color-button-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                          onClick={() => void handleDuplicate(project.id)}
                        >
                          <LuCopy className="h-4 w-4" /> Duplicate
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left font-medium text-red-500 transition hover:border-red-500/40 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                          onClick={() =>
                            handleDeleteRequest(project.id, project.name)
                          }
                        >
                          <LuTrash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

const TopNavigation = () => {
  const navRef = useRef<HTMLDivElement | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const settings = useAppSelector(selectSettings)
  const setSettings = useAppStore((state) => state.setSettings)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current) return
      if (!navRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const toggleMenu = (id: string) => {
    setOpenMenu((current) => (current === id ? null : id))
  }

  return (
    <div className="pointer-events-none absolute top-2.5 left-1/2 z-30 flex -translate-x-1/2 justify-center px-4">
      <nav
        ref={navRef}
        className="pointer-events-auto flex max-w-[min(98vw,1480px)] min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-(--color-elevated-border) bg-(--color-elevated-bg)/95 px-4 py-2 shadow-2xl backdrop-blur"
        aria-label="Application navigation"
      >
        <NavDropdown
          id="tools"
          label="Tools"
          isOpen={openMenu === 'tools'}
          onToggle={toggleMenu}
          contentClassName="p-3 min-w-[260px] sm:min-w-[360px] lg:min-w-[420px]"
        >
          <div className="max-w-full">
            <Toolbar variant="dropdown" />
          </div>
        </NavDropdown>

        <NavDropdown
          id="selection"
          label="Selection"
          isOpen={openMenu === 'selection'}
          onToggle={toggleMenu}
        >
          <div className="max-w-full">
            <ContextPanel />
          </div>
        </NavDropdown>

        <NavDropdown
          id="assets"
          label="Assets"
          isOpen={openMenu === 'assets'}
          onToggle={toggleMenu}
        >
          <div className="max-w-full">
            <AssetManager variant="dropdown" />
          </div>
        </NavDropdown>

        <NavDropdown
          id="projects"
          label="Projects"
          isOpen={openMenu === 'projects'}
          onToggle={toggleMenu}
        >
          <div className="max-w-full">
            <ProjectsMenu isOpen={openMenu === 'projects'} />
          </div>
        </NavDropdown>

        <NavDropdown
          id="utils"
          label="Utils"
          isOpen={openMenu === 'utils'}
          onToggle={toggleMenu}
          align="right"
        >
          <div className="grid gap-4">
            <section className="grid gap-2">
              <header className="text-xs font-semibold tracking-wide text-(--color-muted-foreground) uppercase">
                Canvas
              </header>
              <button
                type="button"
                className={clsx(
                  'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                  settings.gridVisible
                    ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow-sm'
                    : 'border-(--color-elevated-border) bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
                )}
                onClick={() =>
                  setSettings({ gridVisible: !settings.gridVisible })
                }
                aria-pressed={settings.gridVisible}
              >
                <span className="flex items-center gap-2">
                  <LuGrid2X2 className="h-4 w-4" />
                  Grid
                </span>
                <span className="text-xs text-(--color-muted-foreground)">
                  {settings.gridVisible ? 'On' : 'Off'}
                </span>
              </button>
              <button
                type="button"
                className={clsx(
                  'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
                  settings.snapEnabled
                    ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow-sm'
                    : 'border-(--color-elevated-border) bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
                )}
                onClick={() =>
                  setSettings({ snapEnabled: !settings.snapEnabled })
                }
                aria-pressed={settings.snapEnabled}
              >
                <span className="flex items-center gap-2">
                  <LuMagnet className="h-4 w-4" />
                  Snap
                </span>
                <span className="text-xs text-(--color-muted-foreground)">
                  {settings.snapEnabled ? 'On' : 'Off'}
                </span>
              </button>
            </section>
            <ImportDialog />
            <ExportDialog />
          </div>
        </NavDropdown>
      </nav>
    </div>
  )
}

export default TopNavigation
