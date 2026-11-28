import type { Point } from "../types/index.ts";

export type CameraPose = {
  transform: Float32Array;
  projection: Float32Array;
};

const cameraOrigin = (matrix: Float32Array): Point => [matrix[12], matrix[13], matrix[14]];

const viewRay = ({ transform: m, projection }: CameraPose, u: number, v: number): Point => {
  const x = (2 * u - 1 + projection[8]) / projection[0];
  const y = (1 - 2 * v + projection[9]) / projection[5];
  return [m[0] * x + m[4] * y - m[8], m[1] * x + m[5] * y - m[9], m[2] * x + m[6] * y - m[10]];
};

const pointAlong = (origin: Point, direction: Point, distance: number) =>
  origin.map((coordinate, index) => coordinate + direction[index] * distance);

const floorIntersection = (origin: Point, ray: Point, floor: number): Point | null => {
  if (ray[1] >= -0.01) return null;
  const distance = (floor - origin[1]) / ray[1];
  if (distance <= 0 || distance * Math.hypot(...ray) > 35) return null;
  const [x, , z] = pointAlong(origin, ray, distance);
  return [x, floor, z];
};

export const aimAtFloor = (matrix: Float32Array, floor: number) =>
  floorIntersection(cameraOrigin(matrix), [-matrix[8], -matrix[9], -matrix[10]], floor);

export const projectToFloor = (camera: CameraPose, u: number, v: number, floor: number) =>
  floorIntersection(cameraOrigin(camera.transform), viewRay(camera, u, v), floor);

export const projectDepth = (camera: CameraPose, u: number, v: number, depth: number) =>
  pointAlong(cameraOrigin(camera.transform), viewRay(camera, u, v), depth);
