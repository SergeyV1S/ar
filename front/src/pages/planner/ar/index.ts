import { area, dimensions, round } from "../planning/index.ts";
import type {
  ARMode,
  Item,
  Point,
  Positions,
  ScanFeature,
  ScanResult,
  XRState
} from "../types/index.ts";
import { aimAtFloor, createArrangement, getItemTarget } from "./arrangement.ts";
import { furnitureMesh } from "./furniture.ts";
import { getScanLayout, getScanResult, getWallTarget } from "./geometry.ts";
import { getInstructions } from "./getInstructions.ts";
import { createMesh, rgb } from "./mesh.ts";
import type { Mesh } from "./renderer.ts";
import { createRenderer } from "./renderer.ts";
import {
  cornerPosts,
  featureMarks,
  floorPatch,
  green,
  marker,
  sightCone,
  wallSegment,
  walls
} from "./scene.ts";
import { createTracker } from "./tracking.ts";
import type { Tracker } from "./tracking.ts";
import { createViewAnchor } from "./viewAnchor.ts";

export { analyzeScan as analyzeAR } from "./geometry.ts";
export { createARStarterItems } from "./arrangement.ts";

export const arHelp = "Для AR откройте сайт по HTTPS в Chrome на Android с поддержкой ARCore.";

export const supportsAR = async () => {
  try {
    return Boolean(
      globalThis.isSecureContext &&
      navigator.xr &&
      (await navigator.xr.isSessionSupported("immersive-ar"))
    );
  } catch {
    return false;
  }
};

const emptyMesh: Mesh = { solid: new Float32Array(0), glass: new Float32Array(0) };

export type ARStartOptions = {
  mode: ARMode;
  overlay: HTMLDivElement;
  items: Item[];
  positions: Positions;
  roomPoints: Point[];
  onState: (state: XRState) => void;
  onScan: (result: ScanResult) => void;
  onEnd: () => void;
};

export const startAR = async ({
  mode,
  overlay,
  items,
  positions,
  roomPoints,
  onState,
  onScan,
  onEnd
}: ARStartOptions) => {
  if (!globalThis.isSecureContext || !navigator.xr) throw new Error(arHelp);
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    optionalFeatures: ["depth-sensing", "anchors", "plane-detection"],
    domOverlay: { root: overlay },
    depthSensing: {
      usagePreference: ["cpu-optimized"],
      dataFormatPreference: ["luminance-alpha", "float32"],
      depthTypeRequest: ["smooth"]
    }
  });
  const canvas = document.createElement("canvas");
  let tracker: Tracker | null = null;
  try {
    const gl = canvas.getContext("webgl", {
      xrCompatible: true,
      alpha: true,
      antialias: true,
      depth: true,
      powerPreference: "high-performance"
    });
    if (!gl) throw new Error("WebGL недоступен на этом устройстве.");
    await gl.makeXRCompatible();
    session.updateRenderState({
      baseLayer: new XRWebGLLayer(session, gl, { alpha: true, antialias: true })
    });
    const [viewer, space] = await Promise.all([
      session.requestReferenceSpace("viewer"),
      session.requestReferenceSpace("local")
    ]);
    const renderer = createRenderer(gl);
    const viewAnchor = createViewAnchor(space);
    const model = mode === "view" ? furnitureMesh(items, positions) : emptyMesh;
    const room = dimensions(roomPoints);
    const modelPivot: [number, number] = [room.w / 2, room.d / 2];
    const planMesh = createMesh();
    if (mode === "view") {
      floorPatch(planMesh, roomPoints.map(([x, z]) => [x, 0, z]), 0);
    }
    const plan = planMesh.finish();
    const furniture = createArrangement(items);
    const accent = rgb("#9b67ff"),
      accentSoft = rgb("#c4a9ff"),
      greenSoft = rgb("#9df0c6"),
      red = rgb("#ff957f");

    let ended = false;
    let kind = "corner";
    let snap = true;
    let rotation = 0;
    let hit: Point | null = null;
    let origin: Point | null = null;
    let orientation: number | null = null;
    let confidence = 0;
    let scanLayout: ReturnType<typeof getScanLayout> = null;
    let arranging = false;
    const corners: Point[] = [];
    const features: ScanFeature[] = [];
    const pending: Point[] = [];
    const sceneMesh = createMesh();
    const liveMesh = createMesh();
    let scene: Mesh = emptyMesh;
    let sceneDirty = true;
    const frameLevel = () => (mode === "view" ? origin?.[1] : corners[0]?.[1]);

    tracker = await createTracker({
      session,
      viewer,
      space,
      floorLevel: frameLevel,
      acceptAnyHeight: () => mode === "scan" && kind !== "corner"
    });
    const active = tracker;

    const outline = () => {
      if (!scanLayout) return 0;
      let total = 0;
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % corners.length];
        total += Math.hypot(b[0] - a[0], b[2] - a[2]);
      }
      return total;
    };
    const measuredArea = () => {
      if (!scanLayout) return 0;
      return area(corners.map(([x, , z]) => [x, z]));
    };

    let lastState = 0;
    let lastSignature = "";
    let notice = "";
    let noticeUntil = 0;
    const drawingWall = () => mode === "scan" && !scanLayout && corners.length > 0;
    const wallTarget = () => (hit && drawingWall() ? getWallTarget(corners, hit, snap) : null);
    const furnitureTarget = () =>
      arranging && scanLayout && hit && furniture.selected
        ? getItemTarget(scanLayout, furniture.selected, hit, furniture.rotation)
        : null;
    const resetTracking = () => {
      active.reset();
      hit = null;
      confidence = 0;
    };
    const help = (message?: string) => {
      const now = performance.now();
      if (message === undefined && now - lastState < 140) return;
      if (message !== undefined) {
        notice = message;
        noticeUntil = now + 3200;
      }
      const target = wallTarget();
      const hasHit = hit !== null && confidence >= 0.45;
      const closed = scanLayout !== null;
      const state: XRState = {
        kind,
        ready: arranging
          ? furnitureTarget()?.valid === true
          : hasHit && (!drawingWall() || target !== null) && (!closed || kind !== "corner"),
        count: corners.length,
        closed,
        closing: hasHit && target?.closes === true,
        wallLength: hasHit && target ? round(target.length) : undefined,
        positioned: orientation !== null,
        area: round(measuredArea()),
        perimeter: round(outline()),
        rotation: arranging ? furniture.rotation : rotation,
        snap,
        arranging,
        itemId: furniture.selected?.id,
        placedIds: furniture.placedIds
      };
      state.text = (now < noticeUntil && notice) || getInstructions(mode, origin, state, pending.length);
      const signature = JSON.stringify(state);
      lastState = now;
      if (signature === lastSignature) return;
      lastSignature = signature;
      onState(state);
    };

    const closeOutline = () => {
      if (mode !== "scan" || scanLayout || corners.length < 3) return;
      const layout = getScanLayout(corners);
      if (!layout) {
        help("Контур не замыкается. Проверьте порядок углов и отмените лишние отметки.");
        return;
      }
      scanLayout = layout;
      resetTracking();
      sceneDirty = true;
      help("");
    };

    const collect = () => {
      if (arranging) {
        const target = furnitureTarget();
        if (!target?.valid) return;
        furniture.place(target.position);
        help("");
        return;
      }
      if (scanLayout && kind === "corner") return;
      if (!hit || confidence < 0.45) {
        help("Опора не определена. Медленно ведите камерой по полу.");
        return;
      }
      const point: Point = [...hit];
      if (mode === "view") {
        if (!origin || orientation !== null) {
          origin = [point[0], point[1], point[2]];
          orientation = null;
          rotation = 0;
          viewAnchor.set();
        } else if (Math.hypot(point[0] - origin[0], point[2] - origin[2]) < 0.3) {
          help("Выберите точку вдоль стены не ближе 30 см от начала.");
          return;
        } else {
          orientation = Math.atan2(point[2] - origin[2], point[0] - origin[0]);
          viewAnchor.set({ origin, angle: orientation });
        }
        resetTracking();
        sceneDirty = true;
        help("");
        return;
      }
      if (kind === "corner") {
        const target = wallTarget();
        if (target?.closes) {
          closeOutline();
          return;
        }
        if (corners.length && !target) return;
        corners.push(target?.point ?? point);
        resetTracking();
        sceneDirty = true;
        help("");
        return;
      }
      pending.push(point);
      if (kind === "socket" || pending.length === 2) features.push({ type: kind, points: pending.splice(0) });
      resetTracking();
      sceneDirty = true;
      help("");
    };

    const click = (event: Event) => {
      event.preventDefault();
    };
    overlay.addEventListener("beforexrselect", click);
    session.addEventListener("select", collect);

    const frameLoop = (_time: number, frame: XRFrame) => {
      if (ended) return;
      session.requestAnimationFrame(frameLoop);
      const pose = frame.getViewerPose(space),
        layer = session.renderState.baseLayer;
      if (!pose) {
        if (hit) {
          hit = null;
          confidence = 0;
          help("");
        }
        return;
      }
      const firstView = pose.views[0];
      if (arranging && scanLayout && firstView) {
        hit = aimAtFloor(firstView.transform.matrix, scanLayout.origin[1]);
        confidence = hit ? 1 : 0;
      } else {
        const result = active.update(frame, firstView);
        hit = result?.point ?? null;
        confidence = result?.confidence ?? 0;
      }
      const anchoredView = mode === "view" ? viewAnchor.update(frame) : undefined;
      const ready = confidence >= 0.45;
      help();
      if (!layer) return;

      if (sceneDirty) {
        sceneMesh.reset();
        const level = frameLevel() ?? hit?.[1] ?? 0;
        if (mode === "scan" && corners.length) {
          const closed = scanLayout !== null;
          if (closed) floorPatch(sceneMesh, corners, level);
          walls(sceneMesh, corners, level, closed);
          cornerPosts(sceneMesh, corners, level, closed ? -1 : corners.length - 1);
          featureMarks(sceneMesh, features, pending);
        }
        scene = sceneMesh.finish();
        sceneDirty = false;
      }

      liveMesh.reset();
      const floor = frameLevel() ?? hit?.[1] ?? 0;
      const target = wallTarget();
      const preview = furnitureTarget();
      if (arranging && hit && furniture.selected) {
        marker(liveMesh, hit, preview?.valid ? green : red, 0.06);
      } else if (target && ready) {
        const last = corners[corners.length - 1];
        wallSegment(liveMesh, last, target.point, floor, true);
        marker(liveMesh, target.point, greenSoft, target.closes ? 0.08 : 0.05);
      } else if (hit && !arranging && !drawingWall() && (!scanLayout || kind !== "corner")) {
        marker(liveMesh, hit, ready ? green : accentSoft, 0.05, ready ? 1 : 0.4);
        if (mode === "view" && origin && orientation === null)
          sightCone(liveMesh, hit, origin, floor + 0.005);
      }
      if (mode === "view" && origin && !anchoredView) marker(liveMesh, origin, accent, 0.05);
      const live = liveMesh.finish();

      renderer.clear(layer.framebuffer);
      for (const view of pose.views) {
        const viewport = layer.getViewport(view);
        if (!viewport) continue;
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        renderer.view(view);
        renderer.drawScene(scene);
        renderer.drawScene(live);
        if (anchoredView) {
          const { origin, angle } = anchoredView;
          const turn = (rotation * Math.PI) / 180;
          renderer.drawPlaced(plan, [origin[0], origin[1], origin[2]], angle, modelPivot, turn);
          renderer.drawPlaced(model, [origin[0], origin[1], origin[2]], angle, modelPivot, turn);
        }
        if (scanLayout) {
          const { origin, angle } = scanLayout;
          renderer.drawPlaced(furniture.model, [origin[0], origin[1], origin[2]], angle);
          if (preview?.valid && furniture.selected) {
            const [x, y, z] = preview.modelOrigin;
            const pivot: [number, number] = [furniture.selected.w / 2, furniture.selected.d / 2];
            renderer.drawPlaced(
              furniture.preview,
              [x, y, z],
              angle,
              pivot,
              (furniture.rotation * Math.PI) / 180
            );
          }
        }
      }
    };
    session.requestAnimationFrame(frameLoop);

    session.addEventListener(
      "end",
      () => {
        ended = true;
        viewAnchor.set();
        active.cancel();
        overlay.removeEventListener("beforexrselect", click);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        onEnd();
      },
      { once: true }
    );
    help("");
    session.addEventListener("visibilitychange", () => {
      if (session.visibilityState === "hidden") help("AR приостановлен. Вернитесь в приложение.");
    });

    return {
      collect,
      closeOutline,
      arrange: () => {
        if (!scanLayout || !items.length) return;
        if (pending.length) {
          help("Отметьте второй край проёма или отмените незавершённую отметку.");
          return;
        }
        arranging = !arranging;
        furniture.select();
        resetTracking();
        help("");
      },
      selectItem: (id?: string) => {
        if (!arranging) return;
        furniture.select(id);
        help("");
      },
      exit: () => session.end(),
      kind: (next?: string) => {
        if (!scanLayout || arranging) return;
        kind = next ?? "corner";
        pending.length = 0;
        resetTracking();
        sceneDirty = true;
        help("");
      },
      toggleSnap: () => {
        snap = !snap;
        help("");
      },
      rotate: () => {
        if (arranging) {
          furniture.rotate();
          help("");
          return;
        }
        rotation = (rotation + 90) % 360;
        help(`Поворот модели: ${rotation}°.`);
      },
      undo: () => {
        if (arranging) furniture.undo();
        else if (mode === "view") {
          origin = null;
          orientation = null;
          rotation = 0;
          viewAnchor.set();
        } else if (pending.length) pending.pop();
        else if (features.length) features.pop();
        else if (scanLayout) {
          if (furniture.placedIds.length) {
            help("Чтобы изменить контур, сначала отмените расстановку мебели.");
            return;
          }
          scanLayout = null;
          kind = "corner";
        } else corners.pop();
        resetTracking();
        sceneDirty = true;
        help("");
      },
      save: async () => {
        if (!scanLayout) return;
        if (pending.length) {
          help("Отметьте второй край проёма или отмените незавершённую точку.");
          return;
        }
        const result = getScanResult(scanLayout, features);
        onScan({ ...result, positions: furniture.placedIds.length ? furniture.positions() : undefined });
        await session.end();
      }
    };
  } catch (error) {
    tracker?.cancel();
    await session.end().catch(() => {});
    throw error;
  }
};

export type ARController = Awaited<ReturnType<typeof startAR>>;
