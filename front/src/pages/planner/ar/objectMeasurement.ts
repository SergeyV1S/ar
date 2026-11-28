import { centeredPosition, clamp, pointIn, round } from "../planning/index.ts";
import type { FurnitureMatch } from "../recognition/index.ts";
import type { Point } from "../types/index.ts";
import type { ScanLayout } from "./geometry.ts";
import { roomPoint } from "./geometry.ts";
import type { CameraPose } from "./projection.ts";
import { cameraOrigin, projectDepth, projectToFloor } from "./projection.ts";

const typicalSizes: Record<string, { w: number; d: number; h: number }> = {
  Диван: { w: 2.1, d: 0.9, h: 0.85 },
  "Стул или кресло": { w: 0.52, d: 0.56, h: 0.86 },
  Стол: { w: 1.15, d: 0.75, h: 0.75 },
  Кровать: { w: 1.6, d: 2, h: 0.65 },
  Скамья: { w: 1.15, d: 0.52, h: 0.65 },
  "Напольное растение": { w: 0.5, d: 0.5, h: 0.8 }
};

export const depthGridSize = 33;

export const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = fraction * (sorted.length - 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
};

const positive = (value: number, typical: number) =>
  round(clamp(value, 0.13, Math.max(0.9, typical * 2.4)));

export const measureObject = (
  layout: ScanLayout,
  camera: CameraPose,
  depth: Float32Array,
  match: FurnitureMatch
) => {
  const [x, y, w, h] = match.box.map((value) => value / 100);
  if (w < 0.035 || h < 0.05 || x < 0.008 || y < 0.008 || x + w > 0.992 || y + h > 0.992)
    return null;
  const typical = typicalSizes[match.title];
  if (!typical) return null;
  const u = x + w / 2;
  const floor = layout.origin[1];
  const samples: { point: Point; height: number; depth: number; central: boolean }[] = [];
  for (let gy = 0; gy < depthGridSize; gy++) {
    const v = gy / (depthGridSize - 1);
    if (v < y + h * 0.1 || v > y + h * 0.91) continue;
    for (let gx = 0; gx < depthGridSize; gx++) {
      const sx = gx / (depthGridSize - 1);
      if (sx < x + w * 0.1 || sx > x + w * 0.9) continue;
      const value = depth[gy * depthGridSize + gx];
      if (!value) continue;
      const world = projectDepth(camera, sx, v, value);
      const point = roomPoint(layout, world);
      const height = world[1] - floor;
      if (height < 0.08 || height > Math.max(1.5, typical.h * 2) || !pointIn(point, layout.points))
        continue;
      samples.push({ point, height, depth: value, central: Math.abs(sx - u) < w * 0.26 });
    }
  }

  const central = samples.filter((sample) => sample.central);
  const near = percentile(
    (central.length >= 4 ? central : samples).map((sample) => sample.depth),
    0.28
  );
  const foreground = samples.filter(
    (sample) => sample.depth >= near - 0.22 && sample.depth <= near + typical.d * 0.75
  );
  const measured = foreground.length >= 7;
  const foot = projectToFloor(camera, u, y + h, floor);
  if (!measured && !foot) return null;

  const eye = roomPoint(layout, cameraOrigin(camera.transform));
  const spans = [0, 1].map((axis) => {
    const values = foreground.map(({ point }) => point[axis]);
    return [percentile(values, 0.06), percentile(values, 0.94)];
  });
  const face = foot ? roomPoint(layout, foot) : [0, 0];
  if (measured) {
    face[0] = (spans[0][0] + spans[0][1]) / 2;
    face[1] = (spans[1][0] + spans[1][1]) / 2;
  }
  const along = Math.abs(face[0] - eye[0]) < Math.abs(face[1] - eye[1]) ? 0 : 1;
  const away = 1 - along;
  const cameraDistance = Math.hypot(face[0] - eye[0], face[1] - eye[1]);
  if (cameraDistance < 0.25 || cameraDistance > 7) return null;
  const opticalDistance = measured
    ? near
    : (foot ?? []).reduce(
        (sum, coordinate, axis) =>
          sum + (camera.transform[12 + axis] - coordinate) * camera.transform[8 + axis],
        0
      );
  const apparentWidth = (2 * w * opticalDistance) / camera.projection[0];
  const apparentTop = projectDepth(camera, u, y, opticalDistance)[1] - floor;
  const observedDepth = measured ? spans[away][1] - spans[away][0] : 0;
  const estimated = !measured || observedDepth < typical.d * 0.3;
  const sizes = [typical.w, typical.d];
  const observedWidth = spans[along][1] - spans[along][0];
  sizes[along] = positive(
    measured
      ? clamp(apparentWidth, observedWidth, Math.max(observedWidth * 1.5, typical.w))
      : apparentWidth,
    typical.w
  );
  sizes[away] = positive(estimated ? typical.d : observedDepth * 1.12, typical.d);
  if (estimated) {
    face[away] += Math.sign(face[away] - eye[away]) * sizes[away] * 0.35;
  }
  if (!pointIn(face, layout.points)) return null;
  const height = measured
    ? Math.max(
        apparentTop,
        percentile(
          foreground.map((sample) => sample.height),
          0.93
        )
      )
    : apparentTop;
  const size = {
    w: sizes[0],
    d: sizes[1],
    h: positive(height > 0.12 ? height : typical.h, typical.h)
  };

  return {
    name: match.title,
    kind: match.kind,
    size,
    center: face,
    estimated,
    measured,
    score: match.score
  };
};

export type ObjectMeasurement = NonNullable<ReturnType<typeof measureObject>>;

export const measurementsMatch = (first: ObjectMeasurement, second: ObjectMeasurement) => {
  if (first.name !== second.name) return false;
  const dx = Math.abs(first.center[0] - second.center[0]);
  const dy = Math.abs(first.center[1] - second.center[1]);
  const near = Math.min(first.size.w, first.size.d, second.size.w, second.size.d);
  if (Math.hypot(dx, dy) <= clamp(near * 0.48, 0.19, 0.42)) return true;
  const a = centeredPosition(first.size, first.center, 0);
  const b = centeredPosition(second.size, second.center, 0);
  const width = Math.min(a.x + first.size.w, b.x + second.size.w) - Math.max(a.x, b.x);
  const depth = Math.min(a.y + first.size.d, b.y + second.size.d) - Math.max(a.y, b.y);
  if (width <= 0 || depth <= 0) return false;
  const intersection = width * depth;
  const union = first.size.w * first.size.d + second.size.w * second.size.d - intersection;
  return intersection / union >= 0.38;
};

export const combineMeasurements = (samples: ObjectMeasurement[]): ObjectMeasurement => {
  const preferred = samples.filter((sample) => sample.measured);
  const sized = preferred.length ? preferred : samples;
  const withDepth = sized.filter((sample) => !sample.estimated);
  const dimensions = withDepth.length ? withDepth : sized;
  return {
    ...sized[0],
    center: [0, 1].map((axis) =>
      percentile(
        sized.map(({ center }) => center[axis]),
        0.5
      )
    ),
    size: {
      w: round(
        percentile(
          dimensions.map(({ size }) => size.w),
          0.5
        )
      ),
      d: round(
        percentile(
          dimensions.map(({ size }) => size.d),
          0.5
        )
      ),
      h: round(
        percentile(
          sized.map(({ size }) => size.h),
          0.5
        )
      )
    },
    estimated: !withDepth.length
  };
};
