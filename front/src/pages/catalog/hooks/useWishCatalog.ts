import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router";

import { searchCatalog } from "@/pages/planner/catalogSearch";
import {
  catalogKinds, getCatalogProblem, getWishPurchaseLimit, getWishPurchases, getWishSearch,
  isFreshCatalogOffer, makeCatalogItems, prepareWishPurchase
} from "@/pages/planner/helpers";
import { usePlannerContext } from "@/pages/planner/hooks";
import { lineTotal, visibleItems } from "@/pages/planner/mock";
import type { Item, ProjectWish } from "@/pages/planner/types";
import { getAvitoListing, getAvitoOffers } from "@/shared/api/requests";
import type { AvitoListing, AvitoOffer, CatalogCity, CatalogOffer } from "@/shared/api/requests";
import { newId } from "@/shared/helpers";
import { PATHS } from "@/shared/constants";

type SourceResult<T> = { offers: T[]; busy: boolean; message?: string };
type Selection =
  | { source: "divan"; offer: CatalogOffer }
  | { source: "avito"; offer: AvitoOffer };
const loading: SourceResult<never> = { offers: [], busy: true };
const avitoCities: CatalogCity[] = [
  { id: "moscow", name: "Москва" },
  { id: "sankt-peterburg", name: "Санкт-Петербург" },
  { id: "ekaterinburg", name: "Екатеринбург" },
  { id: "rossiya", name: "Вся Россия · Avito" }
];
const avitoCityIds: Record<string, string> = { moscow: "moskva" };
const avitoError = (error: unknown) => {
  const code = axios.isAxiosError<{ code?: string }>(error) ? error.response?.data?.code : undefined;
  if (code === "AVITO_VERIFICATION") return "Авито просит пройти проверку в браузере MCP. После проверки повторите поиск.";
  if (code === "AVITO_DISABLED") return "Авито пока не подключён.";
  if (code === "AVITO_NOT_FOUND") return "Объявление больше недоступно.";
  return "Не удалось получить данные Авито.";
};

export const useWishCatalog = (wish: ProjectWish, divanCities: CatalogCity[]) => {
  const { project, positions, update } = usePlannerContext();
  const navigate = useNavigate();
  const cities = [...divanCities, ...avitoCities.filter(({ id }) => !divanCities.some((city) => city.id === id))];
  const [cityId, setCityId] = useState(project.catalogCity ?? "");
  const city = cities.find(({ id }) => id === cityId);
  const divanAvailable = wish.category !== "other" && divanCities.some(({ id }) => id === cityId);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<Selection>();
  const [selectedListing, setSelectedListing] = useState<AvitoListing>();
  const [selectionError, setSelectionError] = useState("");
  const [status, setStatus] = useState("");
  const listingRequest = useRef<AbortController | null>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const [divan, setDivan] = useState<SourceResult<CatalogOffer>>();
  const [avito, setAvito] = useState<SourceResult<AvitoOffer>>();
  const search = useMemo(() => getWishSearch(wish, project, cityId), [wish, project, cityId]);
  const maxPrice = getWishPurchaseLimit(project, search);
  const chosen = getWishPurchases(project, wish);
  const replaced = project.items.find((item) => item.id === search.replaceId);
  const allowsSearch = Boolean(city) && search.quantity > 0 && maxPrice > 0;
  const usedQuery = /б\s*[/.]\s*у/iu.test(wish.query) ? wish.query : `${wish.query} б/у`;

  useEffect(() => {
    if (!allowsSearch) return;
    const controller = new AbortController();
    const { signal } = controller;
    void getAvitoOffers({
      params: { q: usedQuery, city: avitoCityIds[cityId] ?? cityId, category: search.category, maxPrice },
      config: { signal, timeout: 55_000 }
    }).then(
      (offers) => { if (!signal.aborted) setAvito({ offers, busy: false }); },
      (error: unknown) => { if (!signal.aborted) setAvito({ offers: [], busy: false, message: avitoError(error) }); }
    );
    if (divanAvailable)
      void searchCatalog({ search, project, positions }, signal, (progress) => {
        if (!signal.aborted) setDivan({ offers: progress.offers, busy: true });
      }).then(
        (result) => { if (!signal.aborted) setDivan({ offers: result.offers, busy: false,
          message: result.incomplete ? "Часть предложений Divan.ru не удалось проверить." : undefined }); },
        (error: unknown) => { if (!signal.aborted) setDivan((previous) => ({
          offers: previous?.offers ?? [], busy: false,
          message: axios.isAxiosError(error) && error.response?.status === 503
            ? "Divan.ru пока не подключён." : "Не удалось загрузить Divan.ru."
        })); }
      );
    return () => controller.abort();
  }, [allowsSearch, attempt, cityId, divanAvailable, maxPrice, positions, project, search, usedQuery]);

  useEffect(() => () => listingRequest.current?.abort(), []);
  useEffect(() => {
    if (selection) confirmation.current?.focus();
  }, [selection]);

  const clearSelection = () => {
    listingRequest.current?.abort();
    setSelection(undefined);
    setSelectedListing(undefined);
    setSelectionError("");
  };
  const resetResults = () => {
    clearSelection();
    setDivan(undefined);
    setAvito(undefined);
    setStatus("");
  };
  const changeCity = (event: ChangeEvent<HTMLSelectElement>) => {
    if (event.currentTarget.value === cityId) return;
    setCityId(event.currentTarget.value);
    resetResults();
    if (event.currentTarget.value) update({ catalogCity: event.currentTarget.value });
  };
  const retry = () => {
    clearSelection();
    setStatus("");
    setDivan((previous) => previous && { offers: previous.offers, busy: true });
    setAvito((previous) => previous && { offers: previous.offers, busy: true });
    setAttempt((previous) => previous + 1);
  };

  const previewAvito = (offer: AvitoOffer) => async () => {
    clearSelection();
    setSelection({ source: "avito", offer });
    const controller = new AbortController();
    listingRequest.current = controller;
    try {
      const listing = await getAvitoListing({
        params: { url: offer.url }, config: { signal: controller.signal, timeout: 57_000 }
      });
      if (!controller.signal.aborted) {
        if (listing.condition === "new") setSelectionError("В объявлении указано, что мебель новая.");
        else setSelectedListing(listing);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) setSelectionError(avitoError(error));
    }
  };
  const previewDivan = (offer: CatalogOffer) => () => {
    clearSelection();
    setSelection({ source: "divan", offer });
  };
  const selectPurchase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection || !city || !search.quantity) return;
    const form = new FormData(event.currentTarget);
    if (replaced && !form.has("replace")) {
      setSelectionError("Подтвердите замену предмета на плане.");
      return;
    }
    let purchases: Item[];
    if (selection.source === "divan") {
      const offer = selection.offer;
      const problem = getCatalogProblem(offer, search, project);
      if (!isFreshCatalogOffer(offer) || problem) {
        setSelectionError(problem ?? "Цена могла измениться. Повторите поиск.");
        return;
      }
      purchases = makeCatalogItems(offer, search, Array.from({ length: search.quantity }, newId), city.name);
    } else {
      if (!selectedListing) return;
      const { price, url, name, condition } = selectedListing;
      const w = Number(form.get("width")) / 100;
      const d = Number(form.get("depth")) / 100;
      const h = Number(form.get("height")) / 100;
      if (![w, d, h].every((val) => Number.isFinite(val) && val >= 0.05 && val <= 20)) {
        setSelectionError("Укажите ширину, глубину и высоту в сантиметрах.");
        return;
      }
      if (condition === "unknown" && !form.has("used")) {
        setSelectionError("Уточните состояние у продавца.");
        return;
      }
      if (search.material && !form.has("material")) {
        setSelectionError("Проверьте материал мебели в объявлении или у продавца.");
        return;
      }
      if (price === undefined || price > maxPrice ||
        (search.maxWidth !== undefined && w > search.maxWidth) ||
        (search.maxDepth !== undefined && d > search.maxDepth) ||
        (search.maxHeight !== undefined && h > search.maxHeight)) {
        setSelectionError("Цена или габариты превышают условия подбора.");
        return;
      }
      if (project.items.some((item) => item.id !== search.replaceId && item.url === url)) {
        setSelectionError("Это объявление уже добавлено в проект.");
        return;
      }
      purchases = [{
        id: newId(), name, url, price, w, d, h, kind: catalogKinds[search.category],
        owned: false, quantity: 1, material: search.material ?? "Другое", source: "avito", verified: "review",
        seller: "Avito", mode: project.mode, availability: "Б/у", wishId: wish.id,
        catalogCity: city.name, catalogCityId: city.id, catalogCheckedAt: new Date().toISOString()
      }];
    }
    const budget = visibleItems(project).filter((item) => !item.owned && item.id !== search.replaceId)
      .reduce((sum, item) => sum + lineTotal(item), 0);
    if (budget + purchases.reduce((sum, item) => sum + lineTotal(item), 0) > project.budget) {
      setSelectionError("Покупка выходит за бюджет проекта.");
      return;
    }
    const prepared = prepareWishPurchase(project, positions, search,
      purchases.map((item) => ({ ...item, mode: project.mode })));
    if (!prepared) {
      setSelectionError("Движок планировки не нашёл место для этой мебели. Проверьте габариты или выберите другой предмет.");
      return;
    }
    update({ items: prepared.items, layouts: prepared.layouts, catalogCity: city.id });
    resetResults();
    if (replaced && !project.brief?.wishes.some(({ id }) => id === wish.id)) {
      const params = new URLSearchParams({ step: "layout", item: purchases[0].id });
      void navigate(`${PATHS.planner}?${params}`);
      return;
    }
    if (prepared.needsLayout) {
      setStatus("Покупка добавлена в смету. Откройте варианты расстановки, чтобы разместить её на плане.");
      return;
    }
    setStatus(replaced ? "Предмет заменён на плане и в смете." : "Мебель добавлена на план и в смету.");
  };

  return {
    cities, city, cityId, chosen, search, maxPrice, changeCity, replaced, divanAvailable,
    divan: divan ?? loading, avito: avito ?? loading, allowsSearch, retry,
    selection, selectedListing, selectionError, status, clearSelection, selectPurchase,
    confirmation,
    divanCards: (divan?.offers ?? []).map((offer) => ({ offer, preview: previewDivan(offer) })),
    avitoCards: (avito?.offers ?? []).filter((offer) => !chosen.some(({ url }) => url === offer.url))
      .map((offer) => ({ offer, preview: previewAvito(offer) }))
  };
};
