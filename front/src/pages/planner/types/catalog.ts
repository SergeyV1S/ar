export const CATALOG_CATEGORIES = {
  chair: "Стул",
  armchair: "Кресло",
  sofa: "Диван",
  table: "Стол",
  wardrobe: "Шкаф",
  cabinet: "Тумба",
  pouf: "Пуф"
} as const;

export type CatalogCategory = keyof typeof CATALOG_CATEGORIES;
export type CatalogCriteria = {
  category: CatalogCategory;
  quantity: number;
  maxTotal?: number;
  maxUnit?: number;
  material?: string;
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
};
export type CatalogSearch = CatalogCriteria & { city: string; replaceId?: string };

export const isCatalogCategory = (value: string): value is CatalogCategory =>
  Object.hasOwn(CATALOG_CATEGORIES, value);
