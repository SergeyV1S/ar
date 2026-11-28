import { pointIn } from "../planning/index.ts";
import type { Point } from "../types/index.ts";
import type { ScanLayout } from "./geometry.ts";
import { toPlan } from "./geometry.ts";
import type { Rgb } from "./mesh.ts";
import type { CameraPose } from "./projection.ts";
import { projectDepth } from "./projection.ts";

export type DepthMap = { width: number; height: number; samples: Float32Array };
export type DepthGrid = { width: number; height: number; points: (Point | null)[] };

const pixelCenter = (index: number, size: number) => (index + 0.5) / size;

export const readCenterDepth = (frame: XRFrame, view: XRView) => {
  try {
    const value = frame.getDepthInformation(view)?.getDepthInMeters(0.5, 0.5);
    return value !== undefined && value > 0.25 && value < 9 ? value : null;
  } catch {
    return null;
  }
};

export const readDepthMap = (frame: XRFrame, view: XRView): DepthMap | undefined => {
  try {
    const depth = frame.getDepthInformation(view);
    if (!depth) return;
    const width = Math.min(depth.width, 56);
    const height = Math.min(depth.height, 56);
    const samples = Float32Array.from({ length: width * height }, (_, index) =>
      depth.getDepthInMeters(
        pixelCenter(index % width, width),
        pixelCenter(Math.floor(index / width), height)
      )
    );
    return { width, height, samples };
  } catch {
    return;
  }
};

export const projectDepthGrid = (
  layout: ScanLayout,
  camera: CameraPose,
  { width, height, samples }: DepthMap
): DepthGrid => ({
  width,
  height,
  points: Array.from(samples, (depth, index) => {
    if (!(depth > 0.25 && depth < 9)) return null;
    const u = pixelCenter(index % width, width);
    const v = pixelCenter(Math.floor(index / width), height);
    const point = projectDepth(camera, u, v, depth);
    if (point[1] < layout.origin[1] - 0.12 || !pointIn(toPlan(layout, point), layout.points))
      return null;
    return point;
  })
});

export const pointVertices = (points: Point[], tint: Rgb, opacity: number) =>
  Float32Array.from(points.flatMap(([x, y, z]) => [x, y, z, ...tint, opacity]));
