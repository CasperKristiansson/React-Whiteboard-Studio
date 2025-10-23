# React Whiteboard – Requirements Specification (v1)

## 1. Summary

A browser-based whiteboard built with React and TypeScript that supports creating and editing shapes, freehand paths, arrows, and text on an infinite canvas with pan/zoom. It includes snapping, selection with Figma-style bounding boxes, rich text styling, local persistence with multi-project support, image assets, import/export (JSON/PNG/SVG), dark mode, and undo/redo.

## 2. Business Context and Goals

- Provide a fast, privacy-friendly, offline-capable diagramming/whiteboarding tool for individuals and small teams.
- Target rapid sketching, ideation, wireframing, and lightweight diagramming without cloud accounts or server costs.
- Deliver a polished, responsive UX with familiar tooling paradigms (Figma-like selection/handles) to reduce learning curve.
- Enable persistent projects stored locally in the browser (IndexedDB) with easy import/export for sharing or backup.

Assumptions:

- No backend services; all data persists locally to the user’s browser.
- The app is distributed as a static site (e.g., Vite build) and runs fully client-side.

## 3. In Scope and Out of Scope

In scope (v1):

- Infinite canvas with pan and zoom (10%–1600%) and zoom-to-cursor.
- Tools: Select, Rectangle, Ellipse, Line/Arrow, Freehand Path, Text, Image.
- Selection overlay with resize, rotate, and drag handles.
- Creative text styling (font family/weight/size, letter spacing, line height, alignment, color, shadow).
- Local persistence with multi-project support; autosave; import/export (JSON/PNG/SVG).
- Dark mode and themed UI.
- Undo/redo with a bounded history (ring buffer, N=200).
- Snapping to grid/object edges/centers/angles and alignment guides.
- Performance-conscious rendering with Konva and layer caching.
- Accessibility affordances for tools and keyboard interactions.

Out of scope (v1):

- Real-time multi-user collaboration.
- Connector routing logic beyond basic lines/arrows.
- Plugin architecture and extensibility.
- Cloud sync or server-side storage.

## 4. Users and Use Cases

Primary users (assumed):

- Designers and product managers producing quick wireframes and flows.
- Engineers and students sketching system diagrams or notes.
- Educators presenting concepts with basic visuals and annotations.

Representative use cases:

- Create a quick system diagram with rectangles, ellipses, arrows, and labels.
- Annotate screenshots by importing an image and drawing callouts.
- Draft wireframes with text and shapes; export a PNG for documentation.
- Maintain multiple local projects, switching between them without data loss.

## 5. Functional Requirements

Canvas and viewport

- FR-CAN-01: The canvas is effectively infinite; users can pan in any direction.
- FR-CAN-02: Zoom ranges from 10% to 1600%, clamped to these limits.
- FR-CAN-03: Zoom-to-cursor behavior is supported for wheel/pinch zoom.
- FR-CAN-04: A grid can be toggled on/off; default grid step is 5 world units.

Tools and drawing

- FR-TOOL-01: Tools include Select, Rectangle, Ellipse, Line, Arrow, Path, Text, and Image.
- FR-TOOL-02: Rectangle supports size and optional corner radius.
- FR-TOOL-03: Ellipse supports rx/ry radii.
- FR-TOOL-04: Line and Arrow support multiple points; Arrow has adjustable head size.
- FR-TOOL-05: Path supports freehand input; optional smoothing parameter (RDP epsilon).
- FR-TOOL-06: Image tool inserts an image by asset selection/upload; supports object-fit contain/cover.
- FR-TOOL-07: Text tool creates a text box for inline editing.

Selection and transforms

- FR-SEL-01: Clicking or marquee selects shapes; Shift modifies selection.
- FR-SEL-02: Selection shows bounding box with handles for move, resize, and rotate.
- FR-SEL-03: Resize supports aspect lock with Shift; rotation snaps to 15° increments.
- FR-SEL-04: Z-index ordering is supported; raise/lower via keyboard arrows.
- FR-SEL-05: Locked or hidden shapes are not directly editable or selectable as appropriate.

Snapping and guides

- FR-SNAP-01: Snap to grid, object edges, object centers, and angles can be enabled.
- FR-SNAP-02: Guides display alignment lines and distances when relevant.

Text styling

- FR-TXT-01: Text editing is inline with caret and selection.
- FR-TXT-02: Style controls include font family, weight, size, letter spacing, line height, alignment, italic, underline, fill/stroke color, and optional shadow.
- FR-TXT-03: Text box sizing supports wrapping within the given box dimensions.

Hit-testing

- FR-HIT-01: Broad-phase hit test iterates in reverse z-order; optional RBush index for large scenes (>2k shapes).
- FR-HIT-02: Narrow-phase applies AABB first, then shape-specific tests (e.g., point-in-path, distance-to-segment for lines with tolerance = max(6, strokeWidth) in screen px).

Undo/redo

- FR-UNDO-01: Actions commit on mouse-up or text apply and are pushed to command history.
- FR-UNDO-02: History is bounded (N=200) and coalesces drag interactions.

Keyboard shortcuts

- FR-KBD-01: Tool shortcuts: V (Select), R (Rect), O (Ellipse), L (Line), A (Arrow), P (Path), T (Text), I (Image).
- FR-KBD-02: Editing shortcuts: Cmd/Ctrl+Z (Undo), Cmd/Ctrl+Y (Redo), Cmd/Ctrl+D (Duplicate), Delete/Backspace (Delete).
- FR-KBD-03: Grouping shortcut Cmd/Ctrl+G reserved for v2 (no-op or disabled in v1).
- FR-KBD-04: Nudge and z-order arrows: Up/Down adjust z-index.
- FR-KBD-05: Stroke width presets 1–9 map to defined widths.

Persistence and projects

- FR-PER-01: Documents are stored in IndexedDB (Dexie) with versioned migrations.
- FR-PER-02: Projects can be created, renamed, duplicated, deleted; recent projects can be pinned.
- FR-PER-03: Autosave occurs on idle with a 500 ms debounce.
- FR-PER-04: Small settings (e.g., theme) are stored in localStorage.

Assets and export/import

- FR-ASS-01: Assets include images and fonts with metadata and MIME types.
- FR-ASS-02: Export supports JSON (.wb.json) with inlined assets (data URLs) and PNG/SVG of current view or selection.
- FR-ASS-03: Import of .wb.json restores an identical scene.
- FR-ASS-04: Imported assets are restricted to image MIME types.

Theming and UI

- FR-UI-01: A theme toggle supports light, dark, and system modes.
- FR-UI-02: UI uses Tailwind CSS with CSS variables; canvas content colors remain unchanged across themes.
- FR-UI-03: Toolbar is floating, rounded, top-center; includes color pickers, stroke width, font controls.
- FR-UI-04: Context panel shows live properties for selected objects and applies changes in real time.

Components (structure)

- FR-CMP-01: AppShell hosts theme toggler, project switcher, and app-wide shortcuts.
- FR-CMP-02: CanvasViewport handles pan/zoom, event routing, and render loop.
- FR-CMP-03: ProjectManager manages project lifecycle and list view.
- FR-CMP-04: AssetManager handles image/font assets and preloads.

## 6. Acceptance Criteria (Gherkin)

AC-zoom-01

```
Scenario: Zoom clamps within supported range
  Given an open canvas
  When the user zooms out repeatedly
  Then the zoom level does not go below 10%
  And when the user zooms in repeatedly
  Then the zoom level does not exceed 1600%
```

AC-pan-01

```
Scenario: Pan with Cmd/Ctrl + drag
  Given the Select tool is active
  And the user holds Space
  When the user drags on the canvas
  Then the viewport pans following the pointer
```

AC-tools-01

```
Scenario: Create basic shapes
  Given the Rectangle tool is active
  When the user drags on the canvas
  Then a rectangle is created with the dragged size and default style
  And similar behavior applies to Ellipse, Line, Arrow, Path, and Text tools
```

AC-select-01

```
Scenario: Click and marquee selection
  Given multiple shapes exist
  When the user clicks a shape
  Then that shape becomes selected and shows a bounding box with handles
  When the user drag-selects with marquee
  Then shapes fully within the marquee become selected
  And holding Shift toggles selection state for clicked shapes
```

AC-transform-01

```
Scenario: Resize with aspect lock and rotate snap
  Given a selected shape
  When the user drags a corner handle while holding Shift
  Then the shape resizes preserving aspect ratio
  When the user rotates the shape
  Then rotation snaps at 15-degree increments
```

AC-text-01

```
Scenario: Inline text editing and styling
  Given a selected text shape
  When the user enters edit mode
  Then the user can edit text inline
  And apply font family, weight, size, letter spacing, line height, alignment, italic, underline, fill color, and shadow
  And the changes update in real time
```

AC-snap-01

```
Scenario: Snap to grid and objects
  Given snapping is enabled
  When the user drags a shape near grid lines, edges, or centers of other shapes
  Then the shape position snaps accordingly
  And alignment guides and distances display when applicable
```

AC-import-01

```
Scenario: Import JSON restores scene
  Given a valid .wb.json export from the app
  When the user imports the file
  Then the document and assets load
  And the scene is identical to the exported state
```

AC-export-01

```
Scenario: Export current view or selection to PNG/SVG
  Given shapes are present
  When the user exports the current view to PNG
  Then a PNG image contains the visible canvas content
  When the user exports a selection to SVG
  Then an SVG file contains only the selected shapes with correct styles
```

AC-undo-01

```
Scenario: Undo/redo command history
  Given a sequence of edits
  When the user presses Cmd/Ctrl+Z
  Then the last committed action is undone
  When the user presses Cmd/Ctrl+Y
  Then the last undone action is reapplied
  And the history is bounded to 200 entries
```

AC-projects-01

```
Scenario: Projects persist across reloads
  Given multiple projects exist
  When the user reloads the page
  Then the project list and each project’s latest autosaved document are available
```

AC-theme-01

```
Scenario: Dark mode affects UI only
  Given content exists on the canvas
  When the user toggles dark mode
  Then the application UI theme changes
  And canvas content colors remain unchanged
```

AC-keyboard-01

```
Scenario: Tool shortcuts
  Given the app is focused
  When the user presses T
  Then the Text tool becomes active
  And pressing V returns to the Select tool
```

AC-security-01

```
Scenario: Asset import restrictions
  Given a user attempts to import a non-image asset
  When the asset is validated
  Then the import is rejected with a helpful error message
```

AC-accessibility-01

```
Scenario: Keyboard-only selection and transform
  Given a shape is selected
  When the user uses keyboard nudge controls
  Then the shape moves predictably by the nudge distance
  And toolbar and controls are reachable via keyboard focus
```

## 7. Non-Functional Requirements

Performance

- NFR-PERF-01: Pointer events throttle at ~60 Hz during interactions.
- NFR-PERF-02: For a scene with 1,000 simple shapes, drag interactions target ≥ 30 FPS on a typical laptop (CI budgeted check).
- NFR-PERF-03: Time to first draw under 800 ms for a document with ≤ 100 shapes on typical hardware (CI budgeted check).
- NFR-PERF-04: Text measurement results are cached per font/style to avoid layout jank.
- NFR-PERF-05: Rendering uses Konva layer caching and dirty-rect redraws within rAF.

Security

- NFR-SEC-01: Pasted text is sanitized to remove harmful HTML/script content.
- NFR-SEC-02: Imported assets are restricted to image MIME types; reject others.
- NFR-SEC-03: No external network calls by default.

Privacy

- NFR-PRIV-01: All user data (documents, assets, settings) persists locally in IndexedDB/localStorage.
- NFR-PRIV-02: No telemetry or tracking by default.
- NFR-PRIV-03: Exports may contain user content and embedded assets; the app clearly communicates this.

Availability

- NFR-AV-01: The application works offline after initial load (static client bundle).
- NFR-AV-02: IndexedDB write failures or quota errors surface clear messages and recovery guidance.

Cost

- NFR-COST-01: No server or per-user cloud costs for runtime; all costs limited to development and hosting static assets.

Cross-compatibility

- NFR-COMP-01: Supported browsers: latest Chrome/Edge, Firefox, and Safari (assumed); fallbacks for features like OffscreenCanvas when unavailable.

## 8. Compliance and Regulatory

- No industry-specific compliance requirements identified for a local-only client app.
- Aim for WCAG 2.1 AA-aligned accessibility of UI controls and keyboard navigation where feasible.
- Data remains on-device; GDPR/CCPA concerns are minimized. If future features transmit data, privacy disclosures and consent will be required.

## 9. Risks and Mitigations

- RISK-PERF: Large scenes (> 2k shapes) may degrade performance. Mitigate with optional RBush spatial index and layer caching; provide guidance on limits.
- RISK-PRECISION: High zoom (≥ 1600%) may expose floating-point precision issues. Mitigate by clamping zoom and using float64 for positions.
- RISK-FONTS: Text rendering varies by platform; font availability may differ. Mitigate with font preloading and fallbacks; cache measurements.
- RISK-IDB: IndexedDB quotas/migrations can fail. Mitigate with versioned Dexie migrations, backups via export, and clear error handling.
- RISK-ASSETS: Large embedded assets increase bundle/export size. Mitigate with size warnings and progressive previews.
- RISK-INPUT: Touch/trackpad gesture variability across browsers. Mitigate with well-tested gesture handling and fallbacks.
- RISK-FEATURE-GAP: Some planned v2 items (e.g., grouping) might be expected by users. Mitigate by clear UI affordances/disabled states and roadmap notes.

## 10. Assumptions and Dependencies

Assumptions

- No server-side components; static hosting of the client app.
- Browser environment with IndexedDB and modern Canvas2D support.
- Node.js LTS for development; exact version TBD.
- Package manager (npm/yarn/pnpm) TBD.

Dependencies (planned per spec)

- React + TypeScript + Vite, Tailwind CSS, ESLint.
- State: Zustand + Immer; command history ring buffer for undo/redo.
- Rendering: Konva via react-konva; optional OffscreenCanvas.
- UI: Tailwind + CSS variables; Headless UI or Radix Primitives (selection pending) for a11y.
- Storage: Dexie (IndexedDB); localStorage for small settings.

## 11. Open Questions

- Which UI primitives library will be used: Headless UI or Radix? Any licensing considerations?
- Minimum browser versions supported? Is mobile/touch-first UI a requirement in v1?
- Exact stroke width presets for keys 1–9 and their units?
- Default fonts, available font families, and bundling strategy (web fonts vs. system fonts)?
- Maximum recommended asset size and behavior on large imports (warn, compress, reject)?
- PNG/SVG export DPI/scaling options and naming conventions?
- Should selection/marquee include partially intersecting shapes or only fully enclosed? Configurable?
- What are the default grid visibility and snap toggles at first run?
- Any analytics or telemetry in the future? If yes, opt-in model and privacy posture.

## 12. Context Digest

- docs/description.md: Technical spec for the React whiteboard covering scope, architecture, interaction model, data model, performance, accessibility, security, testing, and delivery plan.
- (No package.json, tsconfig, CI, or source directories present in the repository at this time.)
