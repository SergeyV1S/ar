import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import type { CatalogProps } from "../components/index.ts";
import { getCatalogError } from "../helpers/index.ts";
import { lineTotal, parseOffers, planItems, purchaseIssues, purchaseTotal } from "../mock/index.ts";
import mockOffersUrl from "../mock/mock-offers.json?url&no-inline";
import { arrange, inspect } from "../planning/index.ts";
import type { Item } from "../types/index.ts";

export const useCatalog = ({ project, items, positions, add, action }: CatalogProps) => {
  const [fitOnly, setFitOnly] = useState(true);
  const total = purchaseTotal(items);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setLoading(true);
    setError("");
    setAttempt((count) => count + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(mockOffersUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`Источник вернул HTTP ${response.status}.`);
        const raw: unknown = await response.json();
        const entries = parseOffers(raw);
        if (!controller.signal.aborted)
          setCatalog(
            entries.map((item) =>
              item.mode === "office"
                ? { ...item, url: new URL("demo-offer.txt", document.baseURI).href }
                : item
            )
          );
      } catch (cause) {
        if (!controller.signal.aborted) setError(getCatalogError(cause));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [attempt]);

  const addManually = () => action("add-buy");
  const openProcurement = () => action("procurement");
  const filterOffers = (e: ChangeEvent<HTMLInputElement>) => setFitOnly(e.target.checked);
  const furniture = planItems(project);
  const currentWarnings = inspect(project.room, furniture, positions, project.passage).warnings;
  const offers = catalog
    .filter((entry) => entry.mode === project.mode)
    .map((offer) => {
      const existing = items.find((entry) => entry.id === offer.id);
      const included = Boolean(existing);
      const item = existing ?? offer;
      const proposed = included ? null : [...furniture, item];
      const fitsLayout = proposed
        ? [0, 1, 2].some((variant) => {
            const arrangement = arrange(project.room, proposed, variant, project.passage);
            return (
              arrangement[item.id] &&
              !inspect(project.room, proposed, arrangement, project.passage).warnings.length
            );
          })
        : Boolean(positions[item.id]) &&
          !currentWarnings.some(
            (warning) => !warning.id || warning.id === item.id || warning.other === item.id
          );
      const problems = [...purchaseIssues(project, item)];
      if (!fitsLayout) problems.push("Проверьте место на плане");
      if ((!included ? total + lineTotal(item) : total) > project.budget)
        problems.push("Сверх общего бюджета");
      const selectOffer = () => (included ? action("item", item.id) : add(item));
      return { item, included, problems, selectOffer };
    })
    .filter(({ included, problems }) => !fitOnly || included || problems.length === 0);
  return { fitOnly, offers, error, retry, loading, addManually, openProcurement, filterOffers };
};
