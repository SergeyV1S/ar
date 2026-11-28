import type { ImageRotation } from "../recognition/index.ts";
import type { Point } from "../types/index.ts";

export type CameraPose = {
  transform: Float32Array;
  projection: Float32Array;
  rotation?: ImageRotation;
};

export const cameraOrigin = (matrix: Float32Array): Point => [matrix[12], matrix[13], matrix[14]];

export const getCameraRotation = (matrix: Float32Array): ImageRotation => {
  const rightUp = matrix[1];
  const screenUp = matrix[5];
  if (Math.max(Math.abs(rightUp), Math.abs(screenUp)) < 0.1) return 0;
  if (Math.abs(rightUp) > Math.abs(screenUp)) return rightUp > 0 ? 270 : 90;
  return screenUp < 0 ? 180 : 0;
};

export const cameraImagePoint = (
  rotation: ImageRotation,
  u: number,
  v: number
): [number, number] => {
  if (rotation === 90) return [v, 1 - u];
  if (rotation === 180) return [1 - u, 1 - v];
  if (rotation === 270) return [1 - v, u];
  return [u, v];
};

export const viewRay = (
  { transform: m, projection, rotation = 0 }: CameraPose,
  u: number,
  v: number
): Point => {
  const [cameraU, cameraV] = cameraImagePoint(rotation, u, v);
  const x = (2 * cameraU - 1 + projection[8]) / projection[0];
  const y = (1 - 2 * cameraV + projection[9]) / projection[5];
  return [m[0] * x + m[4] * y - m[8], m[1] * x + m[5] * y - m[9], m[2] * x + m[6] * y - m[10]];
};

export const horizontalProjection = ({ projection, rotation }: CameraPose) =>
  rotation === 90 || rotation === 270 ? projection[5] : projection[0];

const pointAlong = (origin: Point, direction: Point, distance: number) =>
  origin.map((coordinate, index) => coordinate + direction[index] * distance);

const floorIntersection = (origin: Point, ray: Point, floor: number): Point | null => {
  if (ray[1] >= -0.01) return null;
  const distance = (floor - origin[1]) / ray[1];
  if (distance <= 0 || distance * Math.hypot(...ray) > 35) return null;
  const [x, , z] = pointAlong(origin, ray, distance);
  return [x, floor, z];
};

export const projectToFloor = (camera: CameraPose, u: number, v: number, floor: number) =>
  floorIntersection(cameraOrigin(camera.transform), viewRay(camera, u, v), floor);

export const projectDepth = (camera: CameraPose, u: number, v: number, depth: number) =>
  pointAlong(cameraOrigin(camera.transform), viewRay(camera, u, v), depth);
