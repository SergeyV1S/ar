export type CatalogCity = { id: string; name: string };
export type CatalogOffer = {
  sku: string;
  name: string;
  price: number;
  availability: "in-stock" | "made-to-order";
  stock?: number;
  w: number;
  d: number;
  h: number;
  materials: string[];
  url: string;
  photo?: string;
  checkedAt: string;
};
export type CatalogPage = {
  offers: CatalogOffer[];
  nextCursor: string | null;
  incomplete: boolean;
};
