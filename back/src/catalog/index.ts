import { Router } from "express";

import { createDivanCatalog, readCatalogQuery } from "./divan.ts";

export const createCatalogRouter = (fetchFromDivan?: typeof fetch) => {
  const router = Router();
  const catalog = fetchFromDivan && createDivanCatalog(fetchFromDivan);

  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    if (catalog) next();
    else response.status(503).json({ code: "CATALOG_DISABLED" });
  });

  router.get("/cities", async (_request, response) => {
    try {
      response.json({ cities: await catalog?.cities() });
    } catch {
      response.status(502).json({ code: "CATALOG_UNAVAILABLE" });
    }
  });

  router.get("/offers", async (request, response) => {
    const query = readCatalogQuery(request.query);
    if (!query) {
      response.status(400).json({ code: "INVALID_CATALOG_QUERY" });
      return;
    }
    try {
      const result = await catalog?.page(
        query.city,
        query.category,
        query.cursor,
      );
      if (result) response.json(result);
      else response.status(400).json({ code: "UNKNOWN_CITY" });
    } catch {
      response.status(502).json({ code: "CATALOG_UNAVAILABLE" });
    }
  });

  return router;
};
