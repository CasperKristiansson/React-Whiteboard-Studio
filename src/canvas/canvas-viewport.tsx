import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEventHandler,
} from "react";

import {
  applyZoomAtPoint,
  screenDeltaToWorld,
  screenPointToWorld,
  worldPointToScreen,
} from "./transform";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  selectActiveTool,
  selectSettings,
  selectShapes,
  selectSelection,
  selectViewport,
  useAppSelector,
  useAppStore,
} from "../state/store";
import type { Shape, Vec2 } from "../types";
import GridLayer from "./layers/grid-layer";
import SelectionOverlay, {
  type ScreenRect,
  type HandlePosition,
} from "./overlays/selection-overlay";
import {
  createTransformSnapshot,
  restoreSnapshot,
  applyTranslation,
  applyScale,
  applyRotation,
  type TransformSnapshot,
} from "./controllers/transform-controller";
import {
  createWorldMarquee,
  getShapesWithinBounds,
  hitTestShapes,
} from "../services/hittest";
import { getShapeBounds, type ShapeBounds } from "../services/geometry";
import {
  beginRect,
  cancelRect,
  finalizeRect,
  updateRect,
  type RectDragState,
} from "./controllers/rect-controller";
import {
  beginEllipse,
  cancelEllipse,
  finalizeEllipse,
  updateEllipse,
  type EllipseDragState,
} from "./controllers/ellipse-controller";
import {
  beginPolyline,
  cancelPolyline,
  finalizePolyline,
  updatePolyline,
  type PolylineState,
} from "./controllers/polyline-controller";
import {
  beginPath,
  cancelPath,
  finalizePath,
  updatePath,
  type PathState,
} from "./controllers/path-controller";

const PAN_COMMIT_DELAY = 120;
const MIN_SCALE_SIZE = 4;
const ROTATE_SNAP_STEP_DEGREES = 15;
const ROTATE_SNAP_STEP_RADIANS = (Math.PI / 180) * ROTATE_SNAP_STEP_DEGREES;

const snapRotationAngle = (angle: number, shouldSnap: boolean) =>
  shouldSnap
    ? Math.round(angle / ROTATE_SNAP_STEP_RADIANS) *
      ROTATE_SNAP_STEP_RADIANS
    : angle;

type MoveTransformState = {
  mode: "move";
  pointerId: number;
  snapshot: TransformSnapshot;
  originalBounds: ShapeBounds;
  startWorld: Vec2;
};

type ScaleTransformState = {
  mode: "scale";
  pointerId: number;
  snapshot: TransformSnapshot;
  originalBounds: ShapeBounds;
  handle: HandlePosition;
};

type RotateTransformState = {
  mode: "rotate";
  pointerId: number;
  snapshot: TransformSnapshot;
  originalBounds: ShapeBounds;
  center: Vec2;
  startAngle: number;
  currentAngle: number;
};

type TransformState =
  | MoveTransformState
  | ScaleTransformState
  | RotateTransformState;

const isTextInput = (element: EventTarget | null): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  const tag = element.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    element.isContentEditable ||
    element.getAttribute("role") === "textbox"
  );
};

type PointerState = {
  active: boolean;
  pointerId: number | null;
  last: Vec2;
};

const getBoundsCenter = (bounds: ShapeBounds): Vec2 => ({
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
});

const cornerHandles: HandlePosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const computeScaledBounds = (
  handle: HandlePosition,
  bounds: ShapeBounds,
  pointer: Vec2,
  shiftKey: boolean
): ShapeBounds => {
  let { minX, minY, maxX, maxY } = bounds;

  let newMinX = minX;
  let newMaxX = maxX;
  let newMinY = minY;
  let newMaxY = maxY;

  switch (handle) {
    case "top-left":
      newMinX = Math.min(pointer.x, maxX - MIN_SCALE_SIZE);
      newMinY = Math.min(pointer.y, maxY - MIN_SCALE_SIZE);
      break;
    case "top-right":
      newMaxX = Math.max(pointer.x, minX + MIN_SCALE_SIZE);
      newMinY = Math.min(pointer.y, maxY - MIN_SCALE_SIZE);
      break;
    case "bottom-left":
      newMinX = Math.min(pointer.x, maxX - MIN_SCALE_SIZE);
      newMaxY = Math.max(pointer.y, minY + MIN_SCALE_SIZE);
      break;
    case "bottom-right":
      newMaxX = Math.max(pointer.x, minX + MIN_SCALE_SIZE);
      newMaxY = Math.max(pointer.y, minY + MIN_SCALE_SIZE);
      break;
    case "top":
      newMinY = Math.min(pointer.y, maxY - MIN_SCALE_SIZE);
      break;
    case "bottom":
      newMaxY = Math.max(pointer.y, minY + MIN_SCALE_SIZE);
      break;
    case "left":
      newMinX = Math.min(pointer.x, maxX - MIN_SCALE_SIZE);
      break;
    case "right":
      newMaxX = Math.max(pointer.x, minX + MIN_SCALE_SIZE);
      break;
  }

  let newWidth = newMaxX - newMinX;
  let newHeight = newMaxY - newMinY;

  if (shiftKey && cornerHandles.includes(handle)) {
    const originalWidth = Math.max(bounds.maxX - bounds.minX, MIN_SCALE_SIZE);
    const originalHeight = Math.max(bounds.maxY - bounds.minY, MIN_SCALE_SIZE);
    const aspect = originalHeight / originalWidth;

    if (aspect > 0) {
      if (Math.abs(newWidth * aspect) > Math.abs(newHeight)) {
        newHeight = Math.abs(newWidth) * aspect;
        if (handle === "top-left" || handle === "top-right") {
          newMinY = newMaxY - newHeight;
        } else {
          newMaxY = newMinY + newHeight;
        }
      } else {
        newWidth = Math.abs(newHeight) / aspect;
        if (handle === "top-left" || handle === "bottom-left") {
          newMinX = newMaxX - newWidth;
        } else {
          newMaxX = newMinX + newWidth;
        }
      }
    }
  }

  if (newMaxX - newMinX < MIN_SCALE_SIZE) {
    if (
      handle === "left" ||
      handle === "top-left" ||
      handle === "bottom-left"
    ) {
      newMinX = newMaxX - MIN_SCALE_SIZE;
    } else {
      newMaxX = newMinX + MIN_SCALE_SIZE;
    }
  }

  if (newMaxY - newMinY < MIN_SCALE_SIZE) {
    if (handle === "top" || handle === "top-left" || handle === "top-right") {
      newMinY = newMaxY - MIN_SCALE_SIZE;
    } else {
      newMaxY = newMinY + MIN_SCALE_SIZE;
    }
  }

  return {
    minX: Math.min(newMinX, newMaxX),
    minY: Math.min(newMinY, newMaxY),
    maxX: Math.max(newMinX, newMaxX),
    maxY: Math.max(newMinY, newMaxY),
  };
};

const initialPointerState: PointerState = {
  active: false,
  pointerId: null,
  last: { x: 0, y: 0 },
};

export const CanvasViewport = () => {
  const activeTool = useAppSelector(selectActiveTool);
  const viewport = useAppSelector(selectViewport);
  const settings = useAppSelector(selectSettings);
  const shapes = useAppSelector(selectShapes);
  const selectionIds = useAppSelector(selectSelection);
  const setViewport = useAppStore((state) => state.setViewport);
  const commit = useAppStore((state) => state.commit);
  const setSettings = useAppStore((state) => state.setSettings);
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerState = useRef<PointerState>({ ...initialPointerState });
  const spacePressed = useRef(false);
  const commitTimer = useRef<number | undefined>(undefined);
  const selectionSession = useRef<{
    active: boolean;
    pointerId: number | null;
    originWorld: Vec2;
    originScreen: Vec2;
    currentWorld: Vec2;
    worldBounds: ShapeBounds | null;
    moved: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<ScreenRect | null>(null);
  const rectState = useRef<RectDragState | null>(null);
  const ellipseState = useRef<EllipseDragState | null>(null);
  const polylineState = useRef<PolylineState | null>(null);
  const pathState = useRef<PathState | null>(null);
  const transformState = useRef<TransformState | null>(null);

  const handleSelectionMovePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!selectionWorldBounds || !selectedShapes.length) return;

      const node = containerRef.current;
      if (!node) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = node.getBoundingClientRect();
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport
      );

      const snapshot = createTransformSnapshot(selectedShapes);
      transformState.current = {
        mode: "move",
        pointerId: event.pointerId,
        snapshot,
        originalBounds: snapshot.selectionBounds,
        startWorld: worldPoint,
      };

      node.setPointerCapture(event.pointerId);
    },
    [selectedShapes, selectionWorldBounds]
  );

  const handleSelectionHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, handle: HandlePosition) => {
      if (!selectionWorldBounds || !selectedShapes.length) return;

      const node = containerRef.current;
      if (!node) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = node.getBoundingClientRect();
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport
      );

      const snapshot = createTransformSnapshot(selectedShapes);
      transformState.current = {
        mode: "scale",
        pointerId: event.pointerId,
        snapshot,
        originalBounds: snapshot.selectionBounds,
        handle,
      };

      const newBounds = computeScaledBounds(
        handle,
        snapshot.selectionBounds,
        worldPoint,
        event.shiftKey
      );
      applyScale(snapshot, newBounds);
      node.setPointerCapture(event.pointerId);
    },
    [selectedShapes, selectionWorldBounds]
  );

  const handleSelectionRotatePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!selectionWorldBounds || !selectedShapes.length) return;

      const node = containerRef.current;
      if (!node) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = node.getBoundingClientRect();
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport
      );

      const center = getBoundsCenter(selectionWorldBounds);
      const startAngle = Math.atan2(
        worldPoint.y - center.y,
        worldPoint.x - center.x
      );

      const snapshot = createTransformSnapshot(selectedShapes);
      transformState.current = {
        mode: "rotate",
        pointerId: event.pointerId,
        snapshot,
        originalBounds: snapshot.selectionBounds,
        center,
        startAngle,
        currentAngle: 0,
      };

      node.setPointerCapture(event.pointerId);
    },
    [selectedShapes, selectionWorldBounds]
  );

  const selectedShapes = useMemo<Shape[]>(
    () => shapes.filter((shape) => selectionIds.includes(shape.id)),
    [shapes, selectionIds]
  );

  const selectionWorldBounds = useMemo<ShapeBounds | null>(() => {
    if (!selectedShapes.length) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    selectedShapes.forEach((shape) => {
      const bounds = getShapeBounds(shape);
      if (bounds.minX < minX) minX = bounds.minX;
      if (bounds.minY < minY) minY = bounds.minY;
      if (bounds.maxX > maxX) maxX = bounds.maxX;
      if (bounds.maxY > maxY) maxY = bounds.maxY;
    });

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return null;
    }

    return { minX, minY, maxX, maxY };
  }, [selectedShapes]);

  const selectionScreenBounds = useMemo<ScreenRect | null>(() => {
    if (!selectionWorldBounds) return null;
    const topLeft = worldPointToScreen(
      { x: selectionWorldBounds.minX, y: selectionWorldBounds.minY },
      viewport
    );
    const bottomRight = worldPointToScreen(
      { x: selectionWorldBounds.maxX, y: selectionWorldBounds.maxY },
      viewport
    );

    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    };
  }, [selectionWorldBounds, viewport]);

  const scheduleCommit = useCallback(
    (label: string) => {
      window.clearTimeout(commitTimer.current);
      commitTimer.current = window.setTimeout(() => {
        commit(label, { squash: true });
        commitTimer.current = undefined;
      }, PAN_COMMIT_DELAY);
    },
    [commit]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (isTextInput(event.target)) return;
      if (spacePressed.current) return;
      spacePressed.current = true;
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressed.current = false;
    };

    const handleKeyDownWithEscape = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        if (rectState.current) {
          cancelRect(rectState.current);
          if (rectState.current.pointerId != null) {
            const node = containerRef.current;
            if (node && node.hasPointerCapture(rectState.current.pointerId)) {
              node.releasePointerCapture(rectState.current.pointerId);
            }
          }
          rectState.current = null;
          event.preventDefault();
          return;
        }

        if (polylineState.current) {
          const state = polylineState.current;
          if (state.pointerId != null) {
            const node = containerRef.current;
            if (node && node.hasPointerCapture(state.pointerId)) {
              node.releasePointerCapture(state.pointerId);
            }
          }
          cancelPolyline(state);
          polylineState.current = null;
          event.preventDefault();
          return;
        }

        if (pathState.current) {
          const state = pathState.current;
          if (state.pointerId != null) {
            const node = containerRef.current;
            if (node && node.hasPointerCapture(state.pointerId)) {
              node.releasePointerCapture(state.pointerId);
            }
          }
          cancelPath(state);
          pathState.current = null;
          event.preventDefault();
          return;
        }

        if (selectionSession.current) {
          const session = selectionSession.current;
          if (session?.pointerId != null) {
            const node = containerRef.current;
            if (node && node.hasPointerCapture(session.pointerId)) {
              node.releasePointerCapture(session.pointerId);
            }
          }
          selectionSession.current = null;
          setMarquee(null);
          event.preventDefault();
          return;
        }
      }

      handleKeyDown(event);
    };

    window.addEventListener("keydown", handleKeyDownWithEscape, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDownWithEscape, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, []);

  const endPan = useCallback(
    (label: string) => {
      const current = pointerState.current;
      if (!current.active) return;
      current.active = false;
      current.pointerId = null;
      document.body.style.cursor = "";
      scheduleCommit(label);
    },
    [scheduleCommit]
  );

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0) return;

    const node = containerRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const screenPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const worldPoint = screenPointToWorld(
      screenPoint,
      useAppStore.getState().viewport
    );

    if (activeTool === "rect") {
      const state = beginRect(worldPoint, event.pointerId);
      rectState.current = state;
      updateRect(state, worldPoint);
      node.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (activeTool === "ellipse") {
      const state = beginEllipse(worldPoint, event.pointerId);
      ellipseState.current = state;
      updateEllipse(state, worldPoint);
      node.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (activeTool === "line" || activeTool === "arrow") {
      const state = beginPolyline(activeTool, worldPoint, event.pointerId);
      polylineState.current = state;
      updatePolyline(state, worldPoint);
      node.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (activeTool === "path") {
      const state = beginPath(worldPoint, event.pointerId);
      pathState.current = state;
      updatePath(state, worldPoint);
      node.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    const shouldPan =
      spacePressed.current ||
      event.pointerType === "touch" ||
      activeTool !== "select";

    if (shouldPan) {
      node.setPointerCapture(event.pointerId);
      pointerState.current = {
        active: true,
        pointerId: event.pointerId,
        last: { x: event.clientX, y: event.clientY },
      };
      document.body.style.cursor = "grabbing";
      event.preventDefault();
      return;
    }

    selectionSession.current = {
      active: true,
      pointerId: event.pointerId,
      originWorld: worldPoint,
      currentWorld: worldPoint,
      worldBounds: null,
      originScreen: { x: event.clientX, y: event.clientY },
      moved: false,
    };

    node.setPointerCapture(event.pointerId);
    setMarquee(null);
    event.preventDefault();
  };

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    const transform = transformState.current;
    if (
      transform &&
      transform.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const node = containerRef.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport
        );

        if (transform.mode === "move") {
          applyTranslation(transform.snapshot, {
            x: worldPoint.x - transform.startWorld.x,
            y: worldPoint.y - transform.startWorld.y,
          });
        } else if (transform.mode === "scale") {
          const newBounds = computeScaledBounds(
            transform.handle,
            transform.originalBounds,
            worldPoint,
            event.shiftKey
          );
          applyScale(transform.snapshot, newBounds);
        } else if (transform.mode === "rotate") {
          const rawAngle =
            Math.atan2(
              worldPoint.y - transform.center.y,
              worldPoint.x - transform.center.x
            ) - transform.startAngle;
          const snapped = snapRotationAngle(rawAngle, event.shiftKey);
          transform.currentAngle = snapped;
          applyRotation(transform.snapshot, snapped, transform.center);
        }
      }

      event.preventDefault();
      return;
    }

    if (rectState.current && containerRef.current) {
      const state = rectState.current;
      const node = containerRef.current;
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect();
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport
        );
        updateRect(state, worldPoint);
        event.preventDefault();
        return;
      }
    }

    if (ellipseState.current && containerRef.current) {
      const state = ellipseState.current;
      const node = containerRef.current;
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect();
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport
        );
        updateEllipse(state, worldPoint);
        event.preventDefault();
        return;
      }
    }

    if (polylineState.current && containerRef.current) {
      const state = polylineState.current;
      const node = containerRef.current;
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect();
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport
        );
        updatePolyline(state, worldPoint);
        event.preventDefault();
        return;
      }
    }

    if (pathState.current && containerRef.current) {
      const state = pathState.current;
      const node = containerRef.current;
      if (node.hasPointerCapture(event.pointerId)) {
        const rect = node.getBoundingClientRect();
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const worldPoint = screenPointToWorld(
          screenPoint,
          useAppStore.getState().viewport
        );
        updatePath(state, worldPoint, { force: true });
        event.preventDefault();
        return;
      }
    }

    const node = containerRef.current;
    const selection = selectionSession.current;
    if (
      selection &&
      selection.active &&
      selection.pointerId === event.pointerId &&
      node
    ) {
      const rect = node.getBoundingClientRect();
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const worldPoint = screenPointToWorld(
        screenPoint,
        useAppStore.getState().viewport
      );

      selection.currentWorld = worldPoint;

      const distance = Math.hypot(
        event.clientX - selection.originScreen.x,
        event.clientY - selection.originScreen.y
      );
      if (!selection.moved && distance > 4) {
        selection.moved = true;
      }

      if (selection.moved) {
        const bounds = createWorldMarquee(
          selection.originWorld,
          selection.currentWorld
        );
        selection.worldBounds = bounds;
        const topLeft = worldPointToScreen(
          { x: bounds.minX, y: bounds.minY },
          useAppStore.getState().viewport
        );
        const bottomRight = worldPointToScreen(
          { x: bounds.maxX, y: bounds.maxY },
          useAppStore.getState().viewport
        );
        setMarquee({
          x: Math.min(topLeft.x, bottomRight.x),
          y: Math.min(topLeft.y, bottomRight.y),
          width: Math.abs(bottomRight.x - topLeft.x),
          height: Math.abs(bottomRight.y - topLeft.y),
        });
      } else {
        setMarquee(null);
      }

      return;
    }

    const current = pointerState.current;
    if (!current.active || current.pointerId !== event.pointerId) return;

    const dx = event.clientX - current.last.x;
    const dy = event.clientY - current.last.y;
    current.last = { x: event.clientX, y: event.clientY };

    const { viewport: vp } = useAppStore.getState();
    const delta = screenDeltaToWorld({ x: dx, y: dy }, vp);
    setViewport({ x: vp.x - delta.x, y: vp.y - delta.y });
  };

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    const transform = transformState.current;
    if (
      transform &&
      transform.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const node = containerRef.current;
      const store = useAppStore.getState();

      if (node) {
        const rect = node.getBoundingClientRect();
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const worldPoint = screenPointToWorld(screenPoint, store.viewport);

        if (transform.mode === "move") {
          applyTranslation(transform.snapshot, {
            x: worldPoint.x - transform.startWorld.x,
            y: worldPoint.y - transform.startWorld.y,
          });
          store.commit("Move selection");
        } else if (transform.mode === "scale") {
          const newBounds = computeScaledBounds(
            transform.handle,
            transform.originalBounds,
            worldPoint,
            event.shiftKey
          );
          applyScale(transform.snapshot, newBounds);
          store.commit("Resize selection");
        } else {
          const angle =
            Math.atan2(
              worldPoint.y - transform.center.y,
              worldPoint.x - transform.center.x
            ) - transform.startAngle;
          applyRotation(transform.snapshot, angle, transform.center);
          store.commit("Rotate selection");
        }

        node.releasePointerCapture(event.pointerId);
      }

      transformState.current = null;
      event.preventDefault();
      return;
    }

    if (
      rectState.current &&
      rectState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = rectState.current;
      rectState.current = null;
      containerRef.current.releasePointerCapture(event.pointerId);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport
        );
        updateRect(state, worldPoint);
      }

      if (
        Math.abs(state.current.x - state.origin.x) < 2 &&
        Math.abs(state.current.y - state.origin.y) < 2
      ) {
        cancelRect(state);
      } else {
        finalizeRect(state);
      }

      event.preventDefault();
      return;
    }

    if (
      ellipseState.current &&
      ellipseState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = ellipseState.current;
      ellipseState.current = null;
      containerRef.current.releasePointerCapture(event.pointerId);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport
        );
        updateEllipse(state, worldPoint);
      }

      if (
        Math.abs(state.current.x - state.origin.x) < 2 &&
        Math.abs(state.current.y - state.origin.y) < 2
      ) {
        cancelEllipse(state);
      } else {
        finalizeEllipse(state);
      }

      event.preventDefault();
      return;
    }

    if (
      polylineState.current &&
      polylineState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = polylineState.current;
      polylineState.current = null;
      containerRef.current.releasePointerCapture(event.pointerId);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport
        );
        state.points[state.points.length - 1] = worldPoint;
        updatePolyline(state, worldPoint);
      }

      if (
        state.points.length <= 1 ||
        (state.points.length === 2 &&
          Math.hypot(
            state.points[1].x - state.points[0].x,
            state.points[1].y - state.points[0].y
          ) < 2)
      ) {
        cancelPolyline(state);
      } else {
        finalizePolyline(state);
      }

      event.preventDefault();
      return;
    }

    if (
      pathState.current &&
      pathState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      const state = pathState.current;
      pathState.current = null;
      containerRef.current.releasePointerCapture(event.pointerId);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const worldPoint = screenPointToWorld(
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          useAppStore.getState().viewport
        );
        updatePath(state, worldPoint, { force: true });
      }

      finalizePath(state);
      event.preventDefault();
      return;
    }

    const node = containerRef.current;
    const selection = selectionSession.current;

    if (
      selection &&
      selection.active &&
      selection.pointerId === event.pointerId
    ) {
      if (node && node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId);
      }

      const store = useAppStore.getState();
      const rect = node?.getBoundingClientRect();
      let worldPoint: Vec2 | null = null;

      if (rect) {
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        worldPoint = screenPointToWorld(screenPoint, store.viewport);
      }

      if (selection.moved && selection.worldBounds) {
        const ids = getShapesWithinBounds(shapes, selection.worldBounds).map(
          (shape) => shape.id
        );
        if (ids.length) {
          select(ids, event.shiftKey ? "toggle" : "set");
        } else if (!event.shiftKey) {
          clearSelection();
        }
      } else if (worldPoint) {
        const hit = hitTestShapes(shapes, worldPoint);
        if (hit) {
          select([hit.id], event.shiftKey ? "toggle" : "set");
        } else if (!event.shiftKey) {
          clearSelection();
        }
      }

      selectionSession.current = null;
      setMarquee(null);
      event.preventDefault();
      return;
    }

    if (node && node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
    endPan("Pan");
  };

  const handlePointerCancel: PointerEventHandler<HTMLDivElement> = (event) => {
    if (
      transformState.current &&
      transformState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId);
      restoreSnapshot(transformState.current.snapshot);
      transformState.current = null;
    }

    if (
      rectState.current &&
      rectState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId);
      cancelRect(rectState.current);
      rectState.current = null;
    }

    if (
      ellipseState.current &&
      ellipseState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId);
      cancelEllipse(ellipseState.current);
      ellipseState.current = null;
    }

    if (
      polylineState.current &&
      polylineState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId);
      cancelPolyline(polylineState.current);
      polylineState.current = null;
    }

    if (
      pathState.current &&
      pathState.current.pointerId === event.pointerId &&
      containerRef.current?.hasPointerCapture(event.pointerId)
    ) {
      containerRef.current.releasePointerCapture(event.pointerId);
      cancelPath(pathState.current);
      pathState.current = null;
    }

    selectionSession.current = null;
    setMarquee(null);
    pointerState.current.active = false;
    pointerState.current.pointerId = null;
    document.body.style.cursor = "";
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleWheel = (event: WheelEvent) => {
      const store = useAppStore.getState();
      const { viewport: vp } = store;

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        // Trackpad pan (two-finger drag)
        event.preventDefault();
        const delta = screenDeltaToWorld(
          { x: event.deltaX, y: event.deltaY },
          vp
        );
        store.setViewport({ x: vp.x + delta.x, y: vp.y + delta.y });
        scheduleCommit("Pan");
        return;
      }

      // Zoom gesture (pinch or ctrl+wheel)
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const cursor: Vec2 = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const zoomFactor = Math.exp(-event.deltaY * 0.002);
      const nextScale = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, vp.scale * zoomFactor)
      );
      const nextViewport = applyZoomAtPoint(vp, cursor, nextScale);
      store.setViewport(nextViewport);
      scheduleCommit("Zoom");
    };

    node.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, [scheduleCommit]);

  useEffect(() => {
    return () => {
      window.clearTimeout(commitTimer.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[520px] w-full flex-1 select-none overflow-hidden rounded-xl border border-(--color-elevated-border) bg-(--color-canvas-bg) backdrop-blur-sm transition-colors"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerUp}
    >
      {settings.gridVisible ? <GridLayer viewport={viewport} /> : null}

      <SelectionOverlay
        screenBounds={selectionScreenBounds}
        marquee={marquee}
        onMovePointerDown={handleSelectionMovePointerDown}
        onHandlePointerDown={handleSelectionHandlePointerDown}
        onRotatePointerDown={handleSelectionRotatePointerDown}
      />

      <div className="pointer-events-none absolute inset-0 grid place-items-center text-(--color-muted-foreground)">
        <p className="text-sm font-medium">
          Canvas viewport placeholder – pan with Space + drag, zoom with
          pinch/ctrl+wheel.
        </p>
      </div>

      <div className="absolute bottom-4 left-4 rounded border border-(--color-elevated-border) bg-(--color-elevated-bg) px-3 py-2 text-xs font-mono text-(--color-elevated-foreground) shadow-lg backdrop-blur">
        <div>
          Pan: x {viewport.x.toFixed(2)}, y {viewport.y.toFixed(2)}
        </div>
        <div>Zoom: {(viewport.scale * 100).toFixed(0)}%</div>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSettings({ gridVisible: !settings.gridVisible })}
          className="rounded border border-(--color-button-border) bg-(--color-button-bg) px-3 py-1 text-xs font-medium text-(--color-button-text) shadow transition hover:bg-(--color-button-hover-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          aria-pressed={settings.gridVisible}
          aria-label={settings.gridVisible ? "Hide grid" : "Show grid"}
        >
          {settings.gridVisible ? "Hide grid" : "Show grid"}
        </button>
      </div>
    </div>
  );
};

export default CanvasViewport;
