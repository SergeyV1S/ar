import {
  dimensions,
  distance,
  maxItemOutlinePoints,
  minItemOutlineArea,
  normalizeWithOrigin,
  pointIn,
  polygonFits,
  round,
  validPolygon
} from "../planning/index.ts";
import type { Point, Position } from "../types/index.ts";
import { readCenterDepth } from "./depth.ts";
import type { ScanLayout } from "./geometry.ts";
import { toPlan, toWorld } from "./geometry.ts";
import { projectDepth } from "./projection.ts";

export const canTracePoint = (layout: ScanLayout, points: Point[], point: Point) => {
  const plan = toPlan(layout, point);
  return (
    points.length < maxItemOutlinePoints &&
    pointIn(plan, layout.points) &&
    points.every((existing) => distance(toPlan(layout, existing), plan) >= 0.08)
  );
};

export const finishItemOutline = (layout: ScanLayout, marks: Point[]) => {
  if (marks.length > maxItemOutlinePoints) return null;
  const plan = marks.map((point) => toPlan(layout, point));
  if (!validPolygon(plan, minItemOutlineArea) || !polygonFits(plan, layout.points)) return null;
  const {
    origin: [x, y],
    points
  } = normalizeWithOrigin(plan);
  const { w, d } = dimensions(points);
  if (w < 0.08 || d < 0.08 || w > 20 || d > 20) return null;
  if (!validPolygon(points, minItemOutlineArea)) return null;
  const position: Position = { x: round(x), y: round(y), r: 0 };
  const arFootprint = points.map(([u, v]) => [u / w, v / d]);
  return {
    w,
    d,
    arFootprint,
    position,
    center: toWorld(layout, x + w / 2, y + d / 2),
    radius: Math.hypot(w, d) / 2
  };
};

export const measureItemHeight = (camera: Float32Array, center: Point, radius: number) => {
  const dx = center[0] - camera[12];
  const dz = center[2] - camera[14];
  const rayX = -camera[8];
  const rayZ = -camera[10];
  const forward = dx * rayX + dz * rayZ;
  if (forward <= 0.01) return null;
  const distance = (dx * dx + dz * dz) / forward;
  const miss = Math.hypot(rayX * distance - dx, rayZ * distance - dz);
  const height = camera[13] - camera[9] * distance - center[1];
  if (miss > radius || height < 0.08 || height > 20) return null;
  return round(height);
};

export type TracedFootprint = NonNullable<ReturnType<typeof finishItemOutline>>;

export const traceHeightAt = (
  layout: ScanLayout,
  footprint: TracedFootprint,
  frame: XRFrame,
  view: XRView
) => {
  const camera = view.transform.matrix;
  const depth = readCenterDepth(frame, view);
  if (depth !== null) {
    const surface = projectDepth(
      { transform: camera, projection: view.projectionMatrix },
      0.5,
      0.5,
      depth
    );
    const [x, z] = toPlan(layout, surface);
    const h = surface[1] - layout.origin[1];
    const local = [
      (x - footprint.position.x) / footprint.w,
      (z - footprint.position.y) / footprint.d
    ];
    if (h >= 0.08 && h <= 20 && pointIn(local, footprint.arFootprint)) return round(h);
  }
  return measureItemHeight(camera, footprint.center, footprint.radius);
};
