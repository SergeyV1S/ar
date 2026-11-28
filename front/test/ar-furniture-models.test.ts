import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createARStarterItems, createArrangement } from "../src/pages/planner/ar/arrangement.ts";
import { furnitureMesh } from "../src/pages/planner/ar/furniture.ts";
import { readFurnitureModel } from "../src/pages/planner/ar/furnitureModels/geometry.ts";
import {
  MODEL_VERTEX_SIZE,
  getFurnitureCategory
} from "../src/pages/planner/ar/furnitureModels/index.ts";
import { CATALOG_CATEGORIES } from "../src/pages/planner/types/index.ts";

test("model selection distinguishes names that share a project type", () => {
  for (const [category, name] of Object.entries(CATALOG_CATEGORIES)) {
    assert.equal(
      getFurnitureCategory({ name: `Деревянный ${name} для гостиной`, kind: "other" }),
      category
    );
  }
  assert.equal(getFurnitureCategory({ name: "Тумба под стол", kind: "cabinet" }), "cabinet");
  assert.equal(getFurnitureCategory({ name: "Модель №7", kind: "stool" }), "chair");
  assert.equal(getFurnitureCategory({ name: "Модель №8", kind: "chair" }), "armchair");
  assert.equal(getFurnitureCategory({ name: "Фонарь для шкафа", kind: "other" }), undefined);
});

test("the ten bundled models have textures and fit the normalized footprint and floor", async () => {
  for (const category of Object.keys(CATALOG_CATEGORIES)) {
    const bytes = await readFile(
      new URL(`../public/models/furniture/${category}.glb`, import.meta.url)
    );
    const { parts, textures } = await readFurnitureModel(bytes);
    assert(textures.length > 0, category);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const { vertices } of parts) {
      for (let i = 0; i < vertices.length; i += MODEL_VERTEX_SIZE) {
        for (const axis of [0, 1, 2]) {
          min[axis] = Math.min(min[axis], vertices[i + axis]);
          max[axis] = Math.max(max[axis], vertices[i + axis]);
        }
      }
    }
    assert.deepEqual(min, [0, 0, 0], category);
    assert.deepEqual(max, [1, 1, 1], category);
    if (category === "table") assert(parts.some(({ alphaMode }) => alphaMode === "BLEND"));
  }
});

test("an unknown item draws a single block at its measured dimensions", () => {
  const [starter] = createARStarterItems(1);
  const item = { ...starter, kind: "other", name: "Фонарь", w: 0.25, h: 0.5, d: 0.125 };
  const mesh = furnitureMesh([item], { [item.id]: { x: 1, y: 2, r: 90 } });
  assert.equal(mesh.models.length, 0);
  assert.equal(mesh.glass.length, 0);
  assert.equal(mesh.solid.length / 7, 36);
  const coordinates = (axis: number) => mesh.solid.filter((_, index) => index % 7 === axis);
  const ranges = [0, 1, 2].map((axis) => {
    const values = coordinates(axis);
    return [Math.min(...values), Math.max(...values)];
  });
  assert.deepEqual(ranges, [
    [1, 1.125],
    [0, 0.5],
    [2, 2.25]
  ]);
});

test("loading a model replaces placement geometry without resetting the selected rotation", () => {
  const table = createARStarterItems(3)[2];
  const model = { parts: [], images: [] };
  const loaded = new Map<string, typeof model>();
  const arrangement = createArrangement([table], (item) => loaded.get(item.id));
  arrangement.select(table.id);
  arrangement.place({ x: 1, y: 1, r: 0 });
  arrangement.select(table.id);
  arrangement.rotate(35);
  assert.equal(arrangement.preview.solid.length / 7, 36);

  loaded.set(table.id, model);
  arrangement.refreshModels();

  assert.equal(arrangement.rotation, 35);
  assert.equal(arrangement.preview.solid.length, 0);
  assert.equal(arrangement.preview.models[0]?.model, model);
  assert.deepEqual(arrangement.preview.models[0]?.size, [table.w, table.h, table.d]);
  assert.equal(arrangement.model.models[0]?.angle, (35 * Math.PI) / 180);
  assert.equal(arrangement.withoutSelection.models.length, 0);
});
