import assert from "node:assert/strict";
import test from "node:test";

import { getScanLayout } from "../src/pages/planner/ar/geometry.ts";
import { traceBase, traceHeight } from "../src/pages/planner/ar/itemTrace.ts";
import { depthGridSize, measureObject } from "../src/pages/planner/ar/objectMeasurement.ts";
import { createObjectTracks } from "../src/pages/planner/ar/objectScanner.ts";
import {
  cameraImagePoint,
  getCameraRotation,
  viewRay
} from "../src/pages/planner/ar/projection.ts";
import type { CameraPose } from "../src/pages/planner/ar/projection.ts";
import { restrictRoomFrame } from "../src/pages/planner/ar/roomImage.ts";
import {
  getItemLayoutUpdate,
  scaleRoomStroke,
  simplifyRoomStroke
} from "../src/pages/planner/helpers/index.ts";
import { centeredPosition, inspect, rect, round } from "../src/pages/planner/planning/index.ts";
import type { FurnitureMatch } from "../src/pages/planner/recognition/index.ts";
import type { Item } from "../src/pages/planner/types/index.ts";
import { exampleProject } from "./exampleProject.ts";

const room = () => {
  const layout = getScanLayout([
    [0, 0, 0],
    [5, 0, 0],
    [5, 0, 5],
    [0, 0, 5]
  ]);
  assert(layout);
  return layout;
};

const camera = (x: number, y: number, z: number, angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const transform = new Float32Array([1, 0, 0, 0, 0, cos, -sin, 0, 0, sin, cos, 0, x, y, z, 1]);
  const projection = new Float32Array(16);
  projection[0] = 1.4;
  projection[5] = 1.65;
  return { transform, projection };
};

test("camera-space depth measures a recognized chair in front of a background wall", () => {
  const pose = camera(2, 1.45, 4, 0.32);
  const depth = new Float32Array(depthGridSize ** 2);
  const u: number[] = [];
  const v: number[] = [];
  for (let i = 0; i < depth.length; i++) {
    const x = (i % depthGridSize) / (depthGridSize - 1);
    const y = Math.floor(i / depthGridSize) / (depthGridSize - 1);
    const ray = viewRay(pose, x, y);
    const front = (2.27 - 4) / ray[2];
    const surface = [2 + front * ray[0], 1.45 + front * ray[1]];
    if (surface[0] >= 1.72 && surface[0] <= 2.28 && surface[1] >= 0 && surface[1] <= 0.86) {
      depth[i] = front;
      u.push(x);
      v.push(y);
    } else {
      depth[i] = Math.min(-4 / ray[2], ray[1] < 0 ? -1.45 / ray[1] : Infinity);
    }
  }
  const minX = Math.min(...u) - 0.01;
  const minY = Math.min(...v) - 0.02;
  const result = measureObject(room(), pose, depth, {
    kind: "stool",
    title: "Стул",
    score: 0.86,
    box: [
      100 * minX,
      100 * minY,
      100 * (Math.max(...u) + 0.01 - minX),
      100 * (Math.max(...v) + 0.02 - minY)
    ]
  });
  assert(result?.measured);
  assert(Math.abs(result.center[0] - 2) < 0.08);
  assert(Math.abs(result.center[1] - 2) < 0.18);
  assert(Math.abs(result.size.w - 0.56) < 0.14);
  assert(Math.abs(result.size.h - 0.86) < 0.14);
});

test("sideways AR frames use the same rays for corrected detections and raw depth", () => {
  const pose = camera(2, 1.45, 4, 0.32);
  const { transform, projection } = pose;
  const rolled = new Float32Array([
    ...transform.slice(4, 8),
    ...transform.slice(0, 4).map((value) => -value),
    ...transform.slice(8)
  ]);
  const rotation = getCameraRotation(rolled);
  assert.equal(rotation, 270);
  const rotated: CameraPose = { transform: rolled, projection: projection.slice(), rotation };
  rotated.projection[0] = projection[5];
  rotated.projection[5] = projection[0];
  const [rawU, rawV] = cameraImagePoint(rotation, 0.3, 0.6);
  assert.deepEqual([rawU, rawV], [0.4, 0.3]);
  const expected = viewRay(pose, 0.3, 0.6);
  const actual = viewRay(rotated, 0.3, 0.6);
  assert(expected.every((value, axis) => Math.abs(value - actual[axis]) < 1e-6));
});

const cameraImage = () => ({
  width: 2,
  height: 1,
  data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
});

test("the inference frame masks camera pixels in the recess of a concave room", () => {
  const layout = getScanLayout([
    [0, 0, 0],
    [5, 0, 0],
    [5, 0, 2],
    [2, 0, 2],
    [2, 0, 5],
    [0, 0, 5]
  ]);
  assert(layout);
  const image = cameraImage();
  const depth = restrictRoomFrame(
    image,
    layout,
    { ...camera(1.8, 1.45, 4, 0), rotation: 90 },
    (u) => (u < 0.5 ? 1.25 : 1.5)
  );
  assert(depth);
  assert.deepEqual([...image.data], [255, 0, 0, 255, 114, 114, 114, 255]);
  assert.equal(depth[0], 1.25);
  assert.equal(depth.at(-1), 1.5);
});

test("without depth, only rays that reach the room contribute to the inference frame", () => {
  const image = cameraImage();
  assert(restrictRoomFrame(image, room(), camera(5.5, 1.45, 4, 0), () => null));
  assert.deepEqual([...image.data], [255, 0, 0, 255, 114, 114, 114, 255]);
  assert.equal(
    restrictRoomFrame(cameraImage(), room(), camera(2, 1.45, -1, 0), () => null),
    null
  );
});

test("a frame showing only points beyond the room is skipped even when the camera is inside", () => {
  assert.equal(restrictRoomFrame(cameraImage(), room(), camera(2, 1.45, 4, 0), () => 6), null);
});

test("an in-room floor estimate cannot override depth placing a detection beyond the wall", () => {
  const pose = camera(2, 1.45, 4, 0.32);
  const match: FurnitureMatch = {
    kind: "stool",
    title: "Стул",
    score: 0.8,
    box: [32, 30, 35, 55]
  };
  const depth = new Float32Array(depthGridSize ** 2);
  assert(measureObject(room(), pose, depth, match)?.estimated);
  assert.equal(measureObject(room(), pose, depth.fill(6), match), null);
});

test("an edge-clipped table needs depth to produce an approximate measurement", () => {
  const pose = camera(2, 1.45, 4, 0.32);
  const match: FurnitureMatch = {
    kind: "table",
    title: "Стол",
    score: 0.43,
    box: [0, 30, 42, 55]
  };
  const depth = new Float32Array(depthGridSize ** 2);
  assert.equal(measureObject(room(), pose, depth, match), null);
  const result = measureObject(room(), pose, depth.fill(1.7), match);
  assert(result?.measured);
  assert(result.estimated);
});

test("repeated measurements produce one chair while a second chair gets its own ID", () => {
  const track = createObjectTracks();
  const chair = {
    kind: "chair",
    name: "Стул",
    score: 0.8,
    measured: true,
    estimated: false,
    size: { w: 0.5, d: 0.55, h: 0.9 },
    center: [2, 2]
  };
  const other = { ...chair, center: [2.55, 2] };
  assert.deepEqual(track([chair, other]), []);
  const first = track([{ ...chair, center: [2.08, 1.93] }, other]);
  assert.equal(first.length, 2);
  assert.notEqual(first[0].id, first[1].id);
  const repeated = track([{ ...chair, center: [1.96, 2.11] }]);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].id, first[0].id);
  assert.deepEqual(repeated[0].measurement.center, [2, 2]);
});

test("three floor marks define a rotated rectangle and height works with and without depth", () => {
  const layout = room();
  const trace = traceBase(layout, [
    [1, 0, 1],
    [2, 0, 2],
    [1.5, 0, 2.5]
  ]);
  assert(trace?.valid);
  assert.deepEqual(trace.size, { w: 1.41, d: 0.71 });
  assert.equal(trace.position.r, 45);
  const pose = camera(1.5, 1.12, 4, 0);
  assert.equal(traceHeight(layout, trace.footprint, pose, null), 1.12);
  assert.equal(traceHeight(layout, trace.footprint, pose, [1.5, 0.87, 1.8]), 0.87);
  assert.equal(traceHeight(layout, trace.footprint, pose, [1.5, 1.8, 0.3]), 1.12);
});

test("a continuous room stroke simplifies and keeps a concave corner", () => {
  const stroke = [
    [0.1, 0.1],
    [0.3, 0.102],
    [0.6, 0.1],
    [0.9, 0.1],
    [0.9, 0.4],
    [0.9, 0.8],
    [0.53, 0.8],
    [0.53, 0.62],
    [0.53, 0.45],
    [0.32, 0.45],
    [0.1, 0.45],
    [0.1, 0.3],
    [0.11, 0.105]
  ];
  const points = simplifyRoomStroke(stroke);
  assert.equal(points.length, 6);
  assert.deepEqual(scaleRoomStroke(points, 4, 3), [
    [0, 0],
    [4, 0],
    [4, 3],
    [2.15, 3],
    [2.15, 1.5],
    [0, 1.5]
  ]);
  assert.equal(
    scaleRoomStroke(
      [
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0]
      ],
      4,
      3
    ),
    null
  );
});

test("collision checks use rotated footprints and resizing a measured item preserves its center", () => {
  const project = exampleProject();
  const table: Item = {
    id: "a",
    name: "Стол",
    kind: "table",
    w: 1.8,
    d: 0.25,
    h: 0.7,
    owned: true,
    source: "xr",
    verified: "review",
    material: ""
  };
  const other = { ...table, id: "b" };
  const positions = {
    a: centeredPosition(table, [2, 2], 45),
    b: centeredPosition(other, [2.4, 1.6], 45)
  };
  const result = inspect(
    { ...project.room, points: rect(5, 5), openings: [] },
    [table, other],
    positions
  );
  assert.deepEqual(result.warnings, []);
  const larger = { ...table, w: 2.2 };
  const updated = getItemLayoutUpdate(
    { ...project, items: [table, other], layouts: { [project.mode]: { 0: positions } } },
    larger,
    true
  );
  const changed = updated.layouts?.[project.mode][0].a;
  assert(changed);
  const expected = centeredPosition(larger, [2, 2], 45);
  assert.deepEqual(
    [round(changed.x), round(changed.y), changed.r],
    [round(expected.x), round(expected.y), 45]
  );
});
