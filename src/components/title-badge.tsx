type TitleBadgeProps = {
  activeTool: string
}

const TitleBadge = ({ activeTool }: TitleBadgeProps) => {
  return (
    <div className="inline-flex min-w-[200px] flex-col gap-1 rounded-2xl border border-(--color-elevated-border)/80 bg-(--color-elevated-bg)/95 px-3 py-2 shadow-lg backdrop-blur">
      <span className="text-xs font-semibold uppercase tracking-wide text-(--color-muted-foreground)">
        React Whiteboard
      </span>
      <span className="text-sm font-medium text-(--color-app-foreground)">
        Active tool: {activeTool}
      </span>
    </div>
  )
}

export default TitleBadge
