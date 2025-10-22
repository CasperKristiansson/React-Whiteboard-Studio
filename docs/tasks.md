# Implementation Tasks – React Whiteboard v1

This plan converts the approved requirements and design into small, reversible tasks sized 15–90 minutes, grouped into safe-to-ship milestones. Where appropriate, features are guarded behind local feature flags (URL query or localStorage) to enable incremental delivery.

---

## A) Backlog

- [x] T-store-01: Bootstrap state store and domain types (60m)
  - Goal: Initialize Zustand store with Immer, domain types (shapes, document, viewport, settings), and selectors.
  - Files/paths: `src/state/store.ts`, `src/types/shapes.ts`, `src/types/document.ts`, `src/types/common.ts`
  - Key edits: Define `Shape`, `DocumentV1`, `Transform`; implement store slices for document, selection, viewport, settings.
  - Dependencies: None
  - Estimate: 60

- [ ] T-history-01: Command history ring buffer (75m)
  - Goal: Add bounded undo/redo with coalesced drags and `commit(label)` API.
  - Files/paths: `src/state/history.ts`, `src/state/store.ts`
  - Key edits: Ring buffer with N=200, inverse ops/snapshot strategy, integrate with store actions.
  - Dependencies: T-store-01
  - Estimate: 75

- [ ] T-viewport-01: CanvasViewport with pan/zoom + clamp + zoom-to-cursor (90m)
  - Goal: Implement world↔screen transform T, clamped zoom [10%,1600%], space+drag pan, wheel/pinch zoom to cursor.
  - Files/paths: `src/canvas/CanvasViewport.tsx`, `src/canvas/transform.ts`, `src/app/App.tsx`
  - Key edits: Pointer handlers, wheel/pinch handling, transform utilities, rAF render scheduling.
  - Dependencies: T-store-01
  - Estimate: 90

- [ ] T-grid-01: Background grid layer (toggle) (45m)
  - Goal: Infinite pattern grid drawn in background, toggle via UI or settings.
  - Files/paths: `src/canvas/layers/GridLayer.tsx`, `src/state/store.ts`
  - Key edits: Grid draw routine using world units (5 px), toggle state.
  - Dependencies: T-viewport-01
  - Estimate: 45

- [ ] T-theme-01: Theme toggle and tokens (30m)
  - Goal: Light/Dark/System theme via Tailwind + CSS vars; content colors unchanged.
  - Files/paths: `src/app/AppShell.tsx`, `src/styles/tokens.css`, `tailwind.config.ts`
  - Key edits: Theme state, prefers-color-scheme sync, data-theme/class application.
  - Dependencies: T-store-01
  - Estimate: 30

- [ ] T-toolbar-01: Toolbar skeleton and tool switching (60m)
  - Goal: Floating toolbar (top-center) with tool buttons; wire to `activeTool`.
  - Files/paths: `src/ui/Toolbar.tsx`, `src/state/store.ts`
  - Key edits: Tool buttons for V/R/O/L/A/P/T/I; active state; a11y roles.
  - Dependencies: T-store-01
  - Estimate: 60

- [ ] T-shortcuts-01: Keyboard shortcuts (45m)
  - Goal: Global shortcuts for tools and edit actions (Z/Y/D/Delete).
  - Files/paths: `src/app/keyboard.ts`, `src/app/AppShell.tsx`, `src/state/store.ts`
  - Key edits: Keymap for V/R/O/L/A/P/T/I and Cmd/Ctrl+Z/Y/D/Delete/Backspace.
  - Dependencies: T-toolbar-01, T-history-01
  - Estimate: 45

- [ ] T-select-01: Selection (click + marquee) (75m)
  - Goal: Click and marquee selection; Shift add/remove; visual bounding box.
  - Files/paths: `src/canvas/controllers/SelectController.ts`, `src/canvas/overlays/SelectionOverlay.tsx`, `src/services/hittest.ts`
  - Key edits: Reverse z-order hit test; marquee extents; selection state ops.
  - Dependencies: T-viewport-01, T-store-01
  - Estimate: 75

- [ ] T-rect-01: Rectangle tool (60m)
  - Goal: Drag-to-create rectangle with default style; supports corner radius prop.
  - Files/paths: `src/canvas/controllers/RectController.ts`, `src/types/shapes.ts`
  - Key edits: Pointer drag, transient shape preview, commit on mouseup.
  - Dependencies: T-toolbar-01, T-store-01
  - Estimate: 60

- [ ] T-ellipse-01: Ellipse tool (60m)
  - Goal: Drag-to-create ellipse with rx/ry.
  - Files/paths: `src/canvas/controllers/EllipseController.ts`, `src/types/shapes.ts`
  - Key edits: Pointer drag, compute rx/ry; commit on mouseup.
  - Dependencies: T-toolbar-01, T-store-01
  - Estimate: 60

- [ ] T-line-01: Line tool (60m)
  - Goal: Polyline creation; drag/click adds points; finalize on double-click/Enter.
  - Files/paths: `src/canvas/controllers/LineController.ts`, `src/types/shapes.ts`
  - Key edits: Points array, tolerance for selection; commit lifecycle.
  - Dependencies: T-toolbar-01
  - Estimate: 60

- [ ] T-arrow-01: Arrow tool (45m)
  - Goal: Polyline with arrowhead; adjustable head size.
  - Files/paths: `src/canvas/controllers/ArrowController.ts`, `src/types/shapes.ts`
  - Key edits: Arrowhead rendering, headSize property.
  - Dependencies: T-line-01
  - Estimate: 45

- [ ] T-path-01: Freehand path + RDP smoothing (90m)
  - Goal: Capture freehand strokes; apply Ramer–Douglas–Peucker with configurable epsilon.
  - Files/paths: `src/canvas/controllers/PathController.ts`, `src/utils/rdp.ts`
  - Key edits: Pointer sampling at throttle, smoothing, commit.
  - Dependencies: T-viewport-01
  - Estimate: 90

- [ ] T-transform-01: Transform handles (move/resize/rotate with snap) (90m)
  - Goal: Figma-style handles; Shift aspect lock; rotate handle with 15° snap.
  - Files/paths: `src/canvas/overlays/SelectionOverlay.tsx`, `src/canvas/controllers/TransformController.ts`
  - Key edits: Handle geometry, drag math, rotation snapping, z-index raise/lower via keys.
  - Dependencies: T-select-01
  - Estimate: 90

- [ ] T-context-01: ContextPanel properties binding (75m)
  - Goal: Property inspector reflects selection and updates styles live.
  - Files/paths: `src/ui/ContextPanel.tsx`, `src/state/store.ts`
  - Key edits: Bind stroke/fill/strokeWidth, text props; immediate application.
  - Dependencies: T-select-01, T-rect-01, T-ellipse-01, T-line-01
  - Estimate: 75

- [ ] T-text-01: Text tool with inline editor (90m)
  - Goal: Create text box; enter inline edit; apply styles.
  - Files/paths: `src/canvas/controllers/TextController.ts`, `src/ui/TextEditor.tsx`, `src/types/shapes.ts`
  - Key edits: Editor overlay, commit on blur/Enter, handle wrapping in box.
  - Dependencies: T-toolbar-01, T-context-01
  - Estimate: 90

- [ ] T-text-style-01: Text measurement cache and styling controls (75m)
  - Goal: Cache measurements per font/style; controls for family/weight/size/letter/line/align/italic/underline/shadow.
  - Files/paths: `src/utils/textMeasure.ts`, `src/ui/Toolbar.tsx`, `src/ui/ContextPanel.tsx`
  - Key edits: Cache map, invalidation rules, style bindings.
  - Dependencies: T-text-01
  - Estimate: 75

- [ ] T-snap-01: Snap to grid/edges/centers/angles (90m)
  - Goal: Snap candidates computed and applied during drag/resize/rotate.
  - Files/paths: `src/services/snap.ts`, `src/canvas/controllers/TransformController.ts`
  - Key edits: Grid/object/angle snaps; toggleable in settings; behind feature flag by default.
  - Dependencies: T-transform-01
  - Estimate: 90

- [ ] T-guides-01: Alignment guides overlay (60m)
  - Goal: Render guides and distances when snapping; toggleable.
  - Files/paths: `src/canvas/overlays/GuidesOverlay.tsx`, `src/services/snap.ts`
  - Key edits: Guide lines rendering, distance labels.
  - Dependencies: T-snap-01
  - Estimate: 60

- [ ] T-assets-01: AssetManager + image insertion (75m)
  - Goal: Import/validate image MIME; store in IndexedDB; insert `ImageShape` with object-fit.
  - Files/paths: `src/services/assets.ts`, `src/ui/AssetManager.tsx`, `src/canvas/controllers/ImageController.ts`
  - Key edits: File picker, blob storage, preview, drag-to-place.
  - Dependencies: T-persist-01
  - Estimate: 75

- [ ] T-export-01: Export .wb.json (75m)
  - Goal: Export document + inlined assets (data URLs) to .wb.json.
  - Files/paths: `src/export/json.ts`, `src/ui/ExportDialog.tsx`
  - Key edits: Serializer, data URL embedding, download.
  - Dependencies: T-assets-01, T-store-01
  - Estimate: 75

- [ ] T-export-02: Export PNG (viewport/selection) (75m)
  - Goal: OffscreenCanvas when available; fallback path; current view or selection.
  - Files/paths: `src/export/png.ts`, `src/ui/ExportDialog.tsx`
  - Key edits: Render to canvas, scaling, selection bounds.
  - Dependencies: T-viewport-01, T-select-01
  - Estimate: 75

- [ ] T-export-03: Export SVG (viewport/selection) (90m)
  - Goal: Generate SVG from shapes with correct styles; selection or viewport.
  - Files/paths: `src/export/svg.ts`, `src/ui/ExportDialog.tsx`
  - Key edits: Shape-to-SVG, text styles, clipping by viewport.
  - Dependencies: T-select-01, T-text-style-01
  - Estimate: 90

- [ ] T-import-01: Import .wb.json (60m)
  - Goal: Parse export; restore document/assets; validation and errors.
  - Files/paths: `src/import/json.ts`, `src/ui/ImportDialog.tsx`
  - Key edits: Deserializer, asset storage, error handling.
  - Dependencies: T-export-01, T-assets-01
  - Estimate: 60

- [ ] T-persist-01: Dexie schema + migrations + adapter (90m)
  - Goal: Dexie DB with `projects`, `documents`, `assets`; versioned migrations.
  - Files/paths: `src/persistence/db.ts`, `src/persistence/adapter.ts`
  - Key edits: Table schemas, open/upgrade, API for save/load/list.
  - Dependencies: T-store-01
  - Estimate: 90

- [ ] T-persist-02: Autosave debounce + dirty flag (45m)
  - Goal: 500 ms debounced autosave on idle; robust to frequent edits.
  - Files/paths: `src/persistence/autosave.ts`, `src/state/store.ts`
  - Key edits: Debounce utility, save triggers, error surface.
  - Dependencies: T-persist-01
  - Estimate: 45

- [ ] T-projects-01: ProjectManager UI (CRUD + pin recent) (90m)
  - Goal: List, create, rename, duplicate, delete; open last document.
  - Files/paths: `src/ui/ProjectManager.tsx`, `src/persistence/adapter.ts`
  - Key edits: CRUD flows, pinned list, guarded route/view.
  - Dependencies: T-persist-01, T-persist-02
  - Estimate: 90

- [ ] T-security-01: Sanitize pasted/typed text (30m)
  - Goal: Strip scripts/unsafe HTML; ensure plain text + style.
  - Files/paths: `src/security/sanitize.ts`, `src/ui/TextEditor.tsx`
  - Key edits: Sanitizer utility; integrate in editor/paste path.
  - Dependencies: T-text-01
  - Estimate: 30

- [ ] T-observe-01: Perf marks + optional debug overlay (60m)
  - Goal: `performance.mark/measure` around draw/hit/export; optional dev overlay (FPS, dirty rects, snap hits).
  - Files/paths: `src/dev/perf.ts`, `src/dev/DebugOverlay.tsx`, `src/app/AppShell.tsx`
  - Key edits: Gated by query/localStorage flag `debug`.
  - Dependencies: T-viewport-01, T-select-01
  - Estimate: 60

- [ ] T-error-01: Error taxonomy and user-friendly messages (45m)
  - Goal: AppError codes, try/catch wrappers for persistence/import/export; toasts/dialogs.
  - Files/paths: `src/errors.ts`, `src/ui/ErrorBoundary.tsx`, `src/ui/Toasts.tsx`
  - Key edits: AppError class, error boundaries, surface actionable guidance.
  - Dependencies: T-persist-01, T-export-01, T-import-01
  - Estimate: 45

- [ ] T-flag-01: Feature flags (snap/guides/exports) (30m)
  - Goal: LocalStorage/URL flags to gate Snap, Guides, and Advanced Exports.
  - Files/paths: `src/app/flags.ts`, `src/app/AppShell.tsx`
  - Key edits: Read flags, set defaults; hide UI when disabled.
  - Dependencies: None
  - Estimate: 30

---

## B) Milestones

- M1: Foundation & Viewport (ship behind flags where relevant)
  - Tasks: T-store-01, T-viewport-01, T-grid-01, T-theme-01, T-toolbar-01, T-shortcuts-01, T-flag-01
  - Exit criteria:
    - Pan/zoom with clamps and zoom-to-cursor works; grid toggle and theme toggle available.
    - Toolbar switches active tool; shortcuts for tool switching and basic edits.

- M2: Core Shapes & Selection
  - Tasks: T-select-01, T-rect-01, T-ellipse-01, T-line-01, T-arrow-01, T-transform-01, T-history-01
  - Exit criteria:
    - Create rectangle/ellipse/line/arrow; selection with bounding box; move/resize/rotate (snap 15°) and undo/redo.

- M3: Text & Styling
  - Tasks: T-text-01, T-text-style-01, T-context-01, T-security-01
  - Exit criteria:
    - Inline text editing with styling applies in real time; sanitized text.

- M4: Snapping & Guides (flagged by default)
  - Tasks: T-snap-01, T-guides-01
  - Exit criteria:
    - Snap to grid/object edges/centers/angles; alignment guides and distances visible when enabled.

- M5: Persistence & Projects
  - Tasks: T-persist-01, T-persist-02, T-projects-01
  - Exit criteria:
    - Projects persist across reloads; autosave (500ms debounce); CRUD flows operational.

- M6: Assets & Export/Import
  - Tasks: T-assets-01, T-export-01, T-export-02, T-export-03, T-import-01, T-error-01
  - Exit criteria:
    - Import/export JSON; export PNG/SVG (viewport/selection); asset validations with helpful errors.

- M7: Performance & Observability (dev-only)
  - Tasks: T-observe-01
  - Exit criteria:
    - Perf marks and dev overlay enabled by flag; manual checks hit budget targets.

---

## C) AC Checklist

- [ ] AC-zoom-01 — Verifier: Dev
  - [ ] Zoom clamped to min 10%
  - [ ] Zoom clamped to max 1600%
  - [ ] Zoom-to-cursor works for wheel/pinch

- [ ] AC-pan-01 — Verifier: Dev
  - [ ] Space + drag pans viewport
  - [ ] Trackpad two-finger drag pans viewport

- [ ] AC-tools-01 — Verifier: Dev
  - [ ] Rectangle/Ellipse/Line/Arrow/Path/Text tools create shapes with default styles
  - [ ] Drag interactions commit on mouse up

- [ ] AC-select-01 — Verifier: Dev
  - [ ] Click selects single shape with bounding box
  - [ ] Marquee selects shapes fully enclosed
  - [ ] Shift toggles selection adds/removes

- [ ] AC-transform-01 — Verifier: Dev
  - [ ] Resize with Shift preserves aspect ratio
  - [ ] Rotate snaps at 15° increments

- [ ] AC-text-01 — Verifier: Dev
  - [ ] Inline edit supports caret/selection
  - [ ] Styling applies live (family, weight, size, letter, line, align, italic, underline, color, shadow)

- [ ] AC-snap-01 — Verifier: Dev (flag on)
  - [ ] Snap to grid/object edges/centers/angles works when enabled
  - [ ] Alignment guides show distances when snapping

- [ ] AC-import-01 — Verifier: QA
  - [ ] Import of a previously exported .wb.json restores identical scene

- [ ] AC-export-01 — Verifier: QA
  - [ ] Export current view to PNG reflects visible canvas content
  - [ ] Export selection to SVG includes only selected shapes with correct styles

- [ ] AC-undo-01 — Verifier: Dev
  - [ ] Cmd/Ctrl+Z undoes last committed action
  - [ ] Cmd/Ctrl+Y redoes last undone action
  - [ ] History bounded to 200 entries

- [ ] AC-projects-01 — Verifier: QA
  - [ ] Multiple projects listed with pinned recents
  - [ ] Reload preserves project list and latest autosave per project

- [ ] AC-theme-01 — Verifier: Design QA
  - [ ] UI switches light/dark without changing canvas content colors

- [ ] AC-keyboard-01 — Verifier: Dev
  - [ ] T activates Text tool; V activates Select tool

- [ ] AC-security-01 — Verifier: Dev
  - [ ] Non-image assets are rejected with a helpful error

- [ ] AC-accessibility-01 — Verifier: QA
  - [ ] Toolbar and controls are keyboard-focusable with ARIA roles
  - [ ] Keyboard nudge moves selected shape by expected amount

---

## D) Context Digest

- docs/requirements.md: Approved requirements and ACs for v1
- docs/design.md: Technical design, component boundaries, data contracts, and traceability
- docs/description.md: Original technical spec used to derive requirements

---

## Ready to implement

Please review and approve:
- docs/requirements.md
- docs/design.md
- docs/docs/tasks.md

Once approved, we’ll implement milestone M1 as a small PR guarded by local feature flags where applicable.
