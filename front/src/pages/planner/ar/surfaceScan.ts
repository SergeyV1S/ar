import { newId } from "../../../shared/helpers/index.ts";
import {
  area,
  clamp,
  maxMeshTriangles,
  maxMeshVertices,
  meshCoordinateScale,
  segmentDistance
} from "../planning/index.ts";
import type { FurnitureMatch } from "../recognition/index.ts";
import type { Item, Point, Position, ScannedMesh } from "../types/index.ts";
import type { DepthGrid } from "./depth.ts";
import type { ScanLayout } from "./geometry.ts";
import { toPlan, toWorld } from "./geometry.ts";

type Key = number;
type Face = [Key, Key, Key];
type Label = Pick<FurnitureMatch, "kind" | "title">;
type Sample = { point: Point; observations: number; frame: number; label?: Label };
type Cluster = { samples: Sample[]; faces: Face[] };

const voxelSize = 0.055;
const rowStride = 1024;
const levelStride = rowStride * rowStride;
const maxSurfaceSamples = 18_000;
const maxSurfaceFaces = 36_000;
const floorClearance = 0.065;
const wallClearance = 0.09;

const voxelKey = ([x, y, z]: Point) =>
  Math.floor(x / voxelSize) +
  Math.floor(z / voxelSize) * rowStride +
  Math.floor(y / voxelSize) * levelStride;

const adjacentOffsets = [-2, -1, 0, 1, 2].flatMap((x) =>
  [-2, -1, 0, 1, 2].flatMap((y) =>
    [-2, -1, 0, 1, 2]
      .filter((z) => x * x + y * y + z * z > 0 && x * x + y * y + z * z <= 4)
      .map((z) => x + z * rowStride + y * levelStride)
  )
);

const clearOfStructure = (layout: ScanLayout, point: Point) => {
  const height = point[1] - layout.origin[1];
  if (height < floorClearance || height > 4) return null;
  const plan = toPlan(layout, point);
  const againstWall = layout.points.some(
    (a, index) =>
      segmentDistance(plan, a, layout.points[(index + 1) % layout.points.length]) < wallClearance
  );
  return againstWall ? null : [plan[0], height, plan[1]];
};

const nearVertex = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= 0.18;

const componentGroups = (
  samples: Map<Key, Sample>,
  faces: Map<string, Face>,
  edges: Map<Key, Set<Key>>
) => {
  const owner = new Map<Key, Cluster>();
  const groups: Cluster[] = [];
  for (const key of samples.keys()) {
    if (owner.has(key)) continue;
    const group: Cluster = { samples: [], faces: [] };
    const queue = [key];
    owner.set(key, group);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      const sample = samples.get(current);
      if (!sample) continue;
      group.samples.push(sample);
      for (const offset of adjacentOffsets) {
        const next = current + offset;
        if (owner.has(next) || !samples.has(next)) continue;
        owner.set(next, group);
        queue.push(next);
      }
      for (const next of edges.get(current) ?? []) {
        if (owner.has(next)) continue;
        owner.set(next, group);
        queue.push(next);
      }
    }
    if (group.samples.length >= 9 && group.samples.some(({ observations }) => observations >= 2)) {
      groups.push(group);
    }
  }
  for (const face of faces.values()) {
    const group = owner.get(face[0]);
    if (group && owner.get(face[1]) === group && owner.get(face[2]) === group)
      group.faces.push(face);
  }
  return groups.filter(({ faces: triangles }) => triangles.length >= 4);
};

const matchingLabel = (samples: Sample[]) => {
  const counts = new Map<string, { label: Label; count: number }>();
  for (const { label } of samples) {
    if (!label) continue;
    const entry = counts.get(label.title);
    if (entry) entry.count += 1;
    else counts.set(label.title, { label, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.label;
};

const boundsOf = (points: Point[]) =>
  [0, 1, 2].map((axis) => {
    const values = points.map((point) => point[axis]);
    return [Math.min(...values), Math.max(...values)];
  });

const meshEntry = (cluster: Cluster, samples: Map<Key, Sample>, index: number) => {
  const vertices: Point[] = [];
  const indices: number[] = [];
  const vertexIndex = new Map<Key, number>();
  const stride = Math.max(1, Math.ceil(cluster.faces.length / maxMeshTriangles));
  for (let i = 0; i < cluster.faces.length; i += stride) {
    const face = cluster.faces[i];
    const missing = face.filter((key) => !vertexIndex.has(key));
    if (vertices.length + missing.length > maxMeshVertices) continue;
    for (const key of missing) {
      const sample = samples.get(key);
      if (!sample) break;
      vertexIndex.set(key, vertices.length);
      vertices.push(sample.point);
    }
    const [a, b, c] = face.map((key) => vertexIndex.get(key));
    if (a !== undefined && b !== undefined && c !== undefined) indices.push(a, b, c);
  }
  if (!indices.length) return null;
  const [[minX, maxX], [, maxY], [minZ, maxZ]] = boundsOf(vertices);
  const x = Math.floor(minX * 100) / 100;
  const z = Math.floor(minZ * 100) / 100;
  const extent = (length: number) => Math.max(0.05, Math.ceil(length * 100) / 100);
  const w = extent(maxX - x),
    h = extent(maxY),
    d = extent(maxZ - z);
  if (w > 20 || d > 20) return null;
  const quantize = (value: number) => Math.round(clamp(value, 0, 1) * meshCoordinateScale);
  const arMesh: ScannedMesh = {
    vertices: vertices.flatMap(([px, py, pz]) => [
      quantize((px - x) / w),
      quantize(py / h),
      quantize((pz - z) / d)
    ]),
    indices
  };
  const label = matchingLabel(cluster.samples);
  const item: Item = {
    id: newId(),
    kind: label?.kind ?? "other",
    name: label?.title ?? `Объект ${index + 1}`,
    w,
    d,
    h,
    arMesh,
    owned: true,
    source: "xr",
    verified: "review",
    material: ""
  };
  const position: Position = { x, y: z, r: 0 };
  return { item, position };
};

export const createSurfaceScan = (layout: ScanLayout, capacity: number) => {
  const samples = new Map<Key, Sample>();
  const faces = new Map<string, Face>();
  const edges = new Map<Key, Set<Key>>();
  const roomArea = area(layout.points);
  let clusters: Cluster[] = [];
  let frame = 0;

  const capture = ({ width, height, points }: DepthGrid) => {
    frame += 1;
    const keys = points.map((world) => {
      if (!world) return undefined;
      const point = clearOfStructure(layout, world);
      if (!point) return undefined;
      const key = voxelKey(point);
      const previous = samples.get(key);
      if (previous) {
        if (previous.frame !== frame) {
          previous.observations += 1;
          const weight = 1 / Math.min(previous.observations, 6);
          previous.point = previous.point.map(
            (value, axis) => value + (point[axis] - value) * weight
          );
          previous.frame = frame;
        }
      } else {
        if (samples.size >= maxSurfaceSamples) return undefined;
        samples.set(key, { point, observations: 1, frame });
      }
      return key;
    });

    const addFace = (a: number, b: number, c: number) => {
      const first = keys[a],
        second = keys[b],
        third = keys[c];
      if (first === undefined || second === undefined || third === undefined) return;
      if (first === second || first === third || second === third) return;
      const p = points[a],
        q = points[b],
        r = points[c];
      if (!p || !q || !r || !nearVertex(p, q) || !nearVertex(q, r) || !nearVertex(p, r)) return;
      const face: Face = [first, second, third];
      const key = [...face].sort((x, y) => x - y).join(",");
      if (faces.has(key) || faces.size >= maxSurfaceFaces) return;
      faces.set(key, face);
      for (const vertex of face) {
        const neighbors = edges.get(vertex) ?? new Set<Key>();
        for (const other of face) {
          if (other !== vertex) neighbors.add(other);
        }
        edges.set(vertex, neighbors);
      }
    };

    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width - 1; col++) {
        const i = row * width + col;
        addFace(i, i + 1, i + width);
        addFace(i + 1, i + width + 1, i + width);
      }
    }
    return keys;
  };

  const refresh = () => {
    clusters = componentGroups(samples, faces, edges)
      .filter((cluster) => {
        const [[x1, x2], [y1, y2], [z1, z2]] = boundsOf(cluster.samples.map(({ point }) => point));
        const overheadPlane = y1 > 1.9 && y2 - y1 < 0.18 && (x2 - x1) * (z2 - z1) > roomArea * 0.2;
        return !overheadPlane;
      })
      .sort((a, b) => b.faces.length - a.faces.length)
      .slice(0, capacity);
  };

  const label = (
    keys: (Key | undefined)[],
    width: number,
    height: number,
    matches: FurnitureMatch[]
  ) => {
    for (const { box, kind, title } of matches) {
      const [x, y, w, h] = box.map((value) => value / 100);
      for (let row = 0; row < height; row++) {
        const v = (row + 0.5) / height;
        if (v < y + h * 0.16 || v > y + h * 0.84) continue;
        for (let col = 0; col < width; col++) {
          const u = (col + 0.5) / width;
          if (u < x + w * 0.16 || u > x + w * 0.84) continue;
          const key = keys[row * width + col];
          const sample = key === undefined ? undefined : samples.get(key);
          if (sample) sample.label = { kind, title };
        }
      }
    }
  };

  return {
    capture,
    refresh,
    label,
    get count() {
      return clusters.length;
    },
    highlightPoints: () =>
      clusters.flatMap(({ samples: group }) =>
        group.map(({ point: [x, y, z] }) => {
          const [wx, floor, wz] = toWorld(layout, x, z);
          return [wx, floor + y, wz];
        })
      ),
    results: () =>
      clusters
        .map((cluster, index) => meshEntry(cluster, samples, index))
        .filter((entry) => entry !== null)
  };
};
