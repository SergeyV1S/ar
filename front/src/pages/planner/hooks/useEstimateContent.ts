import type { EstimateContentProps } from "../components/index.ts";
import { lineTotal, purchaseIssues, purchaseTotal } from "../mock/index.ts";

export const useEstimateContent = ({ project, items, positions }: EstimateContentProps) => {
  const total = purchaseTotal(items),
    difference = project.budget - total;
  const office = project.mode === "office";

  let balance = project.budget;
  const rows = items.map((item) => {
    const issues = purchaseIssues(project, item);
    if (item.kind !== "service" && !positions[item.id]) issues.push("Не размещено");
    if (lineTotal(item) > balance) issues.push("За пределами бюджета");
    balance -= lineTotal(item);
    return { item, issues };
  });

  return { total, difference, office, rows };
};
