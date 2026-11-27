import type { RouteObject } from "react-router";

import { PATHS } from "@/shared/constants/index.ts";

import { catalogLoader } from "./loader.ts";
import { CatalogPage } from "./page.tsx";

export const catalogRoute = {
  path: PATHS.catalog,
  Component: CatalogPage,
  loader: catalogLoader,
  shouldRevalidate: ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
    currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search
      ? false
      : defaultShouldRevalidate
} satisfies RouteObject;
