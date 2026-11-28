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
import { createARItem, createArrangement, getItemTarget } from "./arrangement.ts";
import { createARCamera } from "./camera.ts";
import { furnitureMesh, itemVolume } from "./furniture.ts";
import { getScanLayout, getScanResult, getWallTarget } from "./geometry.ts";
import { getInstructions } from "./getInstructions.ts";
import type { TracedFootprint } from "./itemTrace.ts";
import { canTracePoint, finishItemOutline, traceHeightAt } from "./itemTrace.ts";
import { createMesh, rgb } from "./mesh.ts";
import { aimAtFloor } from "./projection.ts";
import type { Mesh } from "./renderer.ts";
import { createRenderer } from "./renderer.ts";
import { createFurnitureScanner } from "./scanner.ts";
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
  starterIds: string[];
  newItemLimit: number;
  positions: Positions;
  roomPoints: Point[];
  onState: (state: XRState) => void;
  onScan: (result: ScanResult, scannedItems: Item[]) => void;
  onEnd: () => void;
};

export const startAR = async ({
  mode,
  overlay,
  items,
  starterIds,
  newItemLimit,
  positions,
  roomPoints,
  onState,
  onScan,
  onEnd
}: ARStartOptions) => {
  if (!globalThis.isSecureContext || !navigator.xr) throw new Error(arHelp);
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    optionalFeatures: [
      "depth-sensing",
      "anchors",
      "plane-detection",
      ...(mode === "scan" ? ["camera-access"] : [])
    ],
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
    const scanner = createFurnitureScanner(
      mode === "scan" ? createARCamera(session, gl) : null,
      newItemLimit,
      mode === "scan" && session.depthUsage === "cpu-optimized"
    );
    const viewAnchor = createViewAnchor(space);
    const model = mode === "view" ? furnitureMesh(items, positions) : emptyMesh;
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
    const furniture = createArrangement(items, starterIds, newItemLimit);
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
    let trace: { points: Point[]; item?: Item; footprint?: TracedFootprint } | null = null;
    let traceHeight: number | null = null;
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
      arranging &&
      !trace &&
      scanLayout &&
      hit &&
      furniture.selected &&
      furniture.canPlace(furniture.selected.id)
        ? getItemTarget(scanLayout, furniture.selected, hit, furniture.rotation)
        : null;
    const tracePoint = () =>
      trace && scanLayout && hit && canTracePoint(scanLayout, trace.points, hit) ? hit : null;
    const canTraceItem = () =>
      arranging &&
      (furniture.selected ? furniture.canPlace(furniture.selected.id) : furniture.canAdd());
    const canConfirmTrace = () => {
      if (!trace) return false;
      return trace.footprint ? traceHeight !== null : tracePoint() !== null;
    };
    const resetTracking = () => {
      active.reset();
      hit = null;
      confidence = 0;
      traceHeight = null;
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
      const ready = arranging
        ? furnitureTarget()?.valid === true
        : hasHit && (!drawingWall() || target !== null) && (!closed || kind !== "corner");
      const state: XRState = {
        kind,
        ready: !scanner.active && (trace ? canConfirmTrace() : ready),
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
        placedIds: furniture.placedIds,
        detectedItems: [...furniture.detectedItems],
        manualItems: [...furniture.manualItems],
        canTraceItem: canTraceItem(),
        canUndoPlacement: furniture.canUndo,
        depthAvailable: scanner.available,
        canFindFurniture:
          closed && scanner.available && newItemLimit > 0 && !furniture.detectedItems.length,
        searchingFurniture: scanner.active,
        analyzingFurniture: scanner.hasAnalyzed,
        hasDepthPoints: scanner.cloud.length > 0 || scanner.highlights.length > 0,
        tracingItem: trace
          ? {
              count: trace.points.length,
              heightStep: Boolean(trace.footprint),
              height: traceHeight ?? undefined
            }
          : undefined,
        foundFurnitureCount: scanner.foundCount
      };
      state.text =
        (now < noticeUntil && notice) || getInstructions(mode, origin, state, pending.length);
      const signature = JSON.stringify(state);
      lastState = now;
      if (signature === lastSignature) return;
      lastSignature = signature;
      onState(state);
    };

    const findFurniture = () => {
      if (!scanLayout || arranging || furniture.detectedItems.length) return;
      if (pending.length) {
        help("Отметьте второй край проёма или отмените незавершённую отметку.");
        return;
      }
      if (scanner.start(scanLayout)) {
        resetTracking();
        help("");
      }
    };
    const finishFurnitureSearch = () => {
      if (!scanner.active) return;
      const entries = scanner.finish();
      if (entries.length) {
        furniture.addDetected(entries);
        arranging = true;
        help("Проверьте отсканированные объекты перед сохранением.");
      } else
        help("Пока не удалось построить модели. Обойдите объекты ближе или обведите их вручную.");
      resetTracking();
    };
    const skipFurnitureSearch = () => {
      scanner.cancel();
      resetTracking();
      help("");
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
      findFurniture();
    };

    const startItemTrace = () => {
      if (!scanLayout || !canTraceItem()) return;
      trace = { points: [], item: furniture.selected };
      resetTracking();
      help("");
    };
    const closeItemOutline = () => {
      if (!trace || !scanLayout) return;
      const footprint = finishItemOutline(scanLayout, trace.points);
      if (!footprint) {
        help("Отметьте контур основания по порядку, без пересечений.");
        return;
      }
      trace.footprint = footprint;
      resetTracking();
      help("");
    };
    const cancelItemTrace = () => {
      trace = null;
      resetTracking();
      help("");
    };
    const collectTrace = () => {
      if (!trace) return;
      const { footprint, item } = trace;
      if (footprint) {
        if (traceHeight === null) return;
        const dimensions = { w: footprint.w, d: footprint.d, h: traceHeight };
        const model = {
          ...dimensions,
          arFootprint: footprint.arFootprint,
          arMesh: undefined,
          source: "xr",
          verified: "review"
        };
        if (item) furniture.reshape({ ...item, ...model }, footprint.position);
        else
          furniture.addManual(
            {
              ...createARItem({ ...dimensions, name: "Обведённый объект", kind: "other" }),
              ...model
            },
            footprint.position
          );
        trace = null;
        resetTracking();
        help("Форма и размеры предмета обновлены.");
        return;
      }
      const point = tracePoint();
      if (!point) return;
      trace.points.push(point);
      resetTracking();
      help("");
    };

    const collect = () => {
      if (scanner.active) return;
      if (trace) {
        collectTrace();
        return;
      }
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
        if (hit || traceHeight !== null) {
          hit = null;
          confidence = 0;
          traceHeight = null;
          help("");
        }
        return;
      }
      const firstView = pose.views[0];
      if (mode === "scan" && firstView && layer) scanner.update(time, frame, firstView);
      if (scanner.active) {
        hit = null;
        confidence = 0;
      } else if (trace?.footprint && scanLayout && firstView) {
        const height = traceHeightAt(scanLayout, trace.footprint, frame, firstView);
        traceHeight =
          height !== null && traceHeight !== null
            ? round(traceHeight * 0.65 + height * 0.35)
            : height;
        hit = null;
        confidence = 0;
      } else if (arranging && scanLayout && firstView) {
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
      if (trace) {
        const { points, footprint } = trace;
        points.forEach((point, index) => {
          const next = points[index + 1];
          if (next) liveMesh.beam(point, next, 0.009, greenSoft);
          marker(liveMesh, point, greenSoft, 0.028);
        });
        const last = points.at(-1);
        const next = footprint ? points[0] : tracePoint();
        if (last && next) liveMesh.beam(last, next, 0.009, greenSoft);
        if (footprint && traceHeight !== null) {
          itemVolume(liveMesh, points, traceHeight, greenSoft, 0.34);
        } else if (next && !footprint) marker(liveMesh, next, greenSoft, 0.032);
      } else if (arranging && hit && furniture.selected) {
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
        renderer.drawPoints(scanner.cloud, 3);
        renderer.drawPoints(scanner.highlights, 5);
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
        scanner.dispose();
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
      findFurniture,
      finishFurnitureSearch,
      skipFurnitureSearch,
      startItemTrace,
      closeItemOutline,
      cancelItemTrace,
      arrange: () => {
        if (
          !scanLayout ||
          scanner.active ||
          (!items.length &&
            !furniture.detectedItems.length &&
            !furniture.manualItems.length &&
            !furniture.canAdd())
        )
          return;
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
      removePlacement: () => {
        if (!arranging) return;
        furniture.remove();
        help("");
      },
      exit: () => session.end(),
      kind: (next?: string) => {
        if (!scanLayout || arranging || scanner.active) return;
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
        if (scanner.active) return;
        if (trace?.footprint) trace.footprint = undefined;
        else if (trace) trace.points.pop();
        else if (arranging) furniture.undo();
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
          furniture.clearDetected();
          kind = "corner";
        } else corners.pop();
        resetTracking();
        sceneDirty = true;
        help("");
      },
      save: async () => {
        if (!scanLayout || scanner.active || trace) return;
        if (pending.length) {
          help("Отметьте второй край проёма или отмените незавершённую точку.");
          return;
        }
        const result = getScanResult(scanLayout, features);
        onScan(
          { ...result, positions: furniture.placedIds.length ? furniture.positions() : undefined },
          furniture.itemsForSave
        );
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
