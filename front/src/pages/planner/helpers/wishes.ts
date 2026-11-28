import { newId } from "../../../shared/helpers/index.ts";
import type { PlanAnalysis } from "../../../shared/helpers/index.ts";
import { lineTotal, planItems, visibleItems } from "../mock/index.ts";
import { arrange, inspect, variants } from "../planning/index.ts";
import type { CatalogSearch, Item, Positions, Project, ProjectWish } from "../types/index.ts";
import { CATALOG_CATEGORIES, isCatalogCategory } from "../types/index.ts";
import { getReplacementCriteria, PROJECT_ITEM_LIMIT } from "./catalogSelection.ts";

export const makeProjectBrief = (previous: Project["brief"], phrase: string, analysis: PlanAnalysis) => {
  const reused = new Set<string>();
  const wishes = analysis.wishes.map((wish): ProjectWish => {
    const match = previous?.wishes.find((old) =>
      !reused.has(old.id) && old.category === wish.category &&
      (wish.replaceId ? old.replaceId === wish.replaceId : old.name.toLowerCase() === wish.name.toLowerCase()));
    const id = match?.id ?? newId();
    reused.add(id);
    return { ...wish, id };
  });
  return { phrase, summary: analysis.summary, wishes, layout: analysis.layout };
};

export const wishForItem = (item: Item): ProjectWish => {
  const criteria = getReplacementCriteria(item);
  return {
    ...criteria,
    id: `replace-${item.id}`,
    replaceId: item.id,
    name: item.name,
    query: isCatalogCategory(criteria.category) ? CATALOG_CATEGORIES[criteria.category] : item.name
  };
};

export const getWishPath = (path: string, wish: string) =>
  `${path}?${new URLSearchParams({ wish })}`;

export const getWishPurchases = (project: Project, wish: ProjectWish) =>
  project.items.filter((item) => item.wishId === wish.id && !item.owned);

export const getWishSearch = (wish: ProjectWish, project: Project, city: string): CatalogSearch => {
  const purchases = getWishPurchases(project, wish);
  const total = purchases.reduce((sum, item) => sum + lineTotal(item), 0);
  const replaceId = project.items.find((item) => item.id === wish.replaceId)?.id;
  return { ...wish, city, wishId: wish.id, replaceId, quantity: Math.max(0, wish.quantity - purchases.length),
    maxTotal: wish.maxTotal === undefined ? undefined : Math.max(0, wish.maxTotal - total) };
};

export const getWishPurchaseLimit = (project: Project, search: CatalogSearch, quantity = 1) => {
  const spent = visibleItems(project).filter((item) => !item.owned && item.id !== search.replaceId)
    .reduce((sum, item) => sum + lineTotal(item), 0);
  const remaining = project.budget === undefined ? Infinity : project.budget - spent;
  const limit = Math.min(remaining / quantity, (search.maxTotal ?? Infinity) / quantity, search.maxUnit ?? Infinity);
  return Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : undefined;
};

export const prepareWishPurchase = (
  project: Project, positions: Positions, search: CatalogSearch, purchases: Item[]
) => {
  const remaining = project.items.filter((item) => item.id !== search.replaceId);
  if (!purchases.length || remaining.length + purchases.length > PROJECT_ITEM_LIMIT ||
    (search.replaceId && remaining.length === project.items.length)) return;
  const items = [...remaining, ...purchases];
  const visible = planItems({ items, mode: project.mode });
  const fixed = Object.fromEntries(remaining.flatMap(({ id }) => positions[id] ? [[id, positions[id]]] : []));
  const alreadyPlaced = visible.filter(({ id }) => fixed[id] || purchases.some((item) => item.id === id));
  const preserved = arrange(project.room, alreadyPlaced, project.variant, project.passage, fixed);
  const ordered = [project.variant, ...variants.flatMap((_, index) => index === project.variant ? [] : [index])];
  const valid = (layout: Positions, items: Item[]) => !inspect(project.room, items, layout, project.passage).warnings.length;
  const alternatives = ordered.map((index) => {
    const previous = project.layouts[project.mode]?.[index] ?? {};
    const originals = Object.fromEntries(remaining.flatMap(({ id }) => previous[id] ? [[id, previous[id]]] : []));
    const withOriginals = arrange(project.room, visible, index, project.passage, originals);
    const freestyle = valid(withOriginals, visible)
      ? withOriginals
      : arrange(project.room, visible, index, project.passage);
    return [index, freestyle] as const;
  });
  const stays = valid(preserved, alreadyPlaced);
  const canPlace = stays || alternatives.some(([, plan]) => valid(plan, visible));
  if (!canPlace) return;
  const activeLayout = stays ? preserved : fixed;
  const otherLayouts = Object.fromEntries(Object.entries(project.layouts).map(([mode, layouts]) => [
    mode, Object.fromEntries(Object.entries(layouts).map(([index, layout]) => [
      index, Object.fromEntries(Object.entries(layout).filter(([id]) => id !== search.replaceId))
    ]))
  ]));
  const layouts: Project["layouts"] = { ...otherLayouts, [project.mode]: {
    ...Object.fromEntries(alternatives), [project.variant]: activeLayout
  } };
  return { items, layouts, needsLayout: !stays };
};

