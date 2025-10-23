import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { LuChevronDown, LuGrid2X2, LuMagnet } from 'react-icons/lu'

import Toolbar from './toolbar'
import ContextPanel from './context-panel'
import AssetManager from './asset-manager'
import ProjectManager from './project-manager'
import ExportDialog from './export-dialog'
import ImportDialog from './import-dialog'
import ThemeToggle from '../components/theme-toggle'
import {
  selectActiveTool,
  selectSettings,
  useAppSelector,
  useAppStore,
} from '../state/store'

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
          className={clsx('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')}
        />
      </button>
      {isOpen ? (
        <div
          id={`${id}-menu`}
          role="menu"
          className={clsx(
            'absolute z-50 mt-3 max-h-[70vh] min-w-[240px] max-w-[min(90vw,56rem)] overflow-auto rounded-2xl border border-(--color-elevated-border) bg-(--color-elevated-bg) shadow-2xl backdrop-blur',
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

const TopNavigation = () => {
  const navRef = useRef<HTMLDivElement | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const activeTool = useAppSelector(selectActiveTool)
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
    <div className="pointer-events-none absolute left-1/2 top-[10px] z-30 flex -translate-x-1/2 justify-center px-4">
      <nav
        ref={navRef}
        className="pointer-events-auto flex min-w-0 max-w-[min(94vw,1100px)] flex-wrap items-center gap-3 rounded-2xl border border-(--color-elevated-border) bg-(--color-elevated-bg)/95 px-4 py-2 shadow-2xl backdrop-blur"
        aria-label="Application navigation"
      >
        <div className="flex min-w-[160px] flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-tight text-(--color-app-foreground)">
            React Whiteboard
          </span>
          <span className="text-xs text-(--color-muted-foreground)">
            Active tool:{' '}
            <span className="font-medium text-(--color-app-foreground)">{activeTool}</span>
          </span>
        </div>

        <NavDropdown
          id="tools"
          label="Tools"
          isOpen={openMenu === 'tools'}
          onToggle={toggleMenu}
          contentClassName="p-3"
        >
          <div className="max-w-full">
            <Toolbar />
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
            <AssetManager />
          </div>
        </NavDropdown>

        <NavDropdown
          id="projects"
          label="Projects"
          isOpen={openMenu === 'projects'}
          onToggle={toggleMenu}
        >
          <div className="max-w-full">
            <ProjectManager />
          </div>
        </NavDropdown>

        <NavDropdown
          id="io"
          label="Import / Export"
          isOpen={openMenu === 'io'}
          onToggle={toggleMenu}
          align="right"
        >
          <div className="flex flex-col gap-4">
            <ImportDialog />
            <ExportDialog />
          </div>
        </NavDropdown>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={clsx(
              'flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
              settings.gridVisible
                ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow'
                : 'border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
            )}
            onClick={() => setSettings({ gridVisible: !settings.gridVisible })}
            aria-pressed={settings.gridVisible}
          >
            <LuGrid2X2 className="h-4 w-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            type="button"
            className={clsx(
              'flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
              settings.snapEnabled
                ? 'border-(--color-button-active-border) bg-(--color-button-active-bg) text-(--color-button-text) shadow'
                : 'border-transparent bg-(--color-button-bg) text-(--color-button-muted-text) hover:bg-(--color-button-hover-bg)',
            )}
            onClick={() => setSettings({ snapEnabled: !settings.snapEnabled })}
            aria-pressed={settings.snapEnabled}
          >
            <LuMagnet className="h-4 w-4" />
            <span className="hidden sm:inline">Snap</span>
          </button>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  )
}

export default TopNavigation
