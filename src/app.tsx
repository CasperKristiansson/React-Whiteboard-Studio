import CanvasViewport from './canvas/canvas-viewport'
import { selectActiveTool, useAppSelector } from './state/store'

function App() {
  const activeTool = useAppSelector(selectActiveTool)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold sm:text-5xl">React Whiteboard</h1>
          <p className="text-lg font-medium text-slate-300">
            Active tool: <span className="font-semibold text-white">{activeTool}</span>
          </p>
          <p className="max-w-2xl text-sm text-slate-400">
            Pan with <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs">Space + drag</span>,
            trackpad two-finger drag, or zoom with pinch / <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs">Ctrl/Cmd + wheel</span>.
            The viewport currently renders a placeholder while core drawing tools are under development.
          </p>
        </header>

        <CanvasViewport />
      </div>
    </main>
  )
}

export default App
