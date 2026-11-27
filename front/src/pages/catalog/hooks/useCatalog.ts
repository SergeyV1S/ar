import type { ChangeEvent } from "react";
import { useState } from "react";
import { useLoaderData, useRevalidator, useSearchParams } from "react-router";

import { usePlannerContext } from "@/pages/planner/hooks/index.ts";
import {
  getPurchaseBudget,
  lineTotal,
  purchaseIssues,
  purchaseTotal
} from "@/pages/planner/mock/index.ts";
import { arrange, inspect, variants } from "@/pages/planner/planning/index.ts";
import type { Item } from "@/pages/planner/types/index.ts";

import type { catalogLoader } from "../loader.ts";

export const useCatalogPage = () => {
  const data = useLoaderData<typeof catalogLoader>();
  const { project, allItems, selected, bought, action } = usePlannerContext();
  const [search, setSearch] = useSearchParams();
  const fitOnly = search.get("fit") !== "all";
  const selectedItem = allItems.find((item) => item.id === selected);
  const { difference, hasUnknownPrices } = getPurchaseBudget(project.budget, bought);

  const filterOffers = (event: ChangeEvent<HTMLInputElement>) => {
    const next = new URLSearchParams(search);
    if (event.target.checked) next.delete("fit");
    else next.set("fit", "all");
    setSearch(next, { preventScrollReset: true });
  };
  const addManually = () => action("add-buy");

  return { data, fitOnly, selectedItem, difference, hasUnknownPrices, filterOffers, addManually };
};

export const useCatalogResults = (catalog: readonly Item[], fitOnly: boolean) => {
  const { project, bought, positions, allItems, inspection, addCatalogItem, action } =
    usePlannerContext();
  const { revalidate, state } = useRevalidator();
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const total = purchaseTotal(bought);
  const offers = catalog
    .filter((offer) => offer.mode === project.mode)
    .map((offer) => {
      const existing = bought.find((entry) => entry.id === offer.id);
      const included = existing !== undefined;
      const item = existing ?? offer;
      const proposed = [...allItems, item];
      const fitsLayout = included
        ? Boolean(positions[item.id]) &&
          !inspection.warnings.some(
            (warning) => !warning.id || warning.id === item.id || warning.other === item.id
          )
        : variants.some((_, index) => {
            const placement = arrange(project.room, proposed, index, project.passage);
            return (
              placement[item.id] &&
              !inspect(project.room, proposed, placement, project.passage).warnings.length
            );
          });
      const problems = purchaseIssues(project, item);
      if (!fitsLayout) problems.push("Проверьте место на плане");
      if ((included ? total : total + lineTotal(item)) > project.budget)
        problems.push("Сверх общего бюджета");
      const selectOffer = () => {
        if (included) {
          action("item", item.id);
          return;
        }
        addCatalogItem(item);
        setLastAdded(item.id);
      };
      return {
        item,
        included,
        justAdded: included && lastAdded === item.id,
        problems,
        selectOffer
      };
    })
    .filter(({ included, problems }) => !fitOnly || included || problems.length === 0);
  const retry = () => {
    void revalidate();
  };
  return { offers, retry, retrying: state === "loading" };
};
