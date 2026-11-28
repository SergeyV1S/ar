import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getCatalogProblem,
  prepareCatalogPlacement
} from "../src/pages/planner/helpers/catalogSelection.ts";
import {
  initialProject,
  positionsFor,
  purchaseTotal,
  validateImport
} from "../src/pages/planner/mock/index.ts";
import { rect } from "../src/pages/planner/planning/index.ts";
import type { CatalogSearch } from "../src/pages/planner/types/index.ts";
import type { CatalogOffer } from "../src/shared/api/requests/index.ts";

const offer: CatalogOffer = {
  sku: "123",
  name: "Стул",
  price: 6000,
  availability: "in-stock",
  stock: 2,
  w: 0.45,
  d: 0.5,
  h: 0.82,
  materials: ["Массив"],
  url: "https://www.divan.ru/product/test-chair",
  checkedAt: "2026-01-01T00:00:00.000Z"
};
const search: CatalogSearch = { city: "moscow", category: "chair", quantity: 2, maxTotal: 12000 };

test("checks the total, exact-variant stock and material before placing an order", () => {
  const project = initialProject();
  assert.equal(getCatalogProblem(offer, search, project), undefined);
  assert.match(
    getCatalogProblem({ ...offer, price: 6001 }, search, project) ?? "",
    /лимит позиции/
  );
  assert.match(getCatalogProblem({ ...offer, stock: 1 }, search, project) ?? "", /Недостаточно/);
  assert.equal(
    getCatalogProblem(
      { ...offer, stock: undefined, availability: "made-to-order" },
      search,
      project
    ),
    undefined
  );
  assert.match(
    getCatalogProblem(offer, { ...search, material: "Стекло" }, project) ?? "",
    /материал/
  );
});

test("places and persists two distinct objects without moving the existing ones", () => {
  const project = initialProject();
  const positions = positionsFor(project);
  const change = prepareCatalogPlacement({
    project,
    positions,
    search,
    offer,
    ids: ["chair-a", "chair-b"],
    cityName: "Москва"
  });
  assert.ok(change);
  const saved = validateImport({ ...project, ...change });
  const nextPositions = positionsFor(saved);
  assert.deepEqual(nextPositions.sofa, positions.sofa);
  assert.deepEqual(nextPositions.chair, positions.chair);
  assert.notDeepEqual(nextPositions["chair-a"], nextPositions["chair-b"]);
  assert.equal(saved.items.at(-1)?.catalogCity, "Москва");
  assert.equal(saved.items.at(-1)?.catalogCheckedAt, offer.checkedAt);
  assert.equal(purchaseTotal(saved.items.filter((item) => !item.owned)), 12000);
});

test("requires room for both chairs, and a replacement releases the old item and budget", () => {
  const project = initialProject();
  project.room = { ...project.room, points: rect(0.7, 0.7), openings: [] };
  project.budget = 6000;
  const demo = {
    ...project.items[1],
    id: "legacy",
    name: "Демостул",
    owned: false,
    demo: true,
    mode: "retail",
    seller: "Hoff",
    price: 6000,
    w: 0.45,
    d: 0.5
  };
  project.items = [demo];
  const positions = positionsFor(project);
  const replacement = { ...search, replaceId: demo.id, quantity: 1 };
  assert.match(
    getCatalogProblem(offer, { ...search, quantity: 1 }, project) ?? "",
    /остаток бюджета/
  );
  assert.equal(getCatalogProblem(offer, replacement, project), undefined);
  const change = prepareCatalogPlacement({
    project,
    positions,
    search: replacement,
    offer,
    ids: ["new"]
  });
  assert.deepEqual(
    change?.items.map(({ id }) => id),
    ["new"]
  );
  assert.equal(
    prepareCatalogPlacement({
      project,
      positions,
      search: { ...search, replaceId: demo.id },
      offer,
      ids: ["a", "b"]
    }),
    undefined
  );
});

test("keeps new copies visible on saved alternatives without moving existing furniture", () => {
  const project = initialProject();
  const active = positionsFor(project);
  const alternate = positionsFor(project, 1);
  project.layouts = { retail: { 0: active, 1: alternate } };
  const change = prepareCatalogPlacement({
    project,
    positions: active,
    search,
    offer,
    ids: ["chair-a", "chair-b"],
    cityName: "Москва"
  });
  assert.ok(change);
  const updated = validateImport({ ...project, ...change });
  const updatedAlternate = positionsFor(updated, 1);
  assert.deepEqual(updatedAlternate.sofa, alternate.sofa);
  assert.deepEqual(updatedAlternate.chair, alternate.chair);
  assert.ok(updatedAlternate["chair-a"]);
  assert.ok(updatedAlternate["chair-b"]);
  assert.match(getCatalogProblem(offer, { ...search, quantity: 1 }, updated) ?? "", /Недостаточно/);
  assert.equal(getCatalogProblem(offer, { ...search, city: "ekaterinburg" }, updated), undefined);
});
