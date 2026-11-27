import assert from "node:assert/strict";
import test from "node:test";

import { analyzeAR } from "../src/ar.js";
import {
  initialProject,
  parseVoice,
  positionsFor,
  procurementMissing,
  validateImport,
  visibleItems
} from "../src/data.js";
import { area, dimensions, inspect, rect, validPolygon } from "../src/geometry.js";

test("the example has distinct valid plans and an 80 cm route", () => {
  const project = initialProject();
  const layouts = [0, 1, 2].map((index) => positionsFor(project, index));
  assert.notDeepEqual(layouts[0], layouts[1]);
  for (const positions of layouts) {
    const checks = inspect(project.room, visibleItems(project), positions, project.passage);
    assert.equal(checks.state, "ok");
    assert.deepEqual(checks.warnings, []);
  }
});

test("moving furniture into a door arc and through the wall produces warnings", () => {
  const project = initialProject();
  const items = visibleItems(project);
  const positions = { ...positionsFor(project), sofa: { x: 4.25, y: 3.0, r: 0 } };
  const { warnings } = inspect(project.room, items, positions);
  assert(warnings.some((issue) => issue.id === "sofa" && issue.message.includes("контур")));
  assert(warnings.some((issue) => issue.id === "sofa" && issue.message.includes("открыва")));
});

test("a narrow doorway cannot pass the requested minimum clearance", () => {
  const project = initialProject();
  project.room.openings.find((opening) => opening.type === "door").width = 0.73;
  assert.equal(
    inspect(project.room, visibleItems(project), positionsFor(project), 0.8).state,
    "blocked"
  );
});

test("AR recovers meter dimensions and associates door, window and outlet with walls", () => {
  const angle = 0.52;
  const world = ([x, z], y = -0.8) => [
    1 + x * Math.cos(angle) - z * Math.sin(angle),
    y,
    2 + x * Math.sin(angle) + z * Math.cos(angle)
  ];
  const corners = rect(4, 3).map((p) => world(p));
  const result = analyzeAR(corners, [
    { type: "window", points: [world([1, 0.03], 0.1), world([2.6, 0.02], 0.1)] },
    { type: "door", points: [world([3.7, 2.96]), world([2.8, 2.97])] },
    { type: "socket", points: [world([3.98, 1.2], -0.45)] },
    { type: "socket", points: [world([2, 1.5])] }
  ]);
  assert.deepEqual(dimensions(result.points), { w: 4, d: 3 });
  assert.equal(area(result.points), 12);
  assert.deepEqual(
    result.openings.map(({ type, wall, width }) => [type, wall, width]),
    [
      ["window", 0, 1.6],
      ["door", 2, 0.9],
      ["socket", 1, 0.08]
    ]
  );
  assert.equal(result.skipped, 1);
});

test("self-intersecting outlines and unsafe imported supplier URLs are handled", () => {
  assert.equal(
    validPolygon([
      [0, 0],
      [4, 2],
      [4, 0],
      [0, 3]
    ]),
    false
  );
  const project = initialProject();
  project.items.at(-1).url = "javascript:alert(1)";
  assert.equal(validateImport(project).items.at(-1).url, "");
  assert.throws(() =>
    validateImport({
      ...project,
      room: {
        ...project.room,
        points: [
          [0, 0],
          [1, 2]
        ]
      }
    })
  );
});

test("voice parser produces editable meter dimensions and a ruble budget", () => {
  const result = parseVoice(
    "Комната четыре на три, диван 220 сантиметров на 95 см, бюджет восемьдесят тысяч, материал ЛДСП",
    initialProject()
  );
  assert.deepEqual(result.patch.size, [4, 3]);
  assert.equal(result.patch.sofa.w, 2.2);
  assert.equal(result.patch.sofa.d, 0.95);
  assert.equal(result.patch.budget, 80000);
  assert.equal(result.patch.material, "ЛДСП");
});

test("office export requires procurement information and supplier details", () => {
  const project = initialProject();
  project.mode = "office";
  project.items.push({
    ...project.items.at(-1),
    id: "supplier-offer",
    mode: "office",
    seller: "ООО Компания"
  });
  assert.equal(procurementMissing(project).length, 6);
  project.items.at(-1).details = "ИНН 0000000000";
  project.procurement = {
    purpose: "Кабинет",
    person: "Ответственный",
    article: "Мебель",
    reason: "По габаритам и цене",
    offer: "https://example.org/offer"
  };
  assert.deepEqual(procurementMissing(project), []);
});
