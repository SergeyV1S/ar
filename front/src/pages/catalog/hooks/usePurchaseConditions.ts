import { useState } from "react";
import type { ChangeEvent } from "react";

import { usePlannerContext } from "@/pages/planner/hooks/index.ts";

export const usePurchaseConditions = () => {
  const { project, update } = usePlannerContext();
  const [budgetEntry, setBudgetEntry] = useState<string | null>(null);

  const changeBudget = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, "").slice(0, 10);
    const budget = Math.min(1e9, Number(raw));
    setBudgetEntry(Number(raw) > 1e9 ? String(budget) : raw);
    update({ budget });
  };
  const formatBudget = () => setBudgetEntry(null);
  const changeMaterial = (event: ChangeEvent<HTMLSelectElement>) =>
    update({ material: event.target.value });
  const changeMode = (event: ChangeEvent<HTMLSelectElement>) =>
    update({ mode: event.target.value });

  const budgetValue = budgetEntry ?? project.budget.toLocaleString("ru-RU");
  return { project, budgetValue, changeBudget, formatBudget, changeMaterial, changeMode };
};
