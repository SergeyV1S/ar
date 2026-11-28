import type { Item, Point, Position } from "../types/index.ts";
import { bounds } from "./geometry.ts";

export const meshCoordinateScale = 255;
export const maxMeshVertices = 1800;
export const maxMeshTriangles = 2400;

export const localMeshPoints = ({ arMesh, w, h, d }: Item) => {
  if (!arMesh) return [];
  const { vertices } = arMesh;
  return Array.from({ length: vertices.length / 3 }, (_, index): Point => [
    (vertices[index * 3] * w) / meshCoordinateScale,
    (vertices[index * 3 + 1] * h) / meshCoordinateScale,
    (vertices[index * 3 + 2] * d) / meshCoordinateScale
  ]);
};

export const planMeshPoints = (item: Item, position: Position) => {
  const box = bounds(item, position);
  const angle = (position.r * Math.PI) / 180;
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  const cx = box.x + box.w / 2;
  const cz = box.y + box.d / 2;
  return localMeshPoints(item).map(([x, h, z]) => [
    cx + (x - item.w / 2) * cs - (z - item.d / 2) * sn,
    cz + (x - item.w / 2) * sn + (z - item.d / 2) * cs,
    h
  ]);
};

export const meshTriangles = (points: Point[], indices: number[]) =>
  Array.from({ length: indices.length / 3 }, (_, i) => [
    points[indices[i * 3]],
    points[indices[i * 3 + 1]],
    points[indices[i * 3 + 2]]
  ]);
