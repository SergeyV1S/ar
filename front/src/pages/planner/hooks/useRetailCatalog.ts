import { useEffect, useState } from "react";

import type { CatalogCity, CatalogOffer } from "@/shared/api/requests";
import { newId } from "@/shared/helpers";
import axios from "axios";

import { searchCatalog } from "../catalogSearch/index.ts";
import type { CatalogProgress } from "../catalogSearch/index.ts";
import {
  CATALOG_MAX_AGE,
  PROJECT_ITEM_LIMIT,
  getCatalogProblem,
  isFreshCatalogOffer,
  isLegacyRetailOffer,
  prepareCatalogPlacement
} from "../helpers/catalogSelection.ts";
import type { CatalogSearch, Positions, Project } from "../types/index.ts";

type CatalogResults = CatalogProgress & {
  status: "idle" | "loading" | "done" | "error";
  disabled?: boolean;
};
type Request = { search: CatalogSearch; city: CatalogCity; revision: number };
const emptyResult: CatalogResults = { status: "idle", offers: [], problems: [], incomplete: false };

export const useRetailCatalog = ({
  project,
  positions,
  revision,
  enabled,
  update,
  notify
}: {
  project: Project;
  positions: Positions;
  revision: number;
  enabled: boolean;
  update: (patch: Partial<Project>) => void;
  notify: (message: string) => void;
}) => {
  const [request, setRequest] = useState<Request | null>(null);
  const [run, setRun] = useState<{ request: Request; project: Project; result: CatalogResults }>();
  const active = enabled && request?.revision === revision ? request : null;
  const search = active?.search;
  const previous =
    run?.request.search === search && run?.project === project ? run.result : emptyResult;
  const updating = active && (run?.request !== active || run.project !== project);
  const status = updating ? "loading" : previous.status;
  const results: CatalogResults = { ...previous, status };

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const { signal } = controller;
    const search = active.search;
    const removed = search.replaceId ? 1 : 0;
    if (
      project.items.length - removed + search.quantity > PROJECT_ITEM_LIMIT ||
      (search.replaceId &&
        !project.items.some((item) => item.id === search.replaceId && isLegacyRetailOffer(item)))
    ) {
      setRun({
        request: active,
        project,
        result: {
          ...emptyResult,
          status: "done",
          problems: [
            search.replaceId && !project.items.some((item) => item.id === search.replaceId)
              ? "Позиция для замены удалена"
              : `В проекте можно хранить до ${PROJECT_ITEM_LIMIT} предметов`
          ]
        }
      });
      return;
    }
    let latest = emptyResult;
    const report = (result: CatalogResults) => {
      if (signal.aborted) return;
      latest = result;
      setRun((current) => {
        const sameSearch = current?.request.search === search && current.project === project;
        if (result.status === "done" || result.offers.length || !sameSearch)
          return { request: active, project, result };
        const offers = current.result.offers.filter((offer) => isFreshCatalogOffer(offer));
        return { request: active, project, result: { ...result, offers } };
      });
    };
    void searchCatalog({ search, project, positions }, signal, (progress) =>
      report({ ...progress, status: "loading" })
    ).then(
      (progress) => report({ ...progress, status: "done" }),
      (error: unknown) => {
        if (axios.isCancel(error) || signal.aborted) return;
        const disabled = axios.isAxiosError(error) && error.response?.status === 503;
        report({
          ...latest,
          offers: latest.offers.filter((offer) => isFreshCatalogOffer(offer)),
          status: "error",
          disabled
        });
      }
    );
    return () => controller.abort();
  }, [active, positions, project]);

  useEffect(() => {
    if (!active || !results.offers.length) return;
    const expiresAt =
      Math.min(...results.offers.map((offer) => Date.parse(offer.checkedAt))) + CATALOG_MAX_AGE;
    const expire = () =>
      setRun((current) => {
        if (current?.request.search !== active.search || project !== current.project)
          return current;
        return {
          ...current,
          result: {
            ...current.result,
            offers: current.result.offers.filter((offer) => isFreshCatalogOffer(offer)),
            incomplete: true
          }
        };
      });
    const timeout = setTimeout(expire, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [active, project, results.offers]);

  const start = (search: CatalogSearch, city: CatalogCity) => {
    if (!enabled) return;
    if (project.catalogCity !== city.id) update({ catalogCity: city.id });
    setRequest({ search, city, revision });
  };

  const retry = () => {
    if (active) setRequest({ ...active });
  };

  const add = (offer: CatalogOffer) => {
    if (!active || !results.offers.includes(offer)) return;
    if (!isFreshCatalogOffer(offer) || getCatalogProblem(offer, active.search, project)) {
      notify("Условия изменились. Повторите подбор.");
      retry();
      return;
    }
    const ids = Array.from({ length: active.search.quantity }, () => newId());
    const prepared = prepareCatalogPlacement({
      project,
      positions,
      search: active.search,
      offer,
      ids,
      cityName: active.city.name
    });
    if (!prepared) {
      notify("На текущем плане не удалось разместить выбранный набор.");
      retry();
      return;
    }
    setRequest(null);
    update({ items: prepared.items, layouts: prepared.layouts });
    notify(
      active.search.replaceId
        ? "Позиция заменена в плане и смете."
        : "Мебель добавлена на план и в смету."
    );
  };

  return { search, city: active?.city, results, start, retry, add };
};
