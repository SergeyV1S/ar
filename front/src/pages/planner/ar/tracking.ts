import type { Point } from "../types/index.ts";
import { smoothPoint } from "./geometry.ts";

export type TrackedHit = {
  point: Point;
  confidence: number;
  source: "plane" | "depth";
};

type Options = {
  session: XRSession;
  viewer: XRSpace;
  space: XRReferenceSpace;
  floorLevel: () => number | undefined;
  acceptAnyHeight: () => boolean;
};

const upFacing = (matrix: Float32Array) => Math.abs(matrix[5]) > 0.78;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const unproject = (view: XRView, depth: number, ndcX: number, ndcY: number): Point | null => {
  const projection = view.projectionMatrix;
  if (projection.length < 16 || !Number.isFinite(depth) || depth <= 0.05) return null;
  const x = (2 * ndcX) / projection[0];
  const y = (2 * ndcY) / projection[5];
  const length = Math.hypot(x, y, 1);
  const local = [(x / length) * depth, (y / length) * depth, (-1 / length) * depth];
  const m = view.transform.matrix;
  return [
    m[0] * local[0] + m[4] * local[1] + m[8] * local[2] + m[12],
    m[1] * local[0] + m[5] * local[1] + m[9] * local[2] + m[13],
    m[2] * local[0] + m[6] * local[1] + m[10] * local[2] + m[14]
  ];
};

const depthAtCenter = (frame: XRFrame, view: XRView) => {
  try {
    const info = frame.getDepthInformation(view);
    if (!info) return null;
    const horizontal = 0.5;
    const vertical = 0.5;
    const row = Math.min(info.height - 1, Math.max(0, Math.round(vertical * info.height)));
    const column = Math.min(info.width - 1, Math.max(0, Math.round(horizontal * info.width)));
    const value = info.getDepthInMeters(column, row);
    return Number.isFinite(value) && value > 0.25 && value < 9 ? value : null;
  } catch {
    return null;
  }
};

export const createTracker = async ({
  session,
  viewer,
  space,
  floorLevel,
  acceptAnyHeight
}: Options) => {
  let hitSource: XRHitTestSource | null = null;
  try {
    hitSource =
      (await session.requestHitTestSource?.({ space: viewer, entityTypes: ["plane", "point"] })) ??
      null;
  } catch {
    hitSource = null;
  }
  const horizon: Point[] = [];
  let smoothed: Point | null = null;
  let confidence = 0;
  const gap = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[2] - b[2]);

  const score = (point: Point, up: boolean, cameraHeight: number | undefined) => {
    const floor = floorLevel();
    if (acceptAnyHeight()) return up ? 1 : 0.85;
    if (floor === undefined) {
      const belowCamera = cameraHeight === undefined || point[1] < cameraHeight - 0.1;
      return up && belowCamera ? 1 : 0;
    }
    const height = Math.abs(point[1] - floor);
    if (height > 0.45) return 0;
    return (up ? 1 : 0.6) * (1 - height / 0.9);
  };

  const update = (frame: XRFrame, view: XRView | undefined): TrackedHit | null => {
    const candidates: { point: Point; weight: number; floor: boolean }[] = [];
    const cameraHeight = view?.transform.matrix[13];
    if (hitSource) {
      for (const result of frame.getHitTestResults(hitSource)) {
        const pose = result.getPose(space);
        if (!pose) continue;
        const matrix = pose.transform.matrix;
        const point: Point = [matrix[12], matrix[13], matrix[14]];
        const floor = upFacing(matrix);
        const weight = score(point, floor, cameraHeight);
        if (weight > 0) candidates.push({ point, weight, floor });
      }
    }
    if (!candidates.length && view) {
      const depth = depthAtCenter(frame, view);
      const point = depth === null ? null : unproject(view, depth, 0, 0);
      if (point) {
        const weight = score(point, false, cameraHeight);
        if (weight > 0) candidates.push({ point, weight, floor: false });
      }
    }
    if (!candidates.length) {
      horizon.length = 0;
      smoothed = null;
      confidence = Math.max(0, confidence - 0.3);
      return null;
    }
    candidates.sort((first, second) => second.weight - first.weight);
    const best = candidates[0];
    const near = smoothed
      ? candidates.find((candidate) => gap(candidate.point, smoothed as Point) < 0.45)
      : undefined;
    const picked = near && near.weight > best.weight * 0.7 ? near : best;
    horizon.push(picked.point);
    if (horizon.length > 4) horizon.shift();
    const mixed: Point = [0, 1, 2].map((axis) => median(horizon.map((point) => point[axis])));
    smoothed = smoothPoint(smoothed, mixed, 0.65);
    confidence = Math.min(1, confidence + (picked.floor ? 0.3 : 0.18));
    return { point: smoothed, confidence, source: picked.floor ? "plane" : "depth" };
  };

  return {
    update,
    reset() {
      horizon.length = 0;
      smoothed = null;
      confidence = 0;
    },
    cancel() {
      hitSource?.cancel();
      hitSource = null;
    }
  };
};

export type Tracker = Awaited<ReturnType<typeof createTracker>>;
