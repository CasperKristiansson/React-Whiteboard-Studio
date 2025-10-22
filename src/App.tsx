import { selectActiveTool, useAppSelector } from './state/store'

function App() {
  const activeTool = useAppSelector(selectActiveTool)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-4xl font-semibold sm:text-5xl">React Whiteboard</h1>
        <p className="text-lg font-medium text-slate-300">
          Active tool: <span className="font-semibold text-white">{activeTool}</span>
        </p>
        <p className="max-w-xl text-sm text-slate-400">
          The canvas, toolbar, and other interface elements will arrive in future milestones. Tailwind CSS is now wired up, so upcoming features can rely on utility classes.
        </p>
      </div>
    </main>
  )
}

export default App
