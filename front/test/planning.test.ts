import assert from "node:assert/strict";
import test from "node:test";

import { analyzeAR } from "../src/pages/planner/ar/index.ts";
import { plannerLoader } from "../src/pages/planner/loader.ts";
import {
  initialProject,
  newProtection,
  parseVoice,
  positionsFor,
  procurementMissing,
  purchaseTotal,
  readEncryptedRecord,
  serializeProject,
  unlockLocal,
  validateImport,
  visibleItems
} from "../src/pages/planner/mock/index.ts";
import {
  area,
  dimensions,
  inspect,
  rect,
  validPolygon
} from "../src/pages/planner/planning/index.ts";
import type { Point } from "../src/pages/planner/types/index.ts";

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
  const door = project.room.openings.find((opening) => opening.type === "door");
  assert(door);
  door.width = 0.73;
  assert.equal(
    inspect(project.room, visibleItems(project), positionsFor(project), 0.8).state,
    "blocked"
  );
});

test("AR recovers meter dimensions and associates door, window and outlet with walls", () => {
  const angle = 0.52;
  const world = ([x, z]: Point, y = -0.8) => [
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
  assert(result);
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
  const lastItem = project.items.at(-1);
  assert(lastItem);
  lastItem.url = "javascript:alert(1)";
  assert.equal(validateImport(project).items.at(-1)?.url, "");
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
  assert(result.patch.sofa);
  assert.equal(result.patch.sofa.w, 2.2);
  assert.equal(result.patch.sofa.d, 0.95);
  assert.equal(result.patch.budget, 80000);
  assert.equal(result.patch.material, "ЛДСП");
});

test("office export requires procurement information and supplier details", () => {
  const project = initialProject();
  project.mode = "office";
  const lastItem = project.items.at(-1);
  assert(lastItem);
  project.items.push({
    ...lastItem,
    id: "supplier-offer",
    mode: "office",
    seller: "ООО Компания"
  });
  assert.equal(procurementMissing(project).length, 6);
  const supplier = project.items.at(-1);
  assert(supplier);
  supplier.details = "ИНН 0000000000";
  project.procurement = {
    purpose: "Кабинет",
    person: "Ответственный",
    article: "Мебель",
    reason: "По габаритам и цене",
    offer: "https://example.org/offer"
  };
  assert.deepEqual(procurementMissing(project), []);
});

test("the planner loader reads existing browser projects and reports damaged data", (t) => {
  const key = "metrika-project-v1";
  const property = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  t.after(() => {
    if (property) Object.defineProperty(globalThis, "localStorage", property);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });

  const project = initialProject();
  project.room.name = "Сохранённая гостиная";
  let stored = JSON.stringify(project);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (name: string) => {
        assert.equal(name, key);
        return stored;
      }
    }
  });

  const ready = plannerLoader();
  assert.equal(ready.kind, "ready");
  assert.equal(ready.project.room.name, project.room.name);

  stored = JSON.stringify({ encrypted: true, salt: "salt", iv: "iv", body: "body" });
  const locked = plannerLoader();
  assert.equal(locked.kind, "locked");
  assert.equal(locked.record.body, "body");

  stored = "false";
  const invalid = plannerLoader();
  assert.equal(invalid.kind, "unreadable");
  assert.equal(invalid.project.room.name, initialProject().room.name);
});

test("audit room keeps a passable layout and identifies the blocking table when moved", () => {
  const project = initialProject();
  const door = { id: "door", type: "door", wall: 0, offset: 0.2, width: 0.9, hinge: "start" };
  project.room = { ...project.room, points: rect(2.8, 2), openings: [door] };
  const table = { ...project.items[0], id: "table", name: "Стол", kind: "table", w: 1.2, d: 1.5 };
  project.items = [table];
  for (const variant of [0, 1, 2]) {
    const positions = positionsFor(project, variant);
    assert.deepEqual(inspect(project.room, [table], positions).warnings, []);
  }
  const blocked = inspect(project.room, [table], { table: { x: 1.05, y: 0.3, r: 0 } });
  assert.equal(blocked.state, "blocked");
  assert(
    blocked.warnings.some((warning) => warning.id === "table" && warning.message.includes("Стол"))
  );
  for (const width of [0.799, 0.8, 0.801]) {
    const room = { ...project.room, points: rect(4, 3), openings: [{ ...door, width }] };
    assert.equal(inspect(room, [], {}).state, width < 0.8 ? "blocked" : "ok");
  }
});

test("estimate quantities and services round-trip without adding plan objects", () => {
  const project = initialProject();
  const table = {
    ...project.items[0],
    id: "table",
    owned: false,
    mode: "retail",
    price: 10000,
    quantity: 2
  };
  project.items = [table, { ...table, id: "chair", quantity: 1, price: 4000 }];
  assert.equal(purchaseTotal(project.items), 24000);
  const service = { ...table, kind: "service", w: 0, d: 0, h: 0, quantity: 1 };
  project.items.push(
    { ...service, id: "delivery", price: 1500 },
    { ...service, id: "assembly", price: 2000 }
  );
  const restored = validateImport(project);
  assert.equal(purchaseTotal(restored.items), 27500);
  assert.deepEqual(Object.keys(positionsFor(restored)).sort(), ["chair", "table"]);
  assert.throws(() => validateImport({ ...project, items: [{ ...table, quantity: 0 }] }));
});

test("office backups require the original password and retain partial procurement fields", async () => {
  const project = { ...initialProject(), mode: "office", procurement: { purpose: "Архив" } };
  await assert.rejects(serializeProject(project, null));
  const password = "test-password";
  const encoded = await serializeProject(project, await newProtection(password));
  assert(!encoded.includes("Архив"));
  const record = readEncryptedRecord(JSON.parse(encoded));
  assert(record);
  await assert.rejects(unlockLocal(record, "incorrect"));
  const restored = await unlockLocal(record, password);
  assert.equal(restored.project.procurement.purpose, "Архив");
  assert(procurementMissing(restored.project).length);
});
