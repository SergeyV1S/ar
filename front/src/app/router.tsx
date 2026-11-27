import { Outlet, createBrowserRouter } from "react-router";

import { plannerRoute } from "../pages/planner/index.ts";

export const router = createBrowserRouter([{ Component: Outlet, children: [plannerRoute] }]);
