import { useLoaderData, useSearchParams } from "react-router";

import { wishForItem } from "@/pages/planner/helpers";
import { usePlannerContext } from "@/pages/planner/hooks/index.ts";
import { getPurchaseBudget } from "@/pages/planner/mock/index.ts";

import type { catalogLoader } from "../loader.ts";

export const useCatalogPage = () => {
  const data = useLoaderData<typeof catalogLoader>();
  const { project, allItems, selected, bought, action } = usePlannerContext();
  const [search] = useSearchParams();
  const selectedItem = allItems.find((item) => item.id === selected);
  const savedWish = project.brief?.wishes.find(({ id }) => id === search.get("wish"));
  const wish = savedWish ?? (selectedItem && project.mode !== "office" ? wishForItem(selectedItem) : undefined);
  const { difference, hasUnknownPrices } = getPurchaseBudget(project.budget, bought);

  const addManually = () => action("add-buy");

  return { data, selectedItem, wish, difference, hasUnknownPrices, addManually };
};
