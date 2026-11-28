import { pointIn } from "../planning/index.ts";
import type { Point } from "../types/index.ts";
import type { ScanLayout } from "./geometry.ts";
import { roomPoint } from "./geometry.ts";
import { depthGridSize } from "./objectMeasurement.ts";
import type { CameraPose } from "./projection.ts";
import { cameraImagePoint, cameraOrigin, viewRay } from "./projection.ts";

const maskSteps = 2 * (depthGridSize - 1);
const maskSize = maskSteps + 1;

const rayEntersRoom = (
  points: Point[],
  [x, z]: Point,
  height: number,
  dx: number,
  dy: number,
  dz: number
) => {
  if (Math.abs(dy) > 1e-6) {
    const distance = -height / dy;
    if (distance > 0 && pointIn([x + distance * dx, z + distance * dz], points)) return true;
  }
  return points.some(([ax, az], index) => {
    const [bx, bz] = points[(index + 1) % points.length];
    const edgeX = bx - ax;
    const edgeZ = bz - az;
    const determinant = dx * edgeZ - dz * edgeX;
    if (Math.abs(determinant) < 1e-6) return false;
    const offsetX = ax - x;
    const offsetZ = az - z;
    const distance = (offsetX * edgeZ - offsetZ * edgeX) / determinant;
    const alongWall = (offsetX * dz - offsetZ * dx) / determinant;
    return distance > 0 && alongWall >= 0 && alongWall <= 1 && height + distance * dy >= 0;
  });
};

export const restrictRoomFrame = (
  { data, width, height }: Pick<ImageData, "data" | "width" | "height">,
  layout: ScanLayout,
  camera: CameraPose,
  readDistance: (u: number, v: number) => number | null
) => {
  const rawCamera: CameraPose = { ...camera, rotation: 0 };
  const eye = cameraOrigin(camera.transform);
  const origin = roomPoint(layout, eye);
  const [x, z] = origin;
  const eyeHeight = eye[1] - layout.origin[1];
  const eyeInRoom = eyeHeight >= 0 && pointIn(origin, layout.points);
  const { cos, sin } = layout.frame;
  const mask = new Uint8Array(maskSize ** 2);
  const rawDepth = new Float32Array(mask.length);

  for (let i = 0; i < mask.length; i++) {
    const u = (i % maskSize) / maskSteps;
    const v = Math.floor(i / maskSize) / maskSteps;
    const distance = readDistance(u, v);
    if (distance === null && eyeInRoom) {
      mask[i] = 1;
      continue;
    }
    const [rx, dy, rz] = viewRay(rawCamera, u, v);
    const dx = rx * cos + rz * sin;
    const dz = -rx * sin + rz * cos;
    if (distance === null) {
      mask[i] = Number(rayEntersRoom(layout.points, origin, eyeHeight, dx, dy, dz));
      continue;
    }
    rawDepth[i] = distance;
    // Allow depth noise at the floor. The selected walls bound the horizontal position.
    mask[i] = Number(
      eyeHeight + distance * dy >= -0.05 &&
        pointIn([x + distance * dx, z + distance * dz], layout.points)
    );
  }
  if (!mask.includes(1)) return null;

  // Use YOLO's letterbox color and preserve the frame coordinates for measuring boxes.
  for (let row = 0; row < height; row++) {
    const maskRow = Math.round(((row + 0.5) / height) * maskSteps) * maskSize;
    for (let column = 0; column < width; column++) {
      const maskColumn = Math.round(((column + 0.5) / width) * maskSteps);
      if (mask[maskRow + maskColumn]) continue;
      const pixel = (row * width + column) * 4;
      data.fill(114, pixel, pixel + 3);
    }
  }

  const depth = new Float32Array(depthGridSize ** 2);
  for (let i = 0; i < depth.length; i++) {
    const u = (i % depthGridSize) / (depthGridSize - 1);
    const v = Math.floor(i / depthGridSize) / (depthGridSize - 1);
    const [rawU, rawV] = cameraImagePoint(camera.rotation ?? 0, u, v);
    depth[i] = rawDepth[Math.round(rawV * maskSteps) * maskSize + Math.round(rawU * maskSteps)];
  }
  return depth;
};
