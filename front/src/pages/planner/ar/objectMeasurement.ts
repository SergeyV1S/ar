import { centeredPosition, clamp, distance, pointIn, round } from "../planning/index.ts";
import type { FurnitureMatch } from "../recognition/index.ts";
import type { Point } from "../types/index.ts";
import type { ScanLayout } from "./geometry.ts";
import { roomPoint } from "./geometry.ts";
import type { CameraPose } from "./projection.ts";
import { cameraOrigin, horizontalProjection, projectDepth, projectToFloor } from "./projection.ts";

const typicalSizes: Record<string, { w: number; d: number; h: number }> = {
  Диван: { w: 2.1, d: 0.9, h: 0.85 },
  Стул: { w: 0.48, d: 0.52, h: 0.85 },
  Кресло: { w: 0.8, d: 0.82, h: 0.9 },
  Стол: { w: 1.15, d: 0.75, h: 0.75 },
  Кровать: { w: 1.6, d: 2, h: 0.65 },
  Скамья: { w: 1.4, d: 0.52, h: 0.45 },
  Пуф: { w: 0.45, d: 0.45, h: 0.45 },
  Шкаф: { w: 1.2, d: 0.6, h: 2 },
  Тумба: { w: 0.6, d: 0.45, h: 0.65 },
  Комод: { w: 0.9, d: 0.48, h: 0.88 },
  Стеллаж: { w: 0.8, d: 0.38, h: 1.7 },
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
  if (w < 0.035 || h < 0.05) return null;
  const clippedWidth = x < 0.008 || x + w > 0.992;
  const clippedHeight = y < 0.008 || y + h > 0.992;
  const clipped = clippedWidth || clippedHeight;
  const typical = typicalSizes[match.title];
  if (!typical) return null;
  const u = x + w / 2;
  const floor = layout.origin[1];
  const samples: { point: Point; height: number; depth: number; central: boolean }[] = [];
  let outsideDepth = 0;
  let insideDepth = 0;
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
      const inside = pointIn(point, layout.points);
      const central = Math.abs(sx - u) < w * 0.26;
      if (central) {
        if (inside) insideDepth++;
        else outsideDepth++;
      }
      if (!inside || height < 0.08 || height > Math.max(1.5, typical.h * 2)) continue;
      samples.push({ point, height, depth: value, central });
    }
  }
  if (outsideDepth > insideDepth) return null;

  const central = samples.filter((sample) => sample.central);
  const near = percentile(
    (central.length >= 4 ? central : samples).map((sample) => sample.depth),
    0.28
  );
  const foreground = samples.filter(
    (sample) => sample.depth >= near - 0.22 && sample.depth <= near + typical.d * 0.75
  );
  const measured = foreground.length >= 7;
  const worldFoot = projectToFloor(camera, u, y + h, floor);
  const foot = worldFoot && roomPoint(layout, worldFoot);
  const floorContact = !clipped && foot && pointIn(foot, layout.points) ? foot : undefined;
  if (!measured && !floorContact) return null;

  const eye = roomPoint(layout, cameraOrigin(camera.transform));
  const spans = [0, 1].map((axis) => {
    const values = foreground.map(({ point }) => point[axis]);
    return [percentile(values, 0.06), percentile(values, 0.94)];
  });
  const face = measured
    ? spans.map(([low, high]) => (low + high) / 2)
    : [...(floorContact ?? [0, 0])];
  const along = Math.abs(face[0] - eye[0]) < Math.abs(face[1] - eye[1]) ? 0 : 1;
  const away = 1 - along;
  const cameraDistance = Math.hypot(face[0] - eye[0], face[1] - eye[1]);
  if (cameraDistance < 0.25 || cameraDistance > 7) return null;
  const opticalDistance = measured
    ? near
    : (worldFoot ?? []).reduce(
        (sum, coordinate, axis) =>
          sum + (camera.transform[12 + axis] - coordinate) * camera.transform[8 + axis],
        0
      );
  const apparentWidth = (2 * w * opticalDistance) / horizontalProjection(camera);
  const apparentTop = projectDepth(camera, u, y, opticalDistance)[1] - floor;
  const observedDepth = measured ? spans[away][1] - spans[away][0] : 0;
  const estimated = !measured || observedDepth < typical.d * 0.3;
  const sizes = [typical.w, typical.d];
  const observedWidth = spans[along][1] - spans[along][0];
  const width = positive(
    measured
      ? clamp(apparentWidth, observedWidth, Math.max(observedWidth * 1.5, typical.w))
      : apparentWidth,
    typical.w
  );
  sizes[along] = clippedWidth ? Math.max(typical.w, width) : width;
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
    h: positive(clippedHeight || height <= 0.12 ? Math.max(typical.h, height) : height, typical.h)
  };

  return {
    name: match.title,
    kind: match.kind,
    size,
    center: face,
    ...(floorContact && { floorContact }),
    estimated: estimated || clipped,
    measured,
    score: match.score
  };
};

export type ObjectMeasurement = NonNullable<ReturnType<typeof measureObject>>;

export const measurementsMatch = (first: ObjectMeasurement, second: ObjectMeasurement) => {
  const sameType = first.name === second.name;
  const separation = distance(first.center, second.center);
  const near = Math.min(first.size.w, first.size.d, second.size.w, second.size.d);
  if (sameType && separation <= clamp(near * 0.48, 0.19, 0.42)) return true;
  const a = centeredPosition(first.size, first.center, 0);
  const b = centeredPosition(second.size, second.center, 0);
  const width = Math.min(a.x + first.size.w, b.x + second.size.w) - Math.max(a.x, b.x);
  const depth = Math.min(a.y + first.size.d, b.y + second.size.d) - Math.max(a.y, b.y);
  if (width <= 0 || depth <= 0) return false;
  const intersection = width * depth;
  const firstArea = first.size.w * first.size.d;
  const secondArea = second.size.w * second.size.d;
  if (!sameType) {
    return (
      separation <= clamp(near * 0.35, 0.12, 0.25) &&
      intersection >= Math.max(firstArea, secondArea) * 0.45
    );
  }
  const union = firstArea + secondArea - intersection;
  // A partial view can cover much less of the floor than a full view of the same object.
  return intersection / union >= 0.38 || intersection >= Math.min(firstArea, secondArea) * 0.7;
};

export const observationsMatch = (first: ObjectMeasurement, second: ObjectMeasurement) => {
  if (measurementsMatch(first, second)) return true;
  if (first.name !== second.name || !first.floorContact || !second.floorContact) return false;

  // The bottom of the camera box can stay stable when depth alternates between surfaces.
  return (
    distance(first.floorContact, second.floorContact) <= 0.18 &&
    distance(first.center, second.center) <= 0.75
  );
};

const medianPoint = (points: Point[]) =>
  [0, 1].map((axis) => percentile(points.map((point) => point[axis]), 0.5));

export const combineMeasurements = (samples: ObjectMeasurement[]): ObjectMeasurement => {
  const preferred = samples.filter((sample) => sample.measured);
  const sized = preferred.length ? preferred : samples;
  const withDepth = sized.filter((sample) => !sample.estimated);
  const dimensions = withDepth.length ? withDepth : sized;
  const contacts = samples
    .map(({ floorContact }) => floorContact)
    .filter((point) => point !== undefined);
  return {
    ...sized[0],
    center: medianPoint(sized.map(({ center }) => center)),
    ...(contacts.length > 0 && { floorContact: medianPoint(contacts) }),
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
