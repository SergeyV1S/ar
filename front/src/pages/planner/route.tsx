import type { RouteObject } from "react-router";
import { useLoaderData } from "react-router";

import { PATHS } from "../../shared/constants/index.ts";
import { plannerContext } from "./context/index.ts";
import { usePlannerPage } from "./hooks/index.ts";
import { PlannerLayout } from "./layout.tsx";
import { plannerLoader } from "./loader.ts";
import { PlannerPage } from "./page.tsx";

const ProjectRoute = () => {
  const model = usePlannerPage(useLoaderData<typeof plannerLoader>());
  return (
    <plannerContext.Provider value={model}>
      <PlannerLayout />
    </plannerContext.Provider>
  );
};

const ProjectLoading = () => (
  <main className='shell py-8' role='status'>
    <p>Загружаем проект…</p>
    <div className='rounded-xl bg-purple-soft h-72 mt-4' aria-hidden='true' />
  </main>
);

export const projectRoute = {
  path: PATHS.planner,
  Component: ProjectRoute,
  HydrateFallback: ProjectLoading,
  loader: plannerLoader,
  shouldRevalidate: () => false
} satisfies RouteObject;

export const plannerRoute = { index: true, Component: PlannerPage } satisfies RouteObject;
