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
import {
  analyzeScan,
  closeRadius,
  closingDistance,
  duplicateRadius,
  maxCorners,
  nearPoint,
  snapCorner
} from "./geometry.ts";
import { getInstructions } from "./getInstructions.ts";
import { createMesh, rgb } from "./mesh.ts";
import type { Mesh } from "./renderer.ts";
import { createRenderer } from "./renderer.ts";
import {
  closingEdge,
  closingHint,
  cornerPosts,
  featureMarks,
  floorPatch,
  green,
  guide,
  marker,
  ruler,
  sightCone,
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
    const firstText = "Наведите телефон на пол и медленно подвигайте им, пока не появится отметка.";
    const outline = () => {
      if (corners.length < 2) return 0;
      let total = 0;
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % corners.length];
        total += Math.hypot(b[0] - a[0], b[2] - a[2]);
      }
      return total;
    };
    const measuredArea = () => {
      if (corners.length < 3) return 0;
      return area(corners.map(([x, , z]) => [x, z]));
    };

    let lastState = 0;
    let lastSignature = "";
    const help = (message = "", force = true) => {
      const now = performance.now();
      if (!force && now - lastState < 140) return;
      const text = getInstructions(mode, orientation, origin, kind, corners.length, pending.length);
      const state: XRState = {
        text: message || (!hit && !corners.length && !origin ? firstText : text),
        kind,
        ready: Boolean(hit) && confidence > 0.45,
        count: corners.length,
        positioned: orientation !== null,
        confidence: Math.round(confidence * 10) / 10,
        surface: active.locked ? "Поверхность стабильна" : hit ? "Ищем опору" : "Опоры нет",
        area: round(measuredArea()),
        perimeter: round(outline()),
        rotation,
        snap
      };
      const signature = `${state.text}|${state.ready}|${state.surface}|${state.count}|${state.area}|${state.confidence}|${state.rotation}|${state.snap}`;
      if (!force && signature === lastSignature) return;
      lastSignature = signature;
      lastState = now;
      onState(state);
    };

    const finishCorner = (point: Point) => {
      const previous = corners[corners.length - 1] ?? null;
      const candidate = snapCorner(point, previous, snap);
      if (corners.length >= 3 && nearPoint(candidate, corners[0], closeRadius)) {
        sceneDirty = true;
        help(`Контур замкнут: ${corners.length} углов. Можно отметить проёмы или сохранить.`);
        return true;
      }
      if (corners.length >= maxCorners) {
        help(`Достигнут предел в ${maxCorners} точек. Сохраните контур.`);
        return true;
      }
      if (corners.some((corner) => nearPoint(candidate, corner, duplicateRadius))) {
        help("Эта точка уже отмечена. Выберите другое место.");
        return true;
      }
      corners.push(candidate);
      active.reset();
      sceneDirty = true;
      help();
      return false;
    };

    const collect = () => {
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
        active.reset();
        sceneDirty = true;
        help();
        return;
      }
      if (kind === "corner") {
        finishCorner(point);
        return;
      }
      pending.push(point);
      if (kind === "socket" || pending.length === 2) features.push({ type: kind, points: pending.splice(0) });
      active.reset();
      sceneDirty = true;
      help();
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
      const previousReady = Boolean(hit) && confidence > 0.45;
      hit = result?.point ?? null;
      confidence = result?.confidence ?? Math.max(0, confidence - 0.08);
      const ready = Boolean(hit) && confidence > 0.45;
      if (previousReady !== ready) help();
      else help("", false);
      if (!layer) return;

      if (sceneDirty) {
        sceneMesh.reset();
        const level = frameLevel() ?? hit?.[1] ?? 0;
        if (mode === "scan" && corners.length) {
          floorPatch(sceneMesh, corners, level);
          walls(sceneMesh, corners, level);
          cornerPosts(sceneMesh, corners, level, corners.length - 1);
          closingEdge(sceneMesh, corners, level, corners.length > 2);
          if (corners.length > 2 && hit) {
            const dist = closingDistance(corners);
            closingHint(sceneMesh, corners[0], hit, dist, level);
          }
          for (let i = 1; i < corners.length; i++) ruler(sceneMesh, corners[i - 1], corners[i], level);
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
      if (hit) {
        marker(liveMesh, hit, ready ? green : accentSoft, 0.05, ready ? 1 : 0.4);
        if (mode === "scan" && corners.length) {
          const last = corners[corners.length - 1];
          sightCone(liveMesh, hit, last, floor + 0.005);
          guide(liveMesh, last, hit, floor + 0.005);
          if (corners.length > 1 && nearPoint(hit, corners[0], closeRadius))
            marker(liveMesh, corners[0], greenSoft, 0.07, 1);
        }
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

      renderer.clear();
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
    help();
    session.addEventListener("visibilitychange", () => {
      if (session.visibilityState === "hidden") help("AR приостановлен. Вернитесь в приложение.");
    });

    return {
      collect,
      exit: () => session.end(),
      kind: (next?: string) => {
        kind = next ?? "corner";
        pending.length = 0;
        sceneDirty = true;
        help();
      },
      toggleSnap: () => {
        snap = !snap;
        help(snap ? "Привязка к осям включена." : "Привязка к осям выключена.");
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
        else if (kind !== "corner" && features.length) features.pop();
        else corners.pop();
        active.reset();
        sceneDirty = true;
        help();
      },
      save: async () => {
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
