import type { ApiRequest } from "@/shared/api";
import { api } from "@/shared/api/instance";
import { isRecord } from "@/shared/helpers";

import type { CatalogOffer, CatalogPage } from "../types.ts";

type Params = { city: string; category: string; cursor?: string; maxPrice?: number;
  maxWidth?: number; maxDepth?: number; maxHeight?: number; material?: string };
const isSize = (value: unknown) => typeof value === "number" && value >= 0.05 && value <= 20;

const isOffer = (offer: unknown): offer is CatalogOffer =>
  isRecord(offer) &&
  typeof offer.sku === "string" &&
  Boolean(offer.sku.trim()) &&
  typeof offer.name === "string" &&
  Boolean(offer.name.trim()) &&
  typeof offer.price === "number" &&
  offer.price > 0 &&
  offer.price <= 1e9 &&
  (offer.availability === "in-stock" || offer.availability === "made-to-order") &&
  (offer.stock === undefined ||
    (typeof offer.stock === "number" && Number.isSafeInteger(offer.stock) && offer.stock > 0)) &&
  isSize(offer.w) &&
  isSize(offer.d) &&
  isSize(offer.h) &&
  Array.isArray(offer.materials) &&
  offer.materials.every((material: unknown) => typeof material === "string") &&
  typeof offer.url === "string" &&
  /^https:\/\/www\.divan\.ru\/product\/[a-z0-9-]+$/.test(offer.url) &&
  typeof offer.checkedAt === "string" &&
  Number.isFinite(Date.parse(offer.checkedAt));

export const getCatalogOffers = async ({
  params,
  config
}: ApiRequest<Params>): Promise<CatalogPage> => {
  const { data } = await api.get<unknown>("/catalog/offers", { ...config, params });
  if (
    !isRecord(data) ||
    !Array.isArray(data.offers) ||
    !data.offers.every(isOffer) ||
    typeof data.incomplete !== "boolean" ||
    (data.nextCursor !== null &&
      (typeof data.nextCursor !== "string" || !/^\d{1,4}\.\d{1,2}$/.test(data.nextCursor)))
  )
    throw new Error("Некорректный ответ каталога");
  return { offers: data.offers, nextCursor: data.nextCursor, incomplete: data.incomplete };
};
