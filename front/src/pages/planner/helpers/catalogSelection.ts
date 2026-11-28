import type { CatalogOffer } from "../../../shared/api/requests/index.ts";
import { lineTotal, planItems, visibleItems } from "../mock/project.ts";
import { arrange, inspect, variants } from "../planning/geometry.ts";
import { isCatalogCategory } from "../types/index.ts";
import type { CatalogCategory, CatalogSearch, Item, Positions, Project } from "../types/index.ts";

const catalogKinds = {
  chair: "stool",
  armchair: "chair",
  sofa: "sofa",
  table: "table",
  wardrobe: "cabinet",
  cabinet: "cabinet",
  pouf: "pouf"
} as const satisfies Record<CatalogCategory, string>;

export const CATALOG_MAX_AGE = 30 * 60 * 1000;
export const CATALOG_RESULT_LIMIT = 5;
export const PROJECT_ITEM_LIMIT = 60;

export const isLegacyRetailOffer = (item: Item) =>
  item.demo === true && item.mode === "retail" && item.seller === "Hoff" && !item.owned;

export const getReplacementCriteria = (item: Item) => {
  const category =
    item.kind === "cabinet" && /шкаф/iu.test(item.name)
      ? "wardrobe"
      : (Object.keys(catalogKinds).find(
          (key): key is CatalogCategory => isCatalogCategory(key) && catalogKinds[key] === item.kind
        ) ?? "cabinet");
  return { category, quantity: item.quantity ?? 1, maxTotal: item.cap || undefined };
};

export const getCatalogProblem = (offer: CatalogOffer, search: CatalogSearch, project: Project) => {
  const total = offer.price * search.quantity;
  const purchases = visibleItems(project).filter(
    (item) => !item.owned && item.id !== search.replaceId
  );
  const plannedQuantity = purchases
    .filter(
      (item) =>
        item.seller === "Divan.ru" && item.sku === offer.sku && item.catalogCityId === search.city
    )
    .reduce((count, item) => count + (item.quantity ?? 1), 0);
  if (offer.availability === "in-stock" && (offer.stock ?? 1) < plannedQuantity + search.quantity)
    return "Недостаточно экземпляров в наличии";
  if (
    (search.maxUnit !== undefined && offer.price > search.maxUnit) ||
    (search.maxTotal !== undefined && total > search.maxTotal)
  )
    return "Цена превышает лимит позиции";
  if (purchases.some((item) => item.price === undefined))
    return "Укажите цены уже добавленных покупок";
  if (purchases.reduce((sum, item) => sum + lineTotal(item), total) > project.budget)
    return "Сумма превышает остаток бюджета проекта";
  const material = search.material ?? project.material;
  if (material !== "Любой материал" && !offer.materials.includes(material))
    return "Не совпадает материал";
  if (
    (search.maxWidth !== undefined && offer.w > search.maxWidth) ||
    (search.maxDepth !== undefined && offer.d > search.maxDepth) ||
    (search.maxHeight !== undefined && offer.h > search.maxHeight)
  )
    return "Габариты превышают заданные";
};

export const isFreshCatalogOffer = (offer: CatalogOffer, now = Date.now()) =>
  now - Date.parse(offer.checkedAt) < CATALOG_MAX_AGE;

const findLayout = (
  project: Project,
  remaining: Item[],
  fixed: Positions,
  added: Item[],
  preferredVariant: number
) => {
  const placedItems = [...remaining, ...added];
  const order = [
    preferredVariant,
    ...variants.map((_, index) => index).filter((index) => index !== preferredVariant)
  ];
  for (const variant of order) {
    const candidate = arrange(project.room, placedItems, variant, project.passage, fixed);
    if (!inspect(project.room, placedItems, candidate, project.passage).warnings.length)
      return candidate;
  }
};

export const findCatalogPlacement = ({
  project,
  positions,
  search,
  offer,
  ids,
  cityName
}: {
  project: Project;
  positions: Positions;
  search: CatalogSearch;
  offer: CatalogOffer;
  ids: string[];
  cityName?: string;
}) => {
  const existing = project.items.filter((item) => item.id !== search.replaceId);
  if (existing.length + search.quantity > PROJECT_ITEM_LIMIT || ids.length !== search.quantity)
    return;
  if (
    search.replaceId &&
    !project.items.some((item) => item.id === search.replaceId && isLegacyRetailOffer(item))
  )
    return;
  const remaining = planItems({ items: existing, mode: project.mode });
  const added = ids.map((id): Item => ({
    id,
    name: offer.name,
    kind: catalogKinds[search.category],
    w: offer.w,
    d: offer.d,
    h: offer.h,
    quantity: 1,
    owned: false,
    source: "catalog",
    verified: "review",
    mode: "retail",
    material: offer.materials[0] ?? "Другое",
    materials: offer.materials,
    price: offer.price,
    cap: search.maxUnit ?? (search.quantity === 1 ? search.maxTotal : undefined),
    seller: "Divan.ru",
    availability: offer.availability === "in-stock" ? "В наличии" : "Под заказ",
    sku: offer.sku,
    url: offer.url,
    catalogCity: cityName,
    catalogCityId: search.city,
    catalogCheckedAt: offer.checkedAt
  }));
  const placed = remaining.filter((item) => positions[item.id]);
  const fixed = Object.fromEntries(placed.map((item) => [item.id, positions[item.id]]));
  const layout = findLayout(project, placed, fixed, added, project.variant);
  if (layout) return { layout, existing, remaining, added };
};

export const prepareCatalogPlacement = (input: Parameters<typeof findCatalogPlacement>[0]) => {
  const { project, search } = input;
  const placement = findCatalogPlacement(input);
  if (!placement) return;
  const { layout, existing, remaining, added } = placement;
  const index = project.items.findIndex((item) => item.id === search.replaceId);
  const items =
    index === -1
      ? [...existing, ...added]
      : [...existing.slice(0, index), ...added, ...existing.slice(index)];
  const otherLayouts = Object.fromEntries(
    Object.entries(project.layouts.retail ?? {})
      .filter(([key]) => Number(key) !== project.variant)
      .map(([key, previous]) => {
        const placed = remaining.filter((item) => previous[item.id]);
        const fixed = Object.fromEntries(placed.map(({ id }) => [id, previous[id]]));
        const alternative = findLayout(project, placed, fixed, added, Number(key));
        return [key, alternative ?? fixed];
      })
  );
  return {
    items,
    layouts: { ...project.layouts, retail: { ...otherLayouts, [project.variant]: layout } }
  };
};
