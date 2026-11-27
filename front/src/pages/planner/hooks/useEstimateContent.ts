import type { EstimateContentProps } from "../components/index.ts";
import { purchaseIssues, purchaseTotal } from "../data/index.ts";

export const useEstimateContent = ({ project, items, positions }: EstimateContentProps) => {
  const total = purchaseTotal(items),
    difference = project.budget - total;
  const office = project.mode === "office";

  let balance = project.budget;
  const rows = items.map((item) => {
    const issues = purchaseIssues(project, item);
    if (!positions[item.id]) issues.push("Не размещено");
    if ((item.price ?? 0) > balance) issues.push("За пределами бюджета");
    else if (!issues.length) balance -= item.price ?? 0;
    return { item, issues };
  });

  return { total, difference, office, rows };
};
