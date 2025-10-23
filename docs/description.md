# Technical spec: React whiteboard with shapes and text

## Scope

- Infinite canvas with pan and zoom. Zoom limits: 10%–1600%.
- Tools: Select, Rectangle, Ellipse, Line/Arrow, Freehand path, Text, Image.
- Figma-style bounding box with resize, rotate, and drag handles.
- Creative text styling: font family, weight, size, letter spacing, line height, alignment, color, shadow.
- Local persistence with multi-project support. Import/Export.
- Dark mode.

## Architecture

- **Frontend**: React + TypeScript + Vite + tailwindcss + eslint
- **State**: Zustand + Immer. Undo/redo via command history ring buffer.
- **Rendering**: Canvas2D via Konva (`react-konva`). Single canvas layer stack for performance. Optional OffscreenCanvas for previews.
- **UI**: Tailwind CSS + CSS variables for themes. Headless UI or Radix Primitives for a11y.
- **Storage**: IndexedDB via Dexie. Small settings in `localStorage`.

## Coordinate system

- World space for shapes. Viewport transform `T` = pan + zoom.
- Convert screen → world with `T⁻¹` for hit-tests and edits.
- Grid and snapping (5 px world units). Toggle in UI.

## Canvas layers (z order)

1. Background (infinite pattern grid).
2. Shapes (batched draw).
3. Selection overlay (bounding boxes, handles, guides).
4. Cursor, crosshair, measurement hints.

## Components

- `AppShell`: theme toggler, project switcher, keyboard shortcuts.
- `Toolbar`: floating, rounded, top-center. Tool mode buttons, color pickers, stroke width, font controls.
- `CanvasViewport`: pan/zoom, event routing, render loop.
- `ContextPanel`: properties for selected objects.
- `ProjectManager`: list, create, duplicate, delete, rename.
- `AssetManager`: images and font preloads.

## Data model (v1)

```ts
type UUID = string

type Vec2 = { x: number; y: number }
type RGBA = { r: number; g: number; b: number; a: number }

type Transform = { x: number; y: number; scale: number; rotation: number } // rotation deg

type BaseShape = {
  id: UUID
  type: 'rect' | 'ellipse' | 'line' | 'arrow' | 'path' | 'text' | 'image'
  position: Vec2 // world origin of shape
  rotation: number // deg
  zIndex: number
  stroke: RGBA
  strokeWidth: number
  fill?: RGBA
  locked?: boolean
  hidden?: boolean
  createdAt: number
  updatedAt: number
}

type Rect = BaseShape & { type: 'rect'; size: Vec2; radius?: number }
type Ellipse = BaseShape & { type: 'ellipse'; rx: number; ry: number }
type Line = BaseShape & { type: 'line'; points: Vec2[] }
type Arrow = BaseShape & { type: 'arrow'; points: Vec2[]; headSize: number }
type Path = BaseShape & {
  type: 'path'
  d: Vec2[]
  closed?: boolean
  roughness?: number
}
type TextShape = BaseShape & {
  type: 'text'
  text: string
  box: Vec2 // text box size
  font: { family: string; weight: number; size: number }
  letterSpacing?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  italic?: boolean
  underline?: boolean
  shadow?: { offset: Vec2; blur: number; color: RGBA }
}
type ImageShape = BaseShape & {
  type: 'image'
  size: Vec2
  assetId: UUID
  objectFit?: 'contain' | 'cover'
}

type Shape = Rect | Ellipse | Line | Arrow | Path | TextShape | ImageShape

type DocumentV1 = {
  id: UUID
  name: string
  shapes: Shape[]
  viewport: Transform // last view
  theme: 'light' | 'dark' | 'system'
  version: 1
}

type ProjectMeta = {
  id: UUID
  name: string
  createdAt: number
  updatedAt: number
}
```

## Storage

- Dexie tables:
  - `projects (id, name, createdAt, updatedAt)`
  - `documents (projectId, doc JSON blob)`
  - `assets (id, projectId, kind: 'image'|'font', blob, mime, meta)`

- Autosave on idle (500 ms debounce). Versioned migrations on open.
- Export: `.wb.json` (document + inlined assets as data URLs). PNG/SVG export from current view or selection.

## Interaction model

- **Pan**: Cmd (Mac) / Ctrl (Windows) + drag. Trackpad two-finger drag.
- **Zoom**: Ctrl/Cmd + wheel. Pinch gesture. Zoom to cursor. Fit selection.
- **Select**: Click or marquee. Shift adds/removes.
- **Transform**: Drag to move. Handles for resize with aspect-lock (Shift). Rotate handle with snap (15°).
- **Edit**:
  - Shapes: live resize, corner radius for rect.
  - Line/Arrow: node drag, add/remove nodes (Alt-click).
  - Path: freehand smoothing (RDP ε configurable).
  - Text: inline editor with caret and rich controls.

- **Snap**: grid, object edges, centers, angles.
- **Guides**: smart alignment lines with distances.

## Hit-testing

- Broad phase: reverse z iteration; optional RBush spatial index for >2k shapes.
- Narrow phase: AABB test then shape-specific point-in-path. Text uses box; lines use distance-to-segment with tolerance = `max(6, strokeWidth)` in screen px.

## Undo/redo

- Command pattern. Push on commit (mouse up or text apply). Max history size N=200. Coalesce drags.

## Keyboard shortcuts

- V Select, R Rect, O Ellipse, L Line, A Arrow, P Path, T Text, I Image.
- Cmd/Ctrl+Z/Y. Cmd/Ctrl+D duplicate. Delete backspace.
- Cmd/Ctrl+G group (v2). ↑↓ raise/lower z. 1–9 stroke width presets.

## Theming and dark mode

- Tailwind with `data-theme` or `class="dark"`. Tokenized colors for canvas UI and selection. Canvas content colors unchanged; UI adapts.

## Performance

- Imperative draw with Konva Layer caching. Dirty-rect redraws on interaction frames with `requestAnimationFrame`.
- Pointer events throttled to 60 Hz. Text measurement cached per font/style.
- OffscreenCanvas for export rendering to avoid UI jank.

## Accessibility

- Toolbar buttons focusable with ARIA roles. Keyboard-only transform via nudge keys. High-contrast mode toggle. Text editor uses semantic inputs.

## Security

- Sanitize pasted text. Restrict imported assets to image MIME types. No external network calls by default.

## Testing

- Unit: geometry, transforms, hit-test, reducers.
- Component: React Testing Library for tools and panels.
- E2E: Playwright for draw-select-resize-save-reload flows.
- Performance budgets in CI (time to first draw, drag FPS on 1k shapes).

## Project management

- Project list view. Create, rename, duplicate, delete.
- Recent projects pinned. Per-project autosave snapshot and manual checkpoints.

## Acceptance criteria (v1)

- Create shapes, text, and images. Resize, rotate, move, delete.
- Pan and zoom within 10%–1600% with zoom to cursor.
- Selection with handles that match visual bounds at any zoom.
- Properties panel updates and applies styles in real time.
- Projects persist across reloads in IndexedDB. Multiple projects supported.
- Export PNG and JSON. Import JSON restores identical scene.
- Dark mode switches all UI without affecting canvas content.

## Non-goals (v1)

- Real-time multiuser. Connectors with routing. Custom plugins. Cloud sync.

## Delivery plan

- M1: Canvas viewport, pan/zoom, shape model, rect/ellipse/line, select/transform, save/load.
- M2: Text editor and styling, arrow/path, snapping and guides, export.
- M3: Image assets, project manager, performance pass, tests, a11y, dark mode polish.

## Notes on limits

- Maximum scene size bounded by numeric stability, not edges. Store positions as float64. Clamp zoom to avoid precision loss at ≥1600%.
