export const CATALOG_CATEGORIES = {
  chair: "Стул",
  armchair: "Кресло",
  sofa: "Диван",
  table: "Стол",
  wardrobe: "Шкаф",
  cabinet: "Тумба",
  pouf: "Пуф",
  bed: "Кровать",
  dresser: "Комод",
  shelving: "Стеллаж"
} as const;

export type CatalogCategory = keyof typeof CATALOG_CATEGORIES;
type SearchLimits = {
  quantity: number;
  maxTotal?: number;
  maxUnit?: number;
  material?: string;
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
};
export type CatalogCriteria = SearchLimits & { category: CatalogCategory };
export type CatalogSearch = SearchLimits & {
  category: CatalogCategory | "other";
  city: string;
  replaceId?: string;
  wishId?: string;
};

export const isCatalogCategory = (value: string): value is CatalogCategory =>
  Object.hasOwn(CATALOG_CATEGORIES, value);
