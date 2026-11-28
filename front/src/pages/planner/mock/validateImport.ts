import { catalogPhotoUrl, isFurnitureWish, isLayoutAdvice, isRecord, newId, safeUrl } from "../../../shared/helpers/index.ts";
import { isRoomPhoto } from "../helpers/roomPhoto.ts";
import { dimensions, maxOutlinePoints, normalize, validPolygon } from "../planning/index.ts";
import type { Item, Project, ProjectWish } from "../types/index.ts";
import { materials, modes, procurementFields, sourceLabel, types } from "./catalog.ts";

const record = (value: unknown) => (isRecord(value) ? value : {});
const numeric = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const hasLabel = (labels: Record<string, string>, value: unknown): value is string =>
  typeof value === "string" && Object.hasOwn(labels, value);
const isPoint = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === 2 && value.every((v: unknown) => numeric(v, -35, 35));
type ImportItem = Record<string, unknown> & Pick<Item, "id" | "name" | "kind" | "w" | "d" | "h">;
const isImportItem = (item: unknown): item is ImportItem =>
  isRecord(item) &&
  typeof item.id === "string" &&
  typeof item.name === "string" &&
  ((item.kind === "service" &&
    item.owned === false &&
    item.w === 0 &&
    item.d === 0 &&
    item.h === 0) ||
    (hasLabel(types, item.kind) &&
      numeric(item.w, 0.05, 20) &&
      numeric(item.d, 0.05, 20) &&
      numeric(item.h, 0.05, 20))) &&
  (item.quantity === undefined ||
    (Number.isSafeInteger(item.quantity) && numeric(item.quantity, 1, Number.MAX_SAFE_INTEGER))) &&
  (item.owned === true ||
    (hasLabel(modes, item.mode) && (item.price === undefined || numeric(item.price, 0, 1e9))));

const normalizeItem = (item: ImportItem): Item => ({
  id: item.id,
  name: item.name.trim().slice(0, 100) || "Мебель",
  kind: item.kind,
  owned: item.owned === true,
  mode: typeof item.mode === "string" ? item.mode : undefined,
  w: item.w,
  d: item.d,
  h: item.h,
  quantity: typeof item.quantity === "number" ? item.quantity : 1,
  demo: item.demo === true,
  wishId: typeof item.wishId === "string" && item.wishId.length <= 150 ? item.wishId : undefined,
  catalogCity: typeof item.catalogCity === "string" ? item.catalogCity.slice(0, 100) : undefined,
  catalogCityId: typeof item.catalogCityId === "string" &&
    /^[a-z][a-z0-9-]{1,60}$/.test(item.catalogCityId) ? item.catalogCityId : undefined,
  catalogCheckedAt: typeof item.catalogCheckedAt === "string" &&
    Number.isFinite(Date.parse(item.catalogCheckedAt)) ? item.catalogCheckedAt : undefined,
  offerReason: String(item.offerReason ?? "").slice(0, 1500),
  price: numeric(item.price, 0, 1e9) ? item.price : undefined,
  cap: numeric(item.cap, 0, 1e9) ? item.cap : 0,
  access: numeric(item.access, 0, 4) ? item.access : 0,
  url: safeUrl(item.url),
  material:
    typeof item.material === "string" && materials.includes(item.material)
      ? item.material
      : "Другое",
  seller: String(item.seller ?? "").slice(0, 120),
  sku: String(item.sku ?? "").slice(0, 120),
  details: String(item.details ?? "").slice(0, 500),
  materials: Array.isArray(item.materials)
    ? item.materials.filter(
        (value: unknown): value is string => typeof value === "string" && materials.includes(value)
      )
    : undefined,
  availability: String(item.availability ?? "").slice(0, 200),
  source: hasLabel(sourceLabel, item.source) ? item.source : "import",
  verified: item.verified === "checked" ? "checked" : "review",
  illustration:
    typeof item.illustration === "string" &&
    ["table", "cabinet", "pouf"].includes(item.illustration)
      ? item.illustration
      : undefined,
  photo:
    typeof item.photo === "string" &&
    /^data:image\/(png|jpeg|webp);base64,/i.test(item.photo) &&
    item.photo.length <= 260000
      ? item.photo
      : catalogPhotoUrl(item.photo)
});

const readBrief = (input: unknown) => {
  const brief = record(input);
  if (typeof brief.phrase !== "string" || typeof brief.summary !== "string" || !Array.isArray(brief.wishes))
    return;
  const wishes = brief.wishes.slice(0, 10).filter((raw: unknown): raw is ProjectWish =>
    isRecord(raw) && typeof raw.id === "string" && raw.id.length > 0 && raw.id.length <= 150 &&
    isFurnitureWish(raw));
  if (new Set(wishes.map((wish) => wish.id)).size !== wishes.length) return;
  return { phrase: brief.phrase.slice(0, 4000), summary: brief.summary.slice(0, 600), wishes,
    layout: isLayoutAdvice(brief.layout) ? brief.layout : undefined };
};

export const validateImport = (input: unknown): Project => {
  const raw = record(input);
  const room = record(raw.room);
  const items: unknown[] = Array.isArray(raw.items) ? raw.items : [];
  const rawPoints: unknown[] = Array.isArray(room.points) ? room.points : [];
  if (
    raw.version !== 1 ||
    typeof room.name !== "string" ||
    !Array.isArray(room.points) ||
    rawPoints.length > maxOutlinePoints ||
    !rawPoints.every(isPoint) ||
    !validPolygon(rawPoints) ||
    !Array.isArray(raw.items) ||
    items.length > 60 ||
    !items.every(isImportItem)
  )
    throw new Error("Это не похоже на файл проекта Метрики.");
  const points = normalize(rawPoints),
    extent = dimensions(points);
  if (
    extent.w > 35 ||
    extent.d > 35 ||
    !validPolygon(points) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new Error("Это не похоже на файл проекта Метрики.");
  const layouts = Object.fromEntries(
    Object.keys(modes).map((mode) => [
      mode,
      Object.fromEntries(
        [0, 1, 2].flatMap((index) => {
          const layout = record(record(raw.layouts)[mode])[index];
          if (!isRecord(layout)) return [];
          return [
            [
              index,
              Object.fromEntries(
                items.flatMap(({ id }) => {
                  const position = record(layout[id]);
                  return numeric(position.x, -35, 35) &&
                    numeric(position.y, -35, 35) &&
                    numeric(position.r, 0, 360)
                    ? [[id, { x: position.x, y: position.y, r: position.r }]]
                    : [];
                })
              )
            ]
          ];
        })
      )
    ])
  );
  const openings: unknown[] = Array.isArray(room.openings) ? room.openings : [];
  const layoutIdeas = Object.fromEntries(Object.keys(modes).map((mode) => [
    mode,
    Object.fromEntries([0, 1, 2].flatMap((index) => {
      const entry = record(record(record(raw.layoutIdeas)[mode])[index]);
      if (!layouts[mode]?.[index] || typeof entry.title !== "string" || !entry.title.trim() ||
        typeof entry.reason !== "string") return [];
      return [[index, { title: entry.title.slice(0, 65), reason: entry.reason.slice(0, 220) }]];
    }))
  ]));
  return {
    version: 1,
    brief: readBrief(raw.brief),
    room: {
      name: room.name.trim().slice(0, 80) || "Комната",
      points,
      photo: isRoomPhoto(room.photo) ? room.photo : undefined,
      source: hasLabel(sourceLabel, room.source) ? room.source : "import",
      verified: room.verified === "checked" ? "checked" : "review",
      openings: openings
        .filter(
          (
            o
          ): o is Record<string, unknown> & {
            type: string;
            wall: number;
            offset: number;
            width: number;
          } =>
            isRecord(o) &&
            typeof o.type === "string" &&
            ["door", "window", "socket"].includes(o.type) &&
            Number.isInteger(o.wall) &&
            numeric(o.wall, 0, points.length - 1) &&
            numeric(o.offset, 0, 35) &&
            numeric(o.width, 0.01, 35)
        )
        .slice(0, 40)
        .map((o) => ({
          id: newId(),
          wall: o.wall,
          offset: o.offset,
          width: o.width,
          type: o.type,
          hinge: o.hinge === "end" ? "end" : "start"
        }))
    },
    catalogCity: typeof raw.catalogCity === "string" &&
      /^[a-z][a-z0-9-]{1,60}$/.test(raw.catalogCity) ? raw.catalogCity : undefined,
    budget: numeric(raw.budget, 0, 1e9) && (raw.budget !== 80000 || raw.budgetConfirmed === true)
      ? raw.budget : undefined,
    budgetConfirmed: raw.budgetConfirmed === true,
    passage: numeric(raw.passage, 0.45, 2) ? raw.passage : 0.8,
    material:
      typeof raw.material === "string" && materials.includes(raw.material)
        ? raw.material
        : materials[0],
    mode: hasLabel(modes, raw.mode) ? raw.mode : "retail",
    variant: typeof raw.variant === "number" && [0, 1, 2].includes(raw.variant) ? raw.variant : 0,
    items: items.map(normalizeItem),
    layouts,
    layoutIdeas,
    procurement: Object.fromEntries(
      Object.keys(procurementFields).map((key) => [
        key,
        String(record(raw.procurement)[key] ?? "").slice(0, 1500)
      ])
    )
  };
};
