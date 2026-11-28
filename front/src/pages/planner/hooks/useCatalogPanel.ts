import { centimeters, money } from "@/shared/helpers";

import { isLegacyRetailOffer } from "../helpers/catalogSelection.ts";
import { CATALOG_CATEGORIES, isCatalogCategory } from "../types/index.ts";
import { usePlannerContext } from "./usePlannerContext.ts";

const checkedAt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export const useCatalogPanel = () => {
  const { retail, bought, openCatalogSearch, replaceCatalogItem } = usePlannerContext();
  const { results, search, city, retry, add } = retail;
  const quantity = search?.quantity ?? 1;
  const offerCards = results.offers.map((offer) => ({
    offer,
    placedPrice: money(offer.price * quantity),
    unitPrice: money(offer.price),
    dates: checkedAt.format(new Date(offer.checkedAt)),
    size: [offer.w, offer.d, offer.h].map(centimeters).join(" × "),
    availability: offer.availability === "in-stock" ? "В наличии" : "Под заказ",
    addOffer: () => add(offer)
  }));
  const legacyItems = bought.filter(isLegacyRetailOffer).map((item) => ({
    item,
    replace: () => replaceCatalogItem(item.id)
  }));
  const conditions =
    search && city && isCatalogCategory(search.category)
      ? [city.name, CATALOG_CATEGORIES[search.category], `${quantity} шт.`].join(" · ")
      : "";
  const hasIncompleteResult = results.incomplete && results.status === "done";
  return {
    results,
    offerCards,
    legacyItems,
    conditions,
    quantity,
    hasIncompleteResult,
    openCatalogSearch,
    retry
  };
};
