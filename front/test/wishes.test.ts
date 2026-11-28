import assert from "node:assert/strict";
import { test } from "node:test";

import { getWishSearch, makeProjectBrief, prepareWishPurchase } from "../src/pages/planner/helpers/wishes.ts";
import { initialProject, positionsFor, validateImport } from "../src/pages/planner/mock/index.ts";

test("keeps wishlist identity, retains the owner's other furniture and exports confirmed purchases", () => {
  const project = initialProject();
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
