import {
  dimensions,
  distance,
  maxOutlinePoints,
  normalize,
  validPolygon
} from "../planning/index.ts";
import type { Point } from "../types/index.ts";

const simplifyLine = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const length = Math.hypot(dx, dy);
  let largest = tolerance;
  let furthest = 0;
  points.slice(1, -1).forEach((point, index) => {
    const offset = length
      ? Math.abs(dx * (point[1] - first[1]) - dy * (point[0] - first[0])) / length
      : distance(point, first);
    if (offset <= largest) return;
    largest = offset;
    furthest = index + 1;
  });
  if (!furthest) return [first, last];
  return [
    ...simplifyLine(points.slice(0, furthest + 1), tolerance).slice(0, -1),
    ...simplifyLine(points.slice(furthest), tolerance)
  ];
};

export const simplifyRoomStroke = (points: Point[]) => {
  if (!points.length) return [];
  const first = points[0];
  const closed = [
    ...points.slice(0, -1),
    distance(first, points[points.length - 1]) < 0.055 ? first : points[points.length - 1],
    first
  ];
  for (let tolerance = 0.015; tolerance <= 0.12; tolerance *= 1.5) {
    const outline = simplifyLine(closed, tolerance).slice(0, -1);
    if (outline.length <= maxOutlinePoints) return outline;
  }
  return [];
};

export const scaleRoomStroke = (points: Point[], width: number, depth: number) => {
  if (
    points.length < 3 ||
    ![width, depth].every((size) => Number.isFinite(size) && size >= 0.7 && size <= 35)
  )
    return null;
  const { w, d } = dimensions(points);
  if (w < 0.035 || d < 0.035) return null;
  const outline = normalize(points.map(([x, y]) => [(x * width) / w, (y * depth) / d]));
  return validPolygon(outline) ? outline : null;
};
