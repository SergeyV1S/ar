import { useContext } from "react";

import { plannerContext } from "../context/index.ts";

export const usePlannerContext = () => {
  const model = useContext(plannerContext);
  if (!model) throw new Error("Контекст проекта недоступен вне маршрута планировщика.");
  return model;
};
