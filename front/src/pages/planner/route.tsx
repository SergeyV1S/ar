import type { RouteObject } from "react-router";
import { useLoaderData } from "react-router";

import { PATHS } from "../../shared/constants/index.ts";
import { plannerContext } from "./context/index.ts";
import { usePlannerPage } from "./hooks/index.ts";
import { plannerLoader } from "./loader.ts";
import { PlannerPage } from "./page.tsx";

const PlannerRoute = () => {
  const model = usePlannerPage(useLoaderData<typeof plannerLoader>());
  return (
    <plannerContext.Provider value={model}>
      <PlannerPage />
    </plannerContext.Provider>
  );
};

export const plannerRoute = {
  path: PATHS.planner,
  Component: PlannerRoute,
  loader: plannerLoader
} satisfies RouteObject;
