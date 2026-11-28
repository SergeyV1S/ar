import assert from "node:assert/strict";
import test from "node:test";

import {
  createArrangement,
  createARStarterItems,
  getItemTarget
} from "../src/pages/planner/ar/arrangement.ts";
import { getScanLayout } from "../src/pages/planner/ar/geometry.ts";
import { projectToFloor } from "../src/pages/planner/ar/projection.ts";
import { createViewAnchor } from "../src/pages/planner/ar/viewAnchor.ts";
import { getARLayoutUpdate } from "../src/pages/planner/helpers/index.ts";
import { initialProject, positionsFor, validateImport } from "../src/pages/planner/mock/index.ts";
import { round } from "../src/pages/planner/planning/index.ts";

test("a rotated item is saved in normalized plan coordinates even if the scan starts elsewhere", () => {
  const angle = Math.PI / 3;
  const world = (x: number, z: number) => [
    10 + x * Math.cos(angle) - z * Math.sin(angle),
    -1.3,
    4 + x * Math.sin(angle) + z * Math.cos(angle)
  ];
  const layout = getScanLayout([world(0, 0), world(4, 0), world(4, -3), world(0, -3)]);
  assert(layout);
  const table = createARStarterItems(3)[2];
  const target = getItemTarget(layout, table, world(2, -1.5), 90);
  assert.deepEqual(target.position, { x: 1.6, y: 1, r: 90 });
  assert.equal(target.valid, true);
  assert.equal(target.modelOrigin[1], -1.3);
  assert.equal(getItemTarget(layout, table, world(0, -1.5), 90).valid, false);
});

test("an aim ray intersects the measured floor and ignores the horizon", () => {
  const pose = new Float32Array(16);
  pose[9] = 0.6;
  pose[10] = 0.8;
  pose[12] = 4;
  pose[13] = 0.8;
  const projection = new Float32Array(16);
  projection[0] = projection[5] = 1;
  const camera = { transform: pose, projection };
  assert.deepEqual(projectToFloor(camera, 0.5, 0.5, -1)?.map(round), [4, -1, -2.4]);
  pose[9] = 0;
  assert.equal(projectToFloor(camera, 0.5, 0.5, -1), null);
});

test("moving placed furniture replaces its position and undo restores it", () => {
  const [sofa] = createARStarterItems(1);
  const arrangement = createArrangement([sofa]);
  const first = { x: 1, y: 1, r: 90 };
  arrangement.select(sofa.id);
  arrangement.place(first);
  arrangement.select(sofa.id);
  assert.equal(arrangement.rotation, 90);
  arrangement.rotate(37);
  assert.equal(arrangement.positions()[sofa.id].r, 37);
  const moved = { x: 2, y: 1, r: arrangement.rotation };
  arrangement.place(moved);
  assert.deepEqual(arrangement.positions(), { [sofa.id]: moved });
  arrangement.undo();
  assert.deepEqual(arrangement.positions(), { [sofa.id]: first });
  arrangement.undo();
  assert.deepEqual(arrangement.positions(), {});
});

test("saving the AR layout persists only placed starter items and keeps their coordinates", () => {
  const project = { ...initialProject(), items: [], variant: 1 };
  const starter = createARStarterItems(3);
  const positions = { [starter[1].id]: { x: 1.4, y: 1.6, r: 37.25 } };
  const saved = validateImport({ ...project, ...getARLayoutUpdate(project, positions, starter) });
  assert.deepEqual(saved.items.map(({ id }) => id), [starter[1].id]);
  assert.deepEqual(positionsFor(saved), positions);
});

test("AR preview keeps its last anchored pose and releases the anchor when reset", async (t) => {
  const transform = Object.getOwnPropertyDescriptor(globalThis, "XRRigidTransform");
  Object.defineProperty(globalThis, "XRRigidTransform", {
    configurable: true,
    value: class {}
  });
  t.after(() => {
    if (transform) Object.defineProperty(globalThis, "XRRigidTransform", transform);
    else Reflect.deleteProperty(globalThis, "XRRigidTransform");
  });

  // The test doubles implement the WebXR fields accessed by createViewAnchor.
  const space = {} as XRReferenceSpace;
  const release = t.mock.fn();
  const anchor = { anchorSpace: space, delete: release };
  const matrix = new Float32Array(16);
  matrix[2] = 1;
  matrix[12] = 1;
  matrix[13] = -0.9;
  let tracked = true;
  // The helper reads only createAnchor and the tracked transform matrix from the frame.
  const frame = {
    createAnchor: async () => anchor,
    getPose: () => (tracked ? { transform: { matrix } } : null)
  } as unknown as XRFrame;

  const binding = createViewAnchor(space);
  const measured = { origin: [0, -1, 0], angle: 0 };
  binding.set(measured);
  assert.equal(binding.update(frame), measured);
  await Promise.resolve();
  const corrected = binding.update(frame);
  assert(corrected);
  assert.deepEqual(corrected.origin.map(round), [1, -0.9, 0]);
  assert.equal(corrected.angle, Math.PI / 2);
  tracked = false;
  assert.equal(binding.update(frame), corrected);
  binding.set();
  assert.equal(release.mock.callCount(), 1);
  assert.equal(binding.update(frame), undefined);
});
