import { newId } from "../../../shared/helpers/index.ts";
import {
  area,
  centeredPosition,
  dimensions,
  normalizeAngle,
  rotatePosition,
  round
} from "../planning/index.ts";
import type {
  ARMode,
  Item,
  Point,
  Positions,
  ScanFeature,
  ScanResult,
  XRState
} from "../types/index.ts";
import { createArrangement, getItemTarget } from "./arrangement.ts";
import { createARCamera } from "./camera.ts";
import { furnitureMesh } from "./furniture.ts";
import { createFurnitureModels } from "./furnitureModels/index.ts";
import { getScanLayout, getScanResult, getWallTarget, worldPoint } from "./geometry.ts";
import { getInstructions } from "./getInstructions.ts";
import { traceBase, traceHeight } from "./itemTrace.ts";
import { createMesh, rgb } from "./mesh.ts";
import type { ObjectMeasurement } from "./objectMeasurement.ts";
import { measurementsMatch } from "./objectMeasurement.ts";
import { createObjectScanner } from "./objectScanner.ts";
import type { CameraPose } from "./projection.ts";
import { projectDepth, projectToFloor } from "./projection.ts";
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
import { createTracker, getDepth, readDepth } from "./tracking.ts";
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
  availableItems: number;
  starterIds: Set<string>;
  onState: (state: XRState) => void;
  onScan: (result: ScanResult, newItems: Item[]) => void;
  onViewLayout: (positions: Positions) => void;
  onEnd: () => void;
};

export const startAR = async ({
  mode,
  overlay,
  items,
  positions,
  roomPoints,
  availableItems,
  starterIds,
  onState,
  onScan,
  onViewLayout,
  onEnd
}: ARStartOptions) => {
  if (!globalThis.isSecureContext || !navigator.xr) throw new Error(arHelp);
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    optionalFeatures:
      mode === "scan"
        ? ["depth-sensing", "anchors", "plane-detection", "camera-access"]
        : ["depth-sensing", "anchors", "plane-detection"],
    domOverlay: { root: overlay },
    depthSensing: {
      usagePreference: ["cpu-optimized"],
      dataFormatPreference: ["luminance-alpha", "float32"],
      depthTypeRequest: ["smooth"],
      matchDepthView: true
    }
  });
  const canvas = document.createElement("canvas");
  let tracker: Tracker | null = null;
  let modelsDirty = false;
  const models = createFurnitureModels(() => {
    modelsDirty = true;
  });
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
    let model = mode === "view" ? furnitureMesh(items, positions, models.get) : emptyMesh;
    let viewPositions = positions;
    let viewItem: Item | undefined;
    let viewEdited = false;
    const room = dimensions(roomPoints);
    const modelPivot: [number, number] = [room.w / 2, room.d / 2];
    const planMesh = createMesh();
    if (mode === "view") {
      floorPatch(
        planMesh,
        roomPoints.map(([x, z]) => [x, 0, z]),
        0
      );
    }
    const plan = planMesh.finish();
    const furniture = createArrangement(items, models.get);
    const camera = mode === "scan" ? createARCamera(session, gl) : null;
    const accent = rgb("#9b67ff"),
      accentSoft = rgb("#c4a9ff"),
      greenSoft = rgb("#9df0c6"),
      red = rgb("#ff957f"),
      cyan = rgb("#55ebff");

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
    let finding = false;
    let tracing = false;
    let measurement = "";
    let currentHeight: number | null = null;
    let traceCandidate: ReturnType<typeof traceBase> = null;
    const marks: Point[] = [];
    const recognized = new Map<string, ObjectMeasurement>();
    const hasInventorySpace = () =>
      furniture.additions.length + furniture.placedIds.filter((id) => starterIds.has(id)).length <
      availableItems;
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
      acceptAnyHeight: () =>
        mode === "scan" && (kind !== "corner" || (tracing && marks.length === 3))
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
      currentHeight = null;
      traceCandidate = null;
    };
    const help = (message?: string) => {
      const now = performance.now();
      if (message === undefined && now - lastState < 140) return;
      if (message !== undefined) {
        notice = message;
        noticeUntil = now + 3200;
      }
      const target = wallTarget();
      const point = hit;
      const hasHit = point !== null && confidence >= 0.45;
      const closed = scanLayout !== null;
      const readyToCollect = () => {
        if (finding) return false;
        if (tracing) {
          if (marks.length === 3) return currentHeight !== null;
          if (marks.length === 2) return traceCandidate?.valid === true;
          return (
            hasHit &&
            (marks.length === 0 ||
              Math.hypot(point[0] - marks[0][0], point[2] - marks[0][2]) >= 0.1)
          );
        }
        if (arranging) return furnitureTarget()?.valid === true;
        return hasHit && (!drawingWall() || target !== null) && (!closed || kind !== "corner");
      };
      const state: XRState = {
        kind,
        ready: readyToCollect(),
        count: corners.length,
        closed,
        closing: hasHit && target?.closes === true,
        wallLength: hasHit && target ? round(target.length) : undefined,
        positioned: orientation !== null,
        area: round(measuredArea()),
        perimeter: round(outline()),
        rotation: arranging
          ? furniture.rotation
          : (viewPositions[viewItem?.id ?? ""]?.r ?? rotation),
        snap,
        arranging,
        finding,
        traceStep: tracing ? marks.length : undefined,
        measurement,
        canUndo: furniture.canUndo,
        measuredItems: furniture.additions,
        viewEdited,
        itemId: furniture.selected?.id ?? viewItem?.id,
        placedIds: mode === "scan" ? furniture.placedIds : Object.keys(viewPositions)
      };
      state.text =
        (now < noticeUntil && notice) || getInstructions(mode, origin, state, pending.length);
      const signature = JSON.stringify(state);
      lastState = now;
      if (signature === lastSignature) return;
      lastSignature = signature;
      onState(state);
    };

    const describe = (item: Item, estimated = false) => {
      const size = [item.w, item.d, item.h].map((value) => Math.round(value * 100)).join(" × ");
      measurement = `${item.name} · ${estimated ? "≈ " : ""}${size} см`;
    };
    const scanner = createObjectScanner({
      readImage: (view) => camera?.read(view) ?? null,
      onError: (message) => {
        finding = false;
        help(message);
      },
      publish: (id, result) => {
        if (!finding || !scanLayout) return;
        const current = recognized.get(id);
        if (!current && !hasInventorySpace()) {
          finding = false;
          scanner.stop();
          help("В проекте достигнут предел мебели.");
          return;
        }
        const duplicate = [...recognized].some(
          ([key, prior]) => key !== id && measurementsMatch(prior, result)
        );
        if (!current && duplicate) return;
        const item: Item = {
          id,
          name: result.name,
          kind: result.kind,
          ...result.size,
          owned: true,
          source: "xr",
          verified: "review",
          material: ""
        };
        recognized.set(id, result);
        furniture.add(item, centeredPosition(item, result.center, 0));
        describe(item, result.estimated);
        help();
      }
    });
    const finishFinding = () => {
      finding = false;
      scanner.stop();
    };

    const finishTrace = () => {
      if (
        marks.length !== 3 ||
        !traceCandidate?.valid ||
        currentHeight === null ||
        !hasInventorySpace()
      )
        return;
      const item: Item = {
        id: newId(),
        name: `Предмет ${furniture.additions.length + 1}`,
        kind: "other",
        ...traceCandidate.size,
        h: currentHeight,
        owned: true,
        source: "xr",
        verified: "review",
        material: ""
      };
      furniture.add(item, traceCandidate.position);
      describe(item);
      marks.length = 0;
      tracing = false;
      resetTracking();
      help("Предмет добавлен в план.");
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
      if (finding) return;
      if (tracing) {
        if (marks.length === 3) finishTrace();
        else if (hit && confidence >= 0.45) {
          if (marks.length === 1 && Math.hypot(hit[0] - marks[0][0], hit[2] - marks[0][2]) < 0.1)
            return;
          if (marks.length === 2 && !traceCandidate?.valid) return;
          marks.push([...hit]);
          resetTracking();
          help("");
        }
        return;
      }
      if (arranging) {
        const selected = furniture.selected;
        if (!selected) return;
        if (
          starterIds.has(selected.id) &&
          !furniture.placedIds.includes(selected.id) &&
          !hasInventorySpace()
        ) {
          help("В проекте достигнут предел мебели.");
          return;
        }
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
          viewItem = undefined;
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
      if (kind === "socket" || pending.length === 2)
        features.push({ type: kind, points: pending.splice(0) });
      resetTracking();
      sceneDirty = true;
      help("");
    };

    const click = (event: Event) => {
      event.preventDefault();
    };
    overlay.addEventListener("beforexrselect", click);
    session.addEventListener("select", collect);

    const frameLoop = (time: number, frame: XRFrame) => {
      if (ended) return;
      session.requestAnimationFrame(frameLoop);
      const pose = frame.getViewerPose(space),
        layer = session.renderState.baseLayer;
      if (!pose) {
        if (hit || currentHeight !== null) {
          resetTracking();
          help("");
        }
        return;
      }
      const firstView = pose.views[0];
      const cameraPose: CameraPose | undefined = firstView && {
        transform: firstView.transform.matrix,
        projection: firstView.projectionMatrix
      };
      if (finding && scanLayout && firstView) scanner.update(time, frame, firstView, scanLayout);
      if ((arranging || tracing) && scanLayout && cameraPose && firstView) {
        hit = projectToFloor(cameraPose, 0.5, 0.5, scanLayout.origin[1]);
        confidence = hit ? 1 : 0;
        if (tracing && marks.length === 2 && hit)
          traceCandidate = traceBase(scanLayout, [...marks, hit]);
        if (tracing && marks.length === 2 && !hit) traceCandidate = null;
        if (tracing && marks.length === 3) {
          traceCandidate = traceBase(scanLayout, marks);
          const depth = readDepth(getDepth(frame, firstView), 0.5, 0.5);
          const measured = depth === null ? null : projectDepth(cameraPose, 0.5, 0.5, depth);
          currentHeight = traceCandidate
            ? traceHeight(scanLayout, traceCandidate.footprint, cameraPose, measured)
            : null;
          hit = null;
        }
      } else {
        const result = active.update(frame, firstView);
        hit = result?.point ?? null;
        confidence = result?.confidence ?? 0;
      }
      const anchoredView = mode === "view" ? viewAnchor.update(frame) : undefined;
      const ready = confidence >= 0.45;
      help();
      if (!layer) return;

      if (modelsDirty) {
        modelsDirty = false;
        if (mode === "view") model = furnitureMesh(items, viewPositions, models.get);
        else furniture.refreshModels();
      }

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
      if (tracing && scanLayout) {
        const layout = scanLayout;
        const base = traceCandidate;
        const color = base && !base.valid ? red : cyan;
        for (const point of marks) marker(liveMesh, point, cyan, 0.04);
        if (hit) marker(liveMesh, hit, color, 0.044);
        if (base) {
          const footprint = base.footprint.map((point) => worldPoint(layout, point, 0.008));
          const top = base.footprint.map((point) => worldPoint(layout, point, currentHeight ?? 0));
          footprint.forEach((point, i) => {
            const next = (i + 1) % footprint.length;
            liveMesh.beam(point, footprint[next], 0.025, color);
            if (currentHeight === null) return;
            liveMesh.beam(top[i], top[next], 0.025, color);
            liveMesh.post(point, top[i], 0.025, color);
          });
        } else if (marks[0]) {
          const end = marks[1] ?? hit;
          if (end) liveMesh.beam(marks[0], end, 0.024, cyan);
        }
      } else if (arranging && hit && furniture.selected) {
        marker(liveMesh, hit, preview?.valid ? green : red, 0.06);
      } else if (target && ready) {
        const last = corners[corners.length - 1];
        wallSegment(liveMesh, last, target.point, floor, true);
        marker(liveMesh, target.point, greenSoft, target.closes ? 0.08 : 0.05);
      } else if (
        hit &&
        !arranging &&
        !finding &&
        !drawingWall() &&
        (!scanLayout || kind !== "corner")
      ) {
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
          const placedModel = preview?.valid ? furniture.withoutSelection : furniture.model;
          renderer.drawPlaced(placedModel, [origin[0], origin[1], origin[2]], angle);
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
        models.dispose();
        finishFinding();
        camera?.dispose();
        viewAnchor.set();
        active.cancel();
        overlay.removeEventListener("beforexrselect", click);
        renderer.dispose();
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
        if (!scanLayout || !furniture.items.length || tracing || finding) return;
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
        if (mode === "view" && orientation !== null) {
          viewItem = items.find((item) => item.id === id && viewPositions[item.id]);
        } else {
          if (!arranging) return;
          furniture.select(id);
        }
        help("");
      },
      findObjects: () => {
        if (!scanLayout || tracing || arranging || pending.length) return;
        if (finding) {
          finishFinding();
          help("");
          return;
        }
        if (!camera) {
          help("Браузер не дал доступ к кадрам камеры. Выделите предмет вручную.");
          return;
        }
        if (!hasInventorySpace()) {
          help("В проекте достигнут предел мебели.");
          return;
        }
        finding = true;
        measurement = "";
        scanner.start();
        help("");
      },
      trace: () => {
        if (!scanLayout || arranging || finding || pending.length) return;
        if (!tracing && !hasInventorySpace()) {
          help("В проекте достигнут предел мебели.");
          return;
        }
        tracing = !tracing;
        marks.length = 0;
        measurement = "";
        resetTracking();
        help("");
      },
      removeItem: () => {
        if (!arranging || !furniture.selected) return;
        recognized.delete(furniture.selected.id);
        furniture.removeSelected();
        measurement = "";
        help("");
      },
      exit: () => session.end(),
      kind: (next?: string) => {
        if (!scanLayout || arranging || tracing || finding) return;
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
      rotate: (value?: string) => {
        if (!value) return;
        const angle = Number(value);
        if (!Number.isFinite(angle)) return;
        if (arranging) {
          furniture.rotate(angle);
        } else if (mode === "view" && orientation !== null) {
          if (viewItem && viewPositions[viewItem.id]) {
            const previous = viewPositions[viewItem.id];
            viewPositions = {
              ...viewPositions,
              [viewItem.id]: rotatePosition(viewItem, previous, angle)
            };
            model = furnitureMesh(items, viewPositions, models.get);
            viewEdited = true;
          } else rotation = normalizeAngle(angle);
        }
        help("");
      },
      undo: () => {
        if (finding) return;
        if (tracing) marks.pop();
        else if (arranging || (scanLayout && !pending.length && furniture.canUndo)) {
          furniture.undo();
          measurement = "";
          for (const id of recognized.keys()) {
            if (!furniture.placedIds.includes(id)) recognized.delete(id);
          }
        } else if (mode === "view") {
          origin = null;
          orientation = null;
          rotation = 0;
          viewItem = undefined;
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
        if (mode === "view") {
          if (viewEdited) {
            onViewLayout(viewPositions);
            viewEdited = false;
            help("Повороты мебели сохранены.");
          }
          return;
        }
        if (!scanLayout) return;
        if (tracing && marks.length) {
          help("Завершите выделение предмета или отмените его.");
          return;
        }
        if (pending.length) {
          help("Отметьте второй край проёма или отмените незавершённую точку.");
          return;
        }
        finishFinding();
        const result = getScanResult(scanLayout, features);
        const positions =
          furniture.placedIds.length || furniture.canUndo ? furniture.positions() : undefined;
        onScan({ ...result, positions }, furniture.additions);
        await session.end();
      }
    };
  } catch (error) {
    models.dispose();
    tracker?.cancel();
    await session.end().catch(() => {});
    throw error;
  }
};

export type ARController = Awaited<ReturnType<typeof startAR>>;
