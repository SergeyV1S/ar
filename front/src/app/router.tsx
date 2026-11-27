import { createBrowserRouter } from "react-router";

import { catalogRoute } from "../pages/catalog/index.ts";
import { estimateRoute } from "../pages/estimate/index.ts";
import { plannerRoute, projectRoute } from "../pages/planner/index.ts";

export const router = createBrowserRouter([
  { ...projectRoute, children: [plannerRoute, catalogRoute, estimateRoute] }
]);
