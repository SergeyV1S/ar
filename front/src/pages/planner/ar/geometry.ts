import { newId } from "../../../shared/helpers/index.ts";
import {
  clamp,
  dimensions,
  maxOutlinePoints,
  normalizeWithOrigin,
  round,
  validPolygon
} from "../planning/index.ts";
import type { Opening, Point, ScanFeature, ScanResult } from "../types/index.ts";

export const maxCorners = maxOutlinePoints;
export const maxOpenings = 40;
export const closeRadius = 0.16;
export const duplicateRadius = 0.07;

export type RoomFrame = { x: number; z: number; cos: number; sin: number };

const planGap = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export const roomFrame = (corners: Point[]): RoomFrame | null => {
  const first = corners[0];
  if (!first) return null;
  const second = corners.find((corner, index) => index > 0 && planGap(corner, first) > 0.3);
  if (!second) return null;
  const angle = Math.atan2(second[2] - first[2], second[0] - first[0]);
  return { x: first[0], z: first[2], cos: Math.cos(angle), sin: Math.sin(angle) };
};

export const toRoom = ({ x, z, cos, sin }: RoomFrame, [px, , pz]: Point): Point => [
  (px - x) * cos + (pz - z) * sin,
  -(px - x) * sin + (pz - z) * cos
];

export const projectOnWall = (point: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const along = clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length, 0, length);
  return {
    u: along,
    error: Math.hypot(
      point[0] - (a[0] + (dx * along) / length),
      point[1] - (a[1] + (dy * along) / length)
    ),
    length
  };
};

const alignAxis = (points: Point[], tolerance: number) => {
  const result = points.map(([x, y]) => [x, y]);
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    result.forEach((a, index) => {
      const b = result[(index + 1) % result.length];
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const offX = Math.abs(Math.sin(angle));
      const offY = Math.abs(Math.cos(angle));
      if (Math.min(offX, offY) > tolerance) return;
      const axis = offX < offY ? 1 : 0;
      const value = (a[axis] + b[axis]) / 2;
      if (a[axis] === value && b[axis] === value) return;
      a[axis] = value;
      b[axis] = value;
      changed = true;
    });
    if (!changed) break;
  }
  return result;
};

const dropCollinear = (points: Point[], tolerance: number) => {
  if (points.length < 4) return points;
  const result = points.filter((point, index) => {
    const before = points[(index + points.length - 1) % points.length];
    const after = points[(index + 1) % points.length];
    const first = Math.atan2(point[1] - before[1], point[0] - before[0]);
    const second = Math.atan2(after[1] - point[1], after[0] - point[0]);
    const turn = Math.abs(Math.atan2(Math.sin(second - first), Math.cos(second - first)));
    return turn > tolerance;
  });
  return result.length >= 3 ? result : points;
};

const straighten = (points: Point[], toleranceDeg = 7) => {
  if (points.length < 4) return points;
  const tolerance = (toleranceDeg * Math.PI) / 180;
  const aligned = dropCollinear(alignAxis(points, Math.sin(tolerance)), tolerance * 0.24);
  if (!validPolygon(aligned)) return points;
  return aligned;
};

const mergeOpenings = (openings: Opening[]) => {
  const result: Opening[] = [];
  for (const opening of openings) {
    const duplicate = result.some(
      (candidate) =>
        candidate.wall === opening.wall &&
        candidate.type === opening.type &&
        Math.abs(candidate.offset - opening.offset) < 0.12 &&
        Math.abs(candidate.width - opening.width) < 0.12
    );
    if (!duplicate) result.push(opening);
  }
  return result;
};

export const getScanLayout = (corners: Point[]) => {
  if (corners.length < 3) return null;
  const frame = roomFrame(corners);
  if (!frame) return null;
  const raw = corners.map((corner) => toRoom(frame, corner));
  const { origin: [x, z], points } = normalizeWithOrigin(straighten(raw));
  const extent = dimensions(points);
  if (extent.w < 0.7 || extent.d < 0.7 || extent.w > 35 || extent.d > 35 || !validPolygon(points))
    return null;
  const origin: Point = [
    frame.x + x * frame.cos - z * frame.sin,
    corners[0][1],
    frame.z + x * frame.sin + z * frame.cos
  ];
  const angle = Math.atan2(frame.sin, frame.cos);
  return { points, raw, frame, origin, angle };
};

export const analyzeScan = (corners: Point[], features: ScanFeature[]): ScanResult | null => {
  const layout = getScanLayout(corners);
  return layout && getScanResult(layout, features);
};

export const getScanResult = (
  { raw, points, frame }: NonNullable<ReturnType<typeof getScanLayout>>,
  features: ScanFeature[]
): ScanResult => {
  const openings: Opening[] = [];
  let skipped = 0;
  for (const feature of features) {
    const targets = feature.points.map((point) => toRoom(frame, point));
    if (openings.length >= maxOpenings || !targets.length) {
      skipped++;
      continue;
    }
    let choice: { wall: number; error: number; line: ReturnType<typeof projectOnWall>[] } | null =
      null;
    for (let wall = 0; wall < raw.length; wall++) {
      const line = targets.map((point) =>
        projectOnWall(point, raw[wall], raw[(wall + 1) % raw.length])
      );
      const error = Math.max(...line.map((entry) => entry.error));
      if (!choice || error < choice.error) choice = { wall, error, line };
    }
    if (!choice) {
      skipped++;
      continue;
    }
    const uses = choice.line.map((entry) => entry.u);
    const size = feature.type === "socket" ? 0.08 : Math.max(...uses) - Math.min(...uses);
    const minimum = feature.type === "socket" ? 0.07 : 0.28;
    if (choice.error > 0.38 || size < minimum) {
      skipped++;
      continue;
    }
    const width = Math.min(size, choice.line[0].length);
    const offset =
      feature.type === "socket"
        ? clamp(choice.line[0].u - width / 2, 0, choice.line[0].length - width)
        : Math.min(...uses);
    openings.push({
      id: newId(),
      type: feature.type,
      wall: choice.wall,
      width: round(width),
      offset: round(offset),
      hinge: uses[uses.length - 1] < uses[0] ? "end" : "start"
    });
  }
  return { points, openings: mergeOpenings(openings), skipped };
};

export const snapCorner = (candidate: Point, previous: Point | null, square: boolean, axis = 0) => {
  if (!previous || !square) return candidate;
  const dx = candidate[0] - previous[0];
  const dz = candidate[2] - previous[2];
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return candidate;
  const angle = Math.atan2(dz, dx) - axis;
  const target = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  if (Math.abs(angle - target) > (10 * Math.PI) / 180) return candidate;
  return [
    previous[0] + length * Math.cos(target + axis),
    candidate[1],
    previous[2] + length * Math.sin(target + axis)
  ];
};

export const nearPoint = (candidate: Point, target: Point, radius: number) =>
  planGap(candidate, target) < radius;

export const smoothPoint = (previous: Point | null, next: Point, factor = 0.5) =>
  previous
    ? next.map((value, index) => previous[index] + (value - previous[index]) * factor)
    : [...next];

export const getWallTarget = (corners: Point[], hit: Point, snap: boolean) => {
  const first = corners[0];
  const last = corners.at(-1);
  if (!first || !last) return null;
  if (corners.length >= 3 && nearPoint(hit, first, closeRadius)) {
    return { point: first, length: planGap(last, first), closes: true };
  }
  if (corners.length >= maxCorners) return null;
  const second = corners[1];
  const axis = second ? Math.atan2(second[2] - first[2], second[0] - first[0]) : undefined;
  const onFloor: Point = [hit[0], first[1], hit[2]];
  const point = snapCorner(onFloor, last, snap && axis !== undefined, axis);
  if (corners.some((corner) => nearPoint(point, corner, duplicateRadius))) return null;
  return { point, length: planGap(last, point), closes: false };
};
