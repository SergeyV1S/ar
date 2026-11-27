import type { RouteObject } from "react-router";

import { PATHS } from "@/shared/constants/index.ts";

import { EstimatePage } from "./page.tsx";

export const estimateRoute = {
  path: PATHS.estimate,
  Component: EstimatePage
} satisfies RouteObject;
