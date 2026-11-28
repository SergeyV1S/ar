import { area, round } from "../planning/index.ts";
import type {
  ARMode,
  Item,
  Point,
  Positions,
  ScanFeature,
  ScanResult,
  XRState
} from "../types/index.ts";
import { furnitureMesh } from "./furniture.ts";
import { analyzeScan, getWallTarget } from "./geometry.ts";
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

export { analyzeScan as analyzeAR } from "./geometry.ts";

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
  onState: (state: XRState) => void;
  onScan: (result: ScanResult) => void;
  onEnd: () => void;
};

export const startAR = async ({
  mode,
  overlay,
  items,
  positions,
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
    const model = furnitureMesh(items, positions);
    const accent = rgb("#9b67ff"),
      accentSoft = rgb("#c4a9ff"),
      greenSoft = rgb("#9df0c6");

    let ended = false;
    let kind = "corner";
    let snap = true;
    let rotation = 0;
    let hit: Point | null = null;
    let origin: Point | null = null;
    let orientation: number | null = null;
    let confidence = 0;
    let closed = false;
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

    const placements = () => {
      const xs = items.flatMap((item) => {
        const pos = positions[item.id];
        return pos ? [pos.x, pos.x + item.w] : [];
      });
      const zs = items.flatMap((item) => {
        const pos = positions[item.id];
        return pos ? [pos.y, pos.y + item.d] : [];
      });
      if (!xs.length || !zs.length) return { w: 3, d: 3 };
      return { w: Math.max(...xs), d: Math.max(...zs) };
    };
    const outline = () => {
      if (!closed) return 0;
      let total = 0;
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % corners.length];
        total += Math.hypot(b[0] - a[0], b[2] - a[2]);
      }
      return total;
    };
    const measuredArea = () => {
      if (!closed) return 0;
      return area(corners.map(([x, , z]) => [x, z]));
    };

    let lastState = 0;
    let lastSignature = "";
    let notice = "";
    let noticeUntil = 0;
    const drawingWall = () => mode === "scan" && !closed && corners.length > 0;
    const wallTarget = () => (hit && drawingWall() ? getWallTarget(corners, hit, snap) : null);
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
      const state: XRState = {
        kind,
        ready: hasHit && (!drawingWall() || target !== null) && (!closed || kind !== "corner"),
        count: corners.length,
        closed,
        closing: hasHit && target?.closes === true,
        wallLength: hasHit && target ? round(target.length) : undefined,
        positioned: orientation !== null,
        area: round(measuredArea()),
        perimeter: round(outline()),
        rotation,
        snap
      };
      state.text = (now < noticeUntil && notice) || getInstructions(mode, origin, state, pending.length);
      const signature = JSON.stringify(state);
      lastState = now;
      if (signature === lastSignature) return;
      lastSignature = signature;
      onState(state);
    };

    const closeOutline = () => {
      if (mode !== "scan" || closed || corners.length < 3) return;
      if (!analyzeScan(corners, [])) {
        help("Контур не замыкается. Проверьте порядок углов и отмените лишние отметки.");
        return;
      }
      closed = true;
      resetTracking();
      sceneDirty = true;
      help("");
    };

    const collect = () => {
      if (closed && kind === "corner") return;
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
        } else if (Math.hypot(point[0] - origin[0], point[2] - origin[2]) < 0.3) {
          help("Выберите точку вдоль стены не ближе 30 см от начала.");
          return;
        } else orientation = Math.atan2(point[2] - origin[2], point[0] - origin[0]);
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
      if (!pose) return;
      const firstView = pose.views[0];
      const result = active.update(frame, firstView);
      hit = result?.point ?? null;
      confidence = result?.confidence ?? 0;
      const ready = confidence >= 0.45;
      help();
      if (!layer) return;

      if (sceneDirty) {
        sceneMesh.reset();
        const level = frameLevel() ?? hit?.[1] ?? 0;
        if (mode === "scan" && corners.length) {
          if (closed) floorPatch(sceneMesh, corners, level);
          walls(sceneMesh, corners, level, closed);
          cornerPosts(sceneMesh, corners, level, closed ? -1 : corners.length - 1);
          featureMarks(sceneMesh, features, pending);
        }
        const anchor = origin;
        if (mode === "view" && anchor && orientation !== null) {
          const { w, d } = placements();
          const inset = Math.max(w, d) * 0.25 + 0.4;
          const cos = Math.cos(orientation),
            sin = Math.sin(orientation);
          const at = (x: number, z: number): Point => [
            anchor[0] + x * cos - z * sin,
            anchor[1],
            anchor[2] + x * sin + z * cos
          ];
          floorPatch(
            sceneMesh,
            [
              at(-inset, -inset),
              at(w + inset, -inset),
              at(w + inset, d + inset),
              at(-inset, d + inset)
            ],
            anchor[1]
          );
          for (const item of items) {
            const pos = positions[item.id];
            if (!pos) continue;
            const x = pos.x + item.w / 2,
              z = pos.y + item.d / 2;
            const spot = at(x, z);
            sceneMesh.disc(spot[0], anchor[1] + 0.006, spot[2], 0.05, accentSoft, 0.5, 12);
          }
        }
        scene = sceneMesh.finish();
        sceneDirty = false;
      }

      liveMesh.reset();
      const floor = frameLevel() ?? hit?.[1] ?? 0;
      const target = wallTarget();
      if (target && ready) {
        const last = corners[corners.length - 1];
        wallSegment(liveMesh, last, target.point, floor, true);
        marker(liveMesh, target.point, greenSoft, target.closes ? 0.08 : 0.05);
      } else if (hit && !drawingWall() && (!closed || kind !== "corner")) {
        marker(liveMesh, hit, ready ? green : accentSoft, 0.05, ready ? 1 : 0.4);
        if (mode === "view" && origin && orientation === null)
          sightCone(liveMesh, hit, origin, floor + 0.005);
      }
      if (mode === "view" && origin) marker(liveMesh, origin, accent, 0.05);
      const anchor = origin;
      if (mode === "view" && orientation !== null && anchor) {
        const { w, d } = placements();
        const cos = Math.cos(orientation),
          sin = Math.sin(orientation);
        const at = (x: number, z: number): Point => [
          anchor[0] + x * cos - z * sin,
          anchor[1],
          anchor[2] + x * sin + z * cos
        ];
        const cornersOfModel = [at(0, 0), at(w, 0), at(w, d), at(0, d)];
        for (let i = 0; i < 4; i++)
          liveMesh.beam(cornersOfModel[i], cornersOfModel[(i + 1) % 4], 0.008, accentSoft, 0.55);
      }
      const live = liveMesh.finish();

      renderer.clear(layer.framebuffer);
      for (const view of pose.views) {
        const viewport = layer.getViewport(view);
        if (!viewport) continue;
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        renderer.view(view);
        renderer.drawScene(scene);
        renderer.drawScene(live);
        if (orientation !== null && origin)
          {
            const { w, d } = placements();
            renderer.drawPlaced(
              model,
              [origin[0], origin[1], origin[2]],
              orientation,
              [w / 2, d / 2],
              (rotation * Math.PI) / 180
            );
          }
      }
    };
    session.requestAnimationFrame(frameLoop);

    session.addEventListener(
      "end",
      () => {
        ended = true;
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
      exit: () => session.end(),
      kind: (next?: string) => {
        if (!closed) return;
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
        rotation = (rotation + 90) % 360;
        help(`Поворот модели: ${rotation}°.`);
      },
      undo: () => {
        if (mode === "view") {
          origin = null;
          orientation = null;
          rotation = 0;
        } else if (pending.length) pending.pop();
        else if (features.length) features.pop();
        else if (closed) {
          closed = false;
          kind = "corner";
        } else corners.pop();
        resetTracking();
        sceneDirty = true;
        help("");
      },
      save: async () => {
        if (!closed) return;
        if (pending.length) {
          help("Отметьте второй край проёма или отмените незавершённую точку.");
          return;
        }
        const result = analyzeScan(corners, features);
        if (!result) {
          help("Нужны минимум три угла в порядке обхода без пересечения стен.");
          return;
        }
        onScan(result);
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
