import type { LoaderFunctionArgs } from "react-router";

import { getCatalogCities } from "@/shared/api/requests";
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
    cities: search.has("wish") || search.has("item") ? loadCities(request.signal) : null
  };
};
