import { getCatalogOffers } from "../../../shared/api/requests/index.ts";
import type { CatalogOffer } from "../../../shared/api/requests/index.ts";
import type { CatalogWork, CatalogWorkResult } from "./catalog.worker.ts";
import { CATALOG_RESULT_LIMIT, isFreshCatalogOffer } from "./catalogSelection.ts";

export type CatalogProgress = {
  offers: CatalogOffer[];
  problems: string[];
  incomplete: boolean;
};

const checkPage = (worker: Worker, signal: AbortSignal, work: CatalogWork) => {
  const result = new Promise<CatalogWorkResult>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<CatalogWorkResult>) => resolve(data);
    worker.onerror = () => reject(new Error("Не удалось проверить размещение"));
    signal.onabort = () => reject(signal.reason);
    if (signal.aborted) reject(signal.reason);
    else worker.postMessage(work);
  });
  return result.finally(() => {
    signal.onabort = null;
    worker.onmessage = null;
    worker.onerror = null;
  });
};

export const searchCatalog = async (
  context: Omit<CatalogWork, "offers">,
  signal: AbortSignal,
  onProgress: (progress: CatalogProgress) => void
) => {
  const worker = new Worker(new URL("./catalog.worker.ts", import.meta.url), { type: "module" });
  const offers: CatalogOffer[] = [];
  const problems = new Set<string>();
  const visited = new Set<string>();
  const products = new Set<string>();
  let incomplete = false;
  let cursor: string | undefined = "1.0";
  try {
    while (cursor && offers.length < CATALOG_RESULT_LIMIT) {
      if (visited.has(cursor)) throw new Error("Каталог повторил страницу");
      visited.add(cursor);
      const page = await getCatalogOffers({
        params: { city: context.search.city, category: context.search.category, cursor },
        config: { signal }
      });
      signal.throwIfAborted();
      incomplete ||= page.incomplete;
      const candidates = page.offers.filter((offer) => {
        if (products.has(offer.sku)) return false;
        if (!isFreshCatalogOffer(offer)) {
          incomplete = true;
          return false;
        }
        products.add(offer.sku);
        return true;
      });
      if (candidates.length) {
        const checked = await checkPage(worker, signal, { ...context, offers: candidates });
        signal.throwIfAborted();
        offers.push(...checked.offers.slice(0, CATALOG_RESULT_LIMIT - offers.length));
        checked.problems.forEach((problem) => problems.add(problem));
      }
      cursor = page.nextCursor ?? undefined;
      onProgress({ offers: [...offers], problems: [...problems], incomplete });
      if (page.incomplete && candidates.length === 0) break;
    }
  } finally {
    worker.terminate();
  }
  return { offers, problems: [...problems], incomplete };
};
