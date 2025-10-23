# Verification Checklist

Use this suite to manually verify every major feature after automated work completes.

## Canvas Basics
- [x] Launch the app; confirm toolbar, context panel, asset manager, project manager, and export/import sections render without console errors.
- [x] Pan with Cmd/Ctrl + drag, trackpad gestures, and mouse wheel; confirm zoom snaps to cursor and clamps between 10%–1600%.
- [x] Toggle grid and snap controls; ensure settings persist after page refresh.
- [x] Enable `?debug` query flag; confirm debug overlay displays fps, counts, and live data.

## Drawing Tools & Interactions
- [ ] Select tool: click single shapes, marquee select multiple, shift-add/remove, delete via keyboard.
- [ ] Rectangle tool: draw, resize, ensure border/fill controls apply and update text bounds in context panel.
- [ ] Ellipse tool: draw ellipses, verify rx/ry adjustments and styling updates.
- [ ] Line tool: multi-click creates segments, double-click/Enter finalises; ensure arrow tool renders head sizes correctly.
- [ ] Path tool: freehand draw; confirm smoothing and finalisation.
- [ ] Text tool: insert, inline edit, sanitize pasted HTML, typography controls (font, weight, size, spacing, line-height), toggle italic/underline, change alignment.
- [ ] Image tool: insert existing asset onto canvas; verify aspect ratio scaling and selection behaviour.

## Selection & Transform
- [ ] Move: drag selection, confirm snapping guides appear when snap enabled, toggled off otherwise.
- [ ] Resize: drag handles (all directions), shift-lock aspect, check snap guides, minimum size enforcement.
- [ ] Rotate: drag rotation handle, shift snaps at 15° increments, guides display angles.
- [ ] Duplicate selection via keyboard (Cmd/Ctrl + D) and verify z-index increment.

## Assets & Projects
- [ ] Asset import: upload PNG/JPEG/SVG/WebP, handle invalid types gracefully with error toast.
- [ ] Asset reuse: insert imported asset multiple times, ensuring the same asset id is used.
- [ ] Asset removal: (not yet implemented) confirm absence of removal actions or flag for future work.
- [ ] Project create: add new project, autosave initial document, switch between projects.
- [ ] Project rename, duplicate, delete: verify actions update project list and load the correct document; deletion selects next project or clears current state.

## Persistence & Autosave
- [ ] Make edits, wait >500 ms idle; refresh page and confirm changes persist.
- [ ] Switch projects after edits; confirm autosave completes before load and history resets.
- [ ] Feature flags: toggle snap/guides/advanced exports via URL (`?flag-snap=false` etc.) and localStorage; ensure UI respects flag states.

## Export / Import
- [ ] Export `.wb.json`: confirm file downloads with embedded assets, correct shape count, and re-import restores identical scene.
- [ ] Export PNG (document/selection): verify downloaded images match current view/selection, including rotation and styling.
- [ ] Export SVG (document/selection): confirm asset data URLs embed correctly and geometry/typography render in external viewer.
- [ ] Import `.wb.json`: overwrite current project with imported document and assets, autosave state remains clean.

## Error Handling & UI Feedback
- [ ] Trigger persistence failure (simulate via devtools or limited storage) and check descriptive error toast.
- [ ] Trigger asset import failure (invalid file) and verify error message + toast.
- [ ] Trigger export/import errors (modify bundle, network offline) and confirm errors bubble to UI.
- [ ] Dismiss error toasts manually and auto-dismiss after timeout.

## Miscellaneous
- [ ] Theme toggle (system/light/dark) updates UI and respects OS changes when in system mode.
- [ ] Keyboard shortcuts: tool switching (V,R,O,L,A,P,T,I), undo/redo, duplicate, delete, zoom in/out.
- [ ] History: verify undo/redo stack up to 200 actions, coalesced drags commit once.
- [ ] Snap and guide feature flags default to enabled; with flags disabled, corresponding UI controls and behaviours should hide/disable.

Complete all checks before considering the build verified.
