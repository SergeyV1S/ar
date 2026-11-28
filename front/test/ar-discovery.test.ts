import assert from "node:assert/strict";
import test from "node:test";

import { createArrangement } from "../src/pages/planner/ar/arrangement.ts";
import { pointVertices, projectDepthGrid } from "../src/pages/planner/ar/depth.ts";
import { furnitureMesh } from "../src/pages/planner/ar/furniture.ts";
import { getScanLayout } from "../src/pages/planner/ar/geometry.ts";
import { projectDepth } from "../src/pages/planner/ar/projection.ts";
import { createFurnitureScanner } from "../src/pages/planner/ar/scanner.ts";
import { createSurfaceScan } from "../src/pages/planner/ar/surfaceScan.ts";
import { getARLayoutUpdate } from "../src/pages/planner/helpers/index.ts";
import { initialProject, validateImport } from "../src/pages/planner/mock/index.ts";
import { localMeshPoints } from "../src/pages/planner/planning/index.ts";
import type { Point } from "../src/pages/planner/types/index.ts";

const layout = getScanLayout([
  [0, 0, 0],
  [6, 0, 0],
  [6, 0, 5],
  [0, 0, 5]
]);
assert(layout);

const camera = {
  transform: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 1.5, 4.5, 1]),
  projection: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0])
};

const grid = (pointAt: (column: number, row: number) => Point | null) => {
  const width = 6;
  const height = 5;
  return {
    width,
    height,
    points: Array.from({ length: width * height }, (_, index) =>
      pointAt(index % width, Math.floor(index / width))
    )
  };
};

const frontOfObject = (x: number) =>
  grid((column, row) =>
    row < 2 && column > 3 ? null : [x + column * 0.075, 0.14 + (4 - row) * 0.075, 2.2]
  );
const sideOfObject = (x: number) =>
  grid((column, row) => [x, 0.14 + (4 - row) * 0.075, 2.2 + column * 0.075]);

test("two measured sides produce one unlabeled 3D mesh from their observed triangles", () => {
  const scan = createSurfaceScan(layout, 60);
  scan.capture(frontOfObject(1.2));
  scan.refresh();
  assert.equal(scan.count, 0);
  scan.capture(frontOfObject(1.22));
  scan.capture(sideOfObject(1.575));
  scan.refresh();

  const [result] = scan.results();
  assert.equal(scan.count, 1);
  assert(result.item.arMesh);
  assert.equal(result.item.kind, "other");
  assert.equal(result.item.name, "Объект 1");
  assert(result.item.w >= 0.35 && result.item.w < 0.43);
  assert(result.item.d >= 0.35 && result.item.d < 0.43);
  assert(result.item.h >= 0.43 && result.item.h < 0.48);
  assert(scan.highlightPoints().length > 20);
  const points = localMeshPoints(result.item);
  assert(points.some(([, , z]) => z > 0.3));
  assert(points.every(([x, , z]) => x > 0.32 || z < 0.015));

  const model = furnitureMesh([result.item], { [result.item.id]: result.position });
  assert.equal(model.solid.length, result.item.arMesh.indices.length * 7);
});

test("multiple views of one object merge without joining two separated objects", () => {
  const scan = createSurfaceScan(layout, 60);
  for (const offset of [0, 0.03, -0.015]) {
    scan.capture(frontOfObject(1.3 + offset));
    scan.capture(frontOfObject(2.4 + offset));
  }
  scan.refresh();
  assert.equal(scan.count, 2);
});

test("structural floor and wall points do not create objects", () => {
  const scan = createSurfaceScan(layout, 60);
  const floor = grid((col, row) => [2 + col * 0.075, 0.02, 1 + row * 0.075]);
  const wall = grid((col, row) => [0.04, 0.7 + row * 0.075, 1 + col * 0.075]);
  for (const frame of [floor, wall, floor, wall]) scan.capture(frame);
  scan.refresh();
  assert.equal(scan.count, 0);
});

test("a camera label changes the name while the scanned geometry stays the same", () => {
  const scan = createSurfaceScan(layout, 60);
  const sample = frontOfObject(1.2);
  scan.capture(sample);
  const keys = scan.capture(sample);
  scan.refresh();
  const [unknown] = scan.results();
  scan.label(keys, sample.width, sample.height, [
    { box: [0, 0, 100, 100], kind: "chair", title: "Стул", score: 0.9 }
  ]);
  const [labeled] = scan.results();
  assert.equal(labeled.item.name, "Стул");
  assert.equal(labeled.item.kind, "chair");
  assert.deepEqual(labeled.item.arMesh, unknown.item.arMesh);
  assert.deepEqual(labeled.position, unknown.position);
});

test("scanning works without access to camera pixels", () => {
  const scanner = createFurnitureScanner(null, 60, false);
  // The test doubles implement only the frame and view fields used to sample depth.
  const frame = {
    getDepthInformation: () => ({
      width: 40,
      height: 40,
      getDepthInMeters: (x: number, y: number) =>
        x >= 0.35 && x <= 0.65 && y >= 0.64 && y <= 0.84 ? 2 : 0
    })
  } as unknown as XRFrame;
  const view = {
    transform: { matrix: camera.transform },
    projectionMatrix: camera.projection
  } as unknown as XRView;
  const centerFrame = {
    getDepthInformation: () => ({ getDepthInMeters: () => 2 })
  } as unknown as XRFrame;
  scanner.update(0, centerFrame, view);
  assert(scanner.available);
  assert(scanner.start(layout));
  for (const time of [0, 240, 600]) scanner.update(time, frame, view);
  assert.equal(scanner.foundCount, 1);
  assert(scanner.highlights.length > 0);
  assert(scanner.finish()[0]?.item.arMesh);
});

test("scanned geometry survives import and removal excludes the item from the saved project", () => {
  const scan = createSurfaceScan(layout, 60);
  scan.capture(frontOfObject(1.2));
  scan.capture(frontOfObject(1.2));
  scan.refresh();
  const [entry] = scan.results();
  const arrangement = createArrangement([], [], 60);
  arrangement.addDetected([entry]);
  const project = { ...initialProject(), items: [] };
  const saved = validateImport({
    ...project,
    ...getARLayoutUpdate(project, arrangement.positions(), arrangement.itemsForSave)
  });
  assert.deepEqual(saved.items[0].arMesh, entry.item.arMesh);
  arrangement.select(entry.item.id);
  arrangement.remove();
  assert.deepEqual(
    getARLayoutUpdate(project, arrangement.positions(), arrangement.itemsForSave).items,
    []
  );
  const invalid = {
    ...saved,
    items: [{ ...saved.items[0], arMesh: { vertices: [0, 0, 0], indices: [0, 1, 2] } }]
  };
  assert.equal(validateImport(invalid).items[0].arMesh, undefined);
});

test("off-center depth uses camera-plane distance and the depth grid rejects samples outside the room", () => {
  assert.deepEqual(projectDepth(camera, 0.75, 0.5, 2), [4, 1.5, 2.5]);
  const samples = new Float32Array([2, 8]);
  const projected = projectDepthGrid(layout, camera, { width: 2, height: 1, samples });
  assert.deepEqual(projected.points, [[2, 1.5, 2.5], null]);
  const points = projected.points.filter((point) => point !== null);
  assert.deepEqual(
    [...pointVertices(points, [0.25, 1, 0.5], 0.75)],
    [2, 1.5, 2.5, 0.25, 1, 0.5, 0.75]
  );
});
