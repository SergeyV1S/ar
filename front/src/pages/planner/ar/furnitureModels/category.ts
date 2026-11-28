import { isCatalogCategory } from "../../types/index.ts";
import type { CatalogCategory, Item } from "../../types/index.ts";

const categoryNames: Record<CatalogCategory, RegExp> = {
  sofa: /(?:^|[^а-яё])диван[а-яё]*/iu,
  armchair: /(?:^|[^а-яё])кресл[а-яё]*/iu,
  chair: /(?:^|[^а-яё])(?:стул|табурет)[а-яё]*/iu,
  table: /(?:^|[^а-яё])стол(?:ик)?(?:а|у|ом|е|ы|и|ов|ам|ами|ах)?(?![а-яё])/iu,
  wardrobe: /(?:^|[^а-яё])(?:шкаф|гардероб)[а-яё]*/iu,
  cabinet: /(?:^|[^а-яё])тумб[а-яё]*/iu,
  pouf: /(?:^|[^а-яё])пуф[а-яё]*/iu,
  bed: /(?:^|[^а-яё])кроват[а-яё]*/iu,
  dresser: /(?:^|[^а-яё])комод[а-яё]*/iu,
  shelving: /(?:^|[^а-яё])стеллаж[а-яё]*/iu
};

const categories = Object.entries(categoryNames).filter(
  (entry): entry is [CatalogCategory, RegExp] => isCatalogCategory(entry[0])
);

export const getFurnitureCategory = ({ kind, name }: Pick<Item, "kind" | "name">) => {
  const subject = name.split(/\s+(?:для|под|с|со|к)\s+/iu)[0];
  const matches = categories
    .map(([category, pattern]) => ({ category, index: subject.search(pattern) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index);
  if (matches[0]) return matches[0].category;
  if (kind === "stool") return "chair";
  if (kind === "chair") return "armchair";
  return isCatalogCategory(kind) ? kind : undefined;
};
