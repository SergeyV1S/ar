import type { ChangeEvent } from "react";
import { useState } from "react";

import type { CatalogProps } from "../components/index.ts";
import { catalog, purchaseIssues, purchaseTotal } from "../data/index.ts";
import { arrange, inspect } from "../planning/index.ts";

export const useCatalog = ({ project, items, positions, add, action }: CatalogProps) => {
  const [fitOnly, setFitOnly] = useState(true);
  const total = purchaseTotal(items);
  const external = project.mode === "used";

  const addManually = () => action("add-buy");
  const openProcurement = () => action("procurement");
  const filterOffers = (e: ChangeEvent<HTMLInputElement>) => setFitOnly(e.target.checked);
  const offers =
    project.mode === "retail"
      ? catalog
          .map((item) => {
            const included = items.some((existing) => existing.id === item.id);
            const proposed = included
              ? null
              : [...project.items.filter((entry) => entry.owned), ...items, item];
            const fitsLayout = proposed
              ? [0, 1, 2].some((variant) => {
                  const arrangement = arrange(project.room, proposed, variant);
                  return (
                    arrangement[item.id] &&
                    !inspect(project.room, proposed, arrangement, project.passage).warnings.length
                  );
                })
              : Boolean(positions[item.id]);
            const problems = [...purchaseIssues(project, item)];
            if (!fitsLayout) problems.push("Проверьте место на плане");
            if ((!included ? total + (item.price ?? 0) : total) > project.budget)
              problems.push("Сверх общего бюджета");
            const selectOffer = () => (included ? action("item", item.id) : add(item));
            return { item, included, problems, selectOffer };
          })
          .filter(({ included, problems }) => !fitOnly || included || problems.length === 0)
      : [];
  return { fitOnly, offers, external, addManually, openProcurement, filterOffers };
};
