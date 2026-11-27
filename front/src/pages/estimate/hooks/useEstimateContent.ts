import { getPurchaseBudget, lineTotal, purchaseIssues } from "@/pages/planner/mock/index.ts";

import type { EstimateContentProps } from "../components/index.ts";

export const useEstimateContent = ({ project, items, positions, action }: EstimateContentProps) => {
  const budget = getPurchaseBudget(project.budget, items);
  const office = project.mode === "office";

  let balance = project.budget;
  const rows = items.map((item) => {
    const issues = purchaseIssues(project, item);
    if (item.price === undefined) issues.push("Цена не указана");
    if (item.kind !== "service" && !positions[item.id]) issues.push("Не размещено");
    if (lineTotal(item) > balance) issues.push("За пределами бюджета");
    balance -= lineTotal(item);
    const editItem = action ? () => action("item", item.id) : undefined;
    return {
      item,
      issues,
      editItem,
      onPlan: item.kind !== "service" && Boolean(positions[item.id])
    };
  });

  return { ...budget, office, rows };
};
