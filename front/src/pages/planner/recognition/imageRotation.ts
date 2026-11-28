import type { ImageRotation } from "./types.ts";

// Map an upright image point back into the raw camera frame.
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
