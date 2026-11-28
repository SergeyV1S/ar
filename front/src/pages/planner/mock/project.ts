import { centimeters, safeUrl } from "../../../shared/helpers/index.ts";
import { arrange, dimensions, rect, round } from "../planning/index.ts";
import type { Item, Project, Room } from "../types/index.ts";
import { materials, procurementFields } from "./catalog.ts";

export const legacyStarterItems = (): Item[] => [
  {
    id: "sofa", name: "Диван", kind: "sofa", w: 2.2, d: 0.9, h: 0.83,
    material: "Ткань", owned: true, source: "manual", verified: "review"
  },
  {
    id: "chair", name: "Кресло", kind: "chair", w: 0.76, d: 0.78, h: 0.81,
    material: "Ткань", owned: true, source: "manual", verified: "review"
  }
];

export const initialProject = (): Project => {
  return {
    version: 1,
    room: {
      name: "Комната",
      points: rect(5.2, 3.8),
      source: "draft",
      verified: "review",
      openings: []
    },
    material: materials[0],
    mode: "retail",
    passage: 0.8,
    variant: 0,
    items: [],
    layouts: {},
    procurement: {}
  };
};

export const visibleItems = (project: Pick<Project, "items" | "mode">) =>
  project.items.filter((item) => item.owned || item.mode === project.mode);
export const planItems = (project: Pick<Project, "items" | "mode">) =>
  visibleItems(project).filter((item) => item.kind !== "service");
export const lineTotal = (item: Item) => (item.price ?? 0) * (item.quantity ?? 1);
export const positionsFor = (
  project: Pick<Project, "items" | "mode" | "room" | "layouts" | "variant" | "passage">,
  variant = project.variant
) =>
  project.layouts[project.mode]?.[variant] ??
  arrange(project.room, planItems(project), variant, project.passage);
export const itemSize = (item: Pick<Item, "w" | "d">) =>
  `${centimeters(item.w)} × ${centimeters(item.d)} см`;
export const purchaseIssues = (project: Project, item: Item) => {
  const problems = [];
  if ((item.cap ?? 0) > 0 && lineTotal(item) > (item.cap ?? 0))
    problems.push("Выше лимита позиции");
  if (
    item.kind !== "service" &&
    project.material !== materials[0] &&
    !(item.materials ?? [item.material]).includes(project.material)
  )
    problems.push("Другой материал");
  return problems;
};

export const procurementMissing = (project: Project) => {
  const projectFields = Object.entries(procurementFields)
    .filter(
      ([key]) =>
        !String(project.procurement[key] ?? "").trim() ||
        (key === "offer" && !safeUrl(project.procurement[key]))
    )
    .map(([, label]) => label);
  const supplierFields = visibleItems(project)
    .filter((item) => !item.owned && (!item.seller || !item.details))
    .map((item) => `${item.name} — поставщик и реквизиты`);
  return [...projectFields, ...supplierFields];
};
export const resizeRoom = (room: Room, width: number, depth: number) => {
  const old = dimensions(room.points);
  const points = room.points.map(([x, y]) => [
    round((x * width) / old.w),
    round((y * depth) / old.d)
  ]);
  return { ...room, points };
};

export const purchaseTotal = (items: Item[]) =>
  items.reduce((sum, item) => sum + lineTotal(item), 0);

export const getPurchaseBudget = (budget: number | undefined, items: Item[]) => {
  const total = purchaseTotal(items);
  return {
    total,
    difference: budget === undefined ? undefined : budget - total,
    hasUnknownPrices: items.some((item) => item.price === undefined)
  };
};
