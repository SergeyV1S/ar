import type { LoaderFunctionArgs } from "react-router";

import { getCatalogCities } from "@/shared/api/requests";
import { getCatalogError } from "@/pages/planner/helpers/index.ts";
import { parseOffers } from "@/pages/planner/mock/index.ts";
import mockOffersUrl from "@/pages/planner/mock/mock-offers.json?url&no-inline";

const loadOffers = async (request: Request) => {
  try {
    const response = await fetch(mockOffersUrl, { signal: request.signal });
    if (!response.ok) throw new Error(`Источник вернул HTTP ${response.status}.`);
    const raw: unknown = await response.json();
    const url = new URL("/demo-offer.txt", request.url).href;
    const offers = parseOffers(raw).map((item) =>
      item.mode === "office" ? { ...item, url } : item
    );
    return { status: "ready", offers } as const;
  } catch (error) {
    if (request.signal.aborted) throw error;
    return { status: "error", message: getCatalogError(error) } as const;
  }
};

const loadCities = async (signal: AbortSignal) => {
  try {
    return await getCatalogCities({ config: { signal } });
  } catch (error) {
    if (signal.aborted) throw error;
    return [];
  }
};

export const catalogLoader = ({ request }: LoaderFunctionArgs) => {
  const search = new URL(request.url).searchParams;
  return {
    offers: loadOffers(request),
    cities: search.has("wish") || search.has("item") ? loadCities(request.signal) : null
  };
};
export type CatalogData = Awaited<ReturnType<typeof loadOffers>>;
