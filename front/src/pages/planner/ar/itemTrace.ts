import {
  centeredPosition,
  fitsFootprint,
  itemFootprint,
  normalizeAngle,
  pointIn,
  round
} from "../planning/index.ts";
import type { Point } from "../types/index.ts";
import type { ScanLayout } from "./geometry.ts";
import { roomPoint } from "./geometry.ts";
import type { CameraPose } from "./projection.ts";
import { cameraOrigin, viewRay } from "./projection.ts";

export const traceLabels = [
  "Начало стороны",
  "Конец стороны",
  "Противоположная сторона",
  "Верх предмета"
];

export const traceInstructions = [
  "Наведите прицел на первый угол основания у пола.",
  "Отметьте второй угол той же стороны у пола.",
  "Отметьте дальнюю сторону основания, чтобы задать длину.",
  "Наведите прицел на верхнюю кромку предмета и подтвердите высоту."
];

export const traceBase = (layout: ScanLayout, marks: Point[]) => {
  if (marks.length < 3) return null;
  const [a, b, c] = marks.map((point) => roomPoint(layout, point));
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (width < 0.1 || width > 20) return null;
  const ux = (b[0] - a[0]) / width;
  const uy = (b[1] - a[1]) / width;
  const depth = (c[1] - a[1]) * ux - (c[0] - a[0]) * uy;
  if (Math.abs(depth) < 0.1 || Math.abs(depth) > 20) return null;
  const size = { w: round(width), d: round(Math.abs(depth)) };
  const center = [(a[0] + b[0] - uy * depth) / 2, (a[1] + b[1] + ux * depth) / 2];
  const rotation = normalizeAngle(round((Math.atan2(uy, ux) * 180) / Math.PI));
  const position = centeredPosition(size, center, rotation);
  const footprint = itemFootprint(size, position);
  return { size, position, footprint, valid: fitsFootprint(footprint, layout.points) };
};

export const traceHeight = (
  layout: ScanLayout,
  footprint: Point[],
  camera: CameraPose,
  measured: Point | null
) => {
  if (measured && pointIn(roomPoint(layout, measured), footprint)) {
    const height = measured[1] - layout.origin[1];
    if (height >= 0.1 && height <= 20) return round(height);
  }
  const relative = roomPoint(layout, cameraOrigin(camera.transform));
  const ray = viewRay(camera, 0.5, 0.5);
  const direction = [
    ray[0] * layout.frame.cos + ray[2] * layout.frame.sin,
    ray[2] * layout.frame.cos - ray[0] * layout.frame.sin
  ];
  const hits = footprint.flatMap((point, index) => {
    const next = footprint[(index + 1) % footprint.length];
    const edge = [next[0] - point[0], next[1] - point[1]];
    const dx = point[0] - relative[0];
    const dz = point[1] - relative[1];
    const cross = direction[0] * edge[1] - direction[1] * edge[0];
    if (Math.abs(cross) < 1e-5) return [];
    const t = (dx * edge[1] - dz * edge[0]) / cross;
    const along = (dx * direction[1] - dz * direction[0]) / cross;
    return t > 0 && along >= -0.025 && along <= 1.025 ? [t] : [];
  });
  if (!hits.length) return null;
  const nearest = Math.min(...hits);
  const projected = camera.transform[13] + nearest * ray[1] - layout.origin[1];
  return projected >= 0.1 && projected <= 20 ? round(projected) : null;
};
