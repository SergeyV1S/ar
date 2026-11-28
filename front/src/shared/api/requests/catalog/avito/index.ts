import type { ApiRequest } from "@/shared/api";
import { api } from "@/shared/api/instance";
import { isRecord } from "@/shared/helpers";

type Dimensions = { w?: number; d?: number; h?: number };
type Listing = Dimensions & { url: string; name: string; price?: number };
export type AvitoOffer = Listing & { price: number; location: string };
export type AvitoListing = Listing & { condition: "used" | "new" | "unknown" };

const validSize = (value: unknown) => value === undefined ||
  (typeof value === "number" && value >= 0.05 && value <= 20);
const isListing = (value: unknown): value is Listing => isRecord(value) &&
  typeof value.url === "string" && /^https:\/\/www\.avito\.ru\/[\w%/-]+_\d{6,}$/.test(value.url) &&
  typeof value.name === "string" && value.name.length > 0 &&
  (value.price === undefined || typeof value.price === "number" && value.price > 0 && value.price <= 1e9) &&
  validSize(value.w) && validSize(value.d) && validSize(value.h);
const isOffer = (value: unknown): value is AvitoOffer =>
  isRecord(value) && typeof value.location === "string" && isListing(value) && value.price !== undefined;
const isDetail = (value: unknown): value is AvitoListing => isRecord(value) &&
  (value.condition === "new" || value.condition === "used" || value.condition === "unknown") &&
  isListing(value);

export const getAvitoOffers = async ({
  params, config
}: ApiRequest<{ q: string; city: string; category: string; maxPrice?: number }>): Promise<AvitoOffer[]> => {
  const { data } = await api.get<unknown>("/catalog/avito/offers", { ...config, params });
  if (!isRecord(data) || !Array.isArray(data.offers) || !data.offers.every(isOffer))
    throw new Error("Некорректный ответ Avito MCP");
  return data.offers;
};

export const getAvitoListing = async ({
  params, config
}: ApiRequest<{ url: string }>): Promise<AvitoListing> => {
  const { data } = await api.get<unknown>("/catalog/avito/listing", { ...config, params });
  if (!isDetail(data)) throw new Error("Некорректный ответ Avito MCP");
  return data;
};
