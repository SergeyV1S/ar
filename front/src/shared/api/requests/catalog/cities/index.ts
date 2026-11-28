import { api } from "@/shared/api/instance";
import { isRecord } from "@/shared/helpers";
import type { AxiosRequestConfig } from "axios";

import type { CatalogCity } from "../types.ts";

const isCity = (city: unknown): city is CatalogCity =>
  isRecord(city) &&
  typeof city.id === "string" &&
  /^[a-z][a-z0-9-]{1,60}$/.test(city.id) &&
  typeof city.name === "string" &&
  Boolean(city.name.trim());

export const getCatalogCities = async ({ config }: { config?: AxiosRequestConfig } = {}) => {
  const { data } = await api.get<unknown>("/catalog/cities", config);
  if (!isRecord(data) || !Array.isArray(data.cities) || !data.cities.every(isCity))
    throw new Error("Некорректный список городов");
  return data.cities;
};
