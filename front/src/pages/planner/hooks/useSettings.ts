import { useState } from "react";
import type { ChangeEvent } from "react";

import { area, dimensions } from "../planning/index.ts";
import { usePlannerContext } from "./usePlannerContext.ts";

export const useSettings = () => {
  const { project, update, action } = usePlannerContext();
  const { w, d } = dimensions(project.room.points);
  const owned = project.items.filter((item) => item.owned);
  const [budgetEntry, setBudgetEntry] = useState<string | null>(null);

  const editRoom = () => action("room");
  const scanRoom = () => action("ar-scan");
  const dictate = () => action("voice");
  const changeBudget = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    const budget = Math.min(1e9, Number(raw));
    setBudgetEntry(Number(raw) > 1e9 ? String(budget) : raw);
    update({ budget });
  };
  const formatBudget = () => setBudgetEntry(null);
  const changeMaterial = (e: ChangeEvent<HTMLSelectElement>) =>
    update({ material: e.target.value });
  const changeMode = (e: ChangeEvent<HTMLSelectElement>) => update({ mode: e.target.value });
  const openProcurement = () => action("procurement");
  const addOwned = () => action("add-owned");

  const budgetValue = budgetEntry ?? project.budget.toLocaleString("ru-RU");
  const roomArea = area(project.room.points);
  const ownedRows = owned.map((item) => {
    const editItem = () => action("item", item.id);
    return { item, editItem };
  });

  return {
    project,
    w,
    d,
    ownedRows,
    budgetValue,
    roomArea,
    editRoom,
    scanRoom,
    dictate,
    changeBudget,
    formatBudget,
    changeMaterial,
    changeMode,
    openProcurement,
    addOwned
  };
};
