import type { CatalogOffer } from "../../../shared/api/requests/index.ts";
import { newId } from "../../../shared/helpers/index.ts";
import type { CatalogSearch, Positions, Project } from "../types/index.ts";
import { findCatalogPlacement, getCatalogProblem } from "../helpers/index.ts";

export type CatalogWork = {
  offers: CatalogOffer[];
  search: CatalogSearch;
  project: Project;
  positions: Positions;
};
export type CatalogWorkResult = { offers: CatalogOffer[]; problems: string[] };

self.addEventListener("message", ({ data }: MessageEvent<CatalogWork>) => {
  const { offers, search, project, positions } = data;
  const ids = Array.from({ length: search.quantity }, () => newId());
  const result: CatalogWorkResult = { offers: [], problems: [] };
  offers.forEach((offer) => {
    const problem = getCatalogProblem(offer, search, project);
    if (problem) {
      result.problems.push(problem);
      return;
    }
    if (findCatalogPlacement({ project, positions, search, offer, ids }))
      result.offers.push(offer);
    else result.problems.push("На текущем плане недостаточно места");
  });
  self.postMessage(result);
});
