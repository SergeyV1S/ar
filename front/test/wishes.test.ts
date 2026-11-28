import { exampleProject } from "./exampleProject.ts";
import { getDimensionOverages, getLayoutIdeasUpdate } from "../src/pages/planner/helpers/index.ts";

test("allows an explicit size exception while preserving the purchase dimensions", () => {
  const project = exampleProject();
  const item = { ...project.items[0], id: "wide", owned: false, mode: project.mode, w: 0.52, d: 0.44 };
  const search = { category: "table" as const, quantity: 1, maxWidth: 0.5, city: "moscow" };
  assert.deepEqual(getDimensionOverages(item, search), ["Ширина 52 см при лимите 50 см."]);
  assert.equal(prepareWishPurchase(project, positionsFor(project), search, [item], true)?.items.at(-1)?.w, 0.52);
});

test("can keep an explicitly accepted purchase unplaced", () => {
  const project = exampleProject();
  const positions = positionsFor(project);
  const item = { ...project.items[0], id: "oversize", w: 12, owned: false, mode: project.mode };
  const search = { category: "table" as const, quantity: 1, city: "moscow" };
  assert.equal(prepareWishPurchase(project, positions, search, [item]), undefined);
  const accepted = prepareWishPurchase(project, positions, search, [item], true);
  assert(accepted?.requiresManualPlacement);
  assert.deepEqual(accepted.layouts[project.mode][project.variant], positions);
  assert.equal(accepted.items.at(-1)?.w, 12);
});

test("keeps the current plan while accepting a distinct verified AI option", () => {
  const project = initialProject();
  const item = { ...exampleProject().items[1], id: "chair" };
  const current = { chair: { x: 0.1, y: 0.1, r: 0 } };
  const model = { id: "chair", x: 2.2, y: 2.4, r: 37 };
  const ideas = getLayoutIdeasUpdate(project, [item], current, [
    { title: "Сохранённое положение", reason: "", positions: [{ id: "chair", ...current.chair }] },
    { title: "Кресло справа", reason: "", positions: [model] },
    { title: "Такое же положение", reason: "", positions: [model] }
  ]);
  assert(ideas);
  assert.deepEqual(ideas.layouts.retail[project.variant], current);
  assert.deepEqual(ideas.layouts.retail[1].chair, { x: 2.2, y: 2.4, r: 37 });
  assert.equal(ideas.layoutIdeas.retail[1].title, "Кресло справа");
  assert.equal(ideas.layouts.retail[2], undefined);
});
import { getPurchaseBudget, initialProject } from "../src/pages/planner/mock/index.ts";

test("starts without a purchase budget and ignores the former default in legacy projects", () => {
  const project = initialProject();
  assert.equal(project.budget, undefined);
  assert.equal(getPurchaseBudget(project.budget, []).difference, undefined);
  assert.equal(validateImport({ ...project, budget: 80000 }).budget, undefined);
  assert.equal(validateImport({ ...project, budget: 80000, budgetConfirmed: true }).budget, 80000);
});
import assert from "node:assert/strict";
import { test } from "node:test";

import { getWishSearch, makeProjectBrief, prepareWishPurchase } from "../src/pages/planner/helpers/wishes.ts";
import { positionsFor, validateImport } from "../src/pages/planner/mock/index.ts";

test("keeps wishlist identity, retains the owner's other furniture and exports confirmed purchases", () => {
  const project = exampleProject();
  const analysis = { summary: "Заменить диван и подобрать два стула", wishes: [
    { name: "Новый диван", query: "диван", category: "sofa" as const, quantity: 1, replaceId: "sofa" },
    { name: "Стул", query: "стул", category: "chair" as const, quantity: 2, maxTotal: 20000 }
  ] };
  const positions = positionsFor(project);
  const brief = makeProjectBrief(undefined, "Замени диван", analysis);
  const [wish, chairWish] = brief.wishes;
  const replacement = { ...project.items[0], id: "new-sofa", wishId: wish.id,
    owned: false, mode: "retail", seller: "Divan.ru", price: 25000 };
  const search = getWishSearch(wish, project, "moscow");
  assert(project.items.some(({ id }) => id === "sofa"));
  const prepared = prepareWishPurchase(project, positions, search, [replacement]);
  assert(prepared);
  assert(!prepared.items.some(({ id }) => id === "sofa"));
  assert.deepEqual(prepared.layouts.retail[0].chair, positions.chair);
  const oneChair = { ...project.items[1], id: "used-chair", wishId: chairWish.id,
    owned: false, mode: "retail", seller: "Avito", price: 4500 };
  const imported = validateImport({ ...project, ...prepared, brief, items: [...prepared.items, oneChair] });
  const pending = getWishSearch(chairWish, imported, "moscow");
  assert.equal(pending.quantity, 1);
  assert.equal(pending.maxTotal, 15500);
  assert.equal(imported.items.find(({ id }) => id === "used-chair")?.wishId, chairWish.id);
  assert.equal(makeProjectBrief(brief, "Замени диван", analysis).wishes[0].id, wish.id);
});
