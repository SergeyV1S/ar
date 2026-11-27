import { purchaseIssues, purchaseTotal } from "../mock/index.ts";
import { usePlannerContext } from "./usePlannerContext.ts";

export const useShopping = () => {
  const { project, bought: items, action } = usePlannerContext();
  const total = purchaseTotal(items);
  const difference = project.budget - total;
  const fraction = project.budget ? Math.min(total / project.budget, 1) : Number(total > 0);

  const addPurchase = () => action("add-buy");
  const openCatalog = () => action("catalog");
  const openEstimate = () => action("estimate");

  const entries = items.map((item) => {
    const editItem = () => action("item", item.id);
    return { item, editItem, issues: purchaseIssues(project, item) };
  });

  return {
    project,
    items,
    total,
    difference,
    fraction,
    entries,
    addPurchase,
    openCatalog,
    openEstimate
  };
};
