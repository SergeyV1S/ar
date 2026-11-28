import { Router } from "express";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
const text = (value: unknown, length: number) =>
  typeof value === "string" ? value.trim().slice(0, length) : "";
const titleByCategory = new Map<string, RegExp>([
  ["chair", /стул|стуль|табурет/iu],
  ["armchair", /кресл/iu],
  ["sofa", /диван|кушетк|тахт/iu],
  ["table", /стол|консол/iu],
  ["wardrobe", /шкаф|гардероб/iu],
  ["cabinet", /тумб/iu],
  ["pouf", /пуф|банкетк/iu],
  ["bed", /кроват/iu],
  ["dresser", /комод/iu],
  ["shelving", /стеллаж|этажерк|полк/iu]
]);

const listingUrl = (value: unknown) => {
  if (typeof value !== "string" || value.length > 500) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["www.avito.ru", "avito.ru", "m.avito.ru"].includes(url.host) &&
      !url.username && !url.password && /_\d{6,}$/.test(url.pathname))
      return `https://www.avito.ru${url.pathname}`;
  } catch {
    return;
  }
};

const readPrice = (value: unknown) => {
  const match = text(value, 100).match(/^([\d\s]+)\s*₽$/u);
  const price = Number(match?.[1].replace(/\s/g, ""));
  return price > 0 && price <= 1e9 ? price : undefined;
};

const readSize = (description: string, name: string) => {
  const size = description.match(new RegExp(`(?:${name})\\s*[:—–-]?\\s*(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(см|мм|м)(?![а-я])`, "iu"));
  if (!size) return;
  const divisor = { см: 100, мм: 1000, м: 1 };
  const unit = Object.entries(divisor).find(([key]) => key === size[2].toLowerCase());
  const meters = Number(size[1].replace(",", ".")) / (unit?.[1] ?? 1);
  if (meters >= 0.05 && meters <= 20) return meters;
};

const publishedSizes = (description: string) => ({
  w: readSize(description, "ширина"),
  d: readSize(description, "глубина"),
  h: readSize(description, "высота")
});

const readCondition = (description: string) => {
  const condition = description.match(/состояние\s*[:—–-]?\s*([^\n;,.]{1,45})/iu)?.[1] ?? "";
  if (/^нов(ый|ая|ое|ые)/iu.test(condition.trim())) return "new";
  if (/^б\s*[/.]\s*у|^бывш|^хорош|^отличн|^удовлетвор/iu.test(condition.trim())) return "used";
  return "unknown";
};

const readEnvelope = async (response: Response, id: number) => {
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return record(await response.json());
  const stream = response.body?.pipeThrough(new TextDecoderStream()).getReader();
  if (!stream) throw new Error("Empty MCP stream");
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await stream.read();
      if (done) throw new Error("MCP response missing");
      buffer += value.replace(/\r/g, "");
      if (buffer.length > 1_000_000) throw new Error("MCP response too large");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const event = buffer.slice(0, boundary).split("\n")
          .filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        buffer = buffer.slice(boundary + 2);
        if (event) {
          const message = record(JSON.parse(event));
          if (message.id === id) return message;
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    await stream.cancel().catch(() => {});
  }
};

const call = async (url: string, tool: "avito_search" | "avito_listing", args: object, signal: AbortSignal) => {
  const headers = new Headers({ Accept: "application/json, text/event-stream", "Content-Type": "application/json" });
  const send = (body: object) => fetch(url, { method: "POST", headers, body: JSON.stringify(body),
    redirect: "error", signal });
  const initialize = await send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
    protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "metrika", version: "1.0" }
  } });
  if (!initialize.ok) {
    await initialize.body?.cancel();
    throw new Error("MCP initialize failed");
  }
  const session = initialize.headers.get("mcp-session-id");
  const init = record((await readEnvelope(initialize, 1)).result);
  if (typeof init.protocolVersion !== "string") throw new Error("Invalid MCP initialization");
  headers.set("MCP-Protocol-Version", init.protocolVersion);
  if (session) headers.set("Mcp-Session-Id", session);
  try {
    const notification = await send({ jsonrpc: "2.0", method: "notifications/initialized" });
    await notification.body?.cancel();
    if (!notification.ok) throw new Error("MCP notification failed");
    const response = await send({ jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: tool, arguments: args } });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("MCP tool failed");
    }
    const envelope = record((await readEnvelope(response, 2)).result);
    if (envelope.isError === true) throw new Error("Avito MCP tool failed");
    if (envelope.structuredContent) return record(envelope.structuredContent);
    const first = Array.isArray(envelope.content) && record(envelope.content[0]).text;
    if (typeof first === "string") return record(JSON.parse(first));
    throw new Error("Unrecognized MCP response");
  } finally {
    if (session)
      void fetch(url, { method: "DELETE", headers, signal: AbortSignal.timeout(5_000), redirect: "error" })
        .then((response) => response.body?.cancel()).catch(() => {});
  }
};

export const createAvitoRouter = (endpoint?: string) => {
  const router = Router();
  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    if (endpoint) next();
    else response.status(503).json({ code: "AVITO_DISABLED" });
  });
  const search = new Map<string, { expires: number; result: ReturnType<typeof call> }>();
  router.get("/offers", async (request, response) => {
    const { q, city, maxPrice, category = "other" } = request.query;
    if (!endpoint || typeof q !== "string" || !q.trim() || q.length > 130 ||
      typeof city !== "string" || !/^[a-z][a-z0-9-]{1,60}$/.test(city) ||
      typeof category !== "string" || (category !== "other" && !titleByCategory.has(category)) ||
      (maxPrice !== undefined && (typeof maxPrice !== "string" || !/^\d{1,10}$/.test(maxPrice)))) {
      response.status(400).json({ code: "INVALID_AVITO_QUERY" });
      return;
    }
    const key = JSON.stringify([q, city, maxPrice, category]);
    try {
      const cached = search.get(key);
      const result = cached && Date.now() < cached.expires ? cached.result : call(endpoint, "avito_search", {
        query: q.trim(), city, category: "mebel_i_interer", ...(maxPrice ? { price_max: Number(maxPrice) } : {})
      }, AbortSignal.timeout(40_000));
      if (result !== cached?.result) {
        if (search.size >= 50) search.clear();
        search.set(key, { expires: Date.now() + 5 * 60_000, result });
      }
      const data = await result;
      if (data.blocked === true) {
        search.delete(key);
        response.status(503).json({ code: "AVITO_VERIFICATION" });
        return;
      }
      if (!Array.isArray(data.items)) throw new Error("Missing Avito search items");
      const titlePattern = titleByCategory.get(category);
      const urls = new Set<string>();
      const offers = data.items.flatMap((raw) => {
        const item = record(raw);
        const url = listingUrl(item.url);
        const name = text(item.title, 100);
        const price = readPrice(item.price);
        const description = text(item.description, 400);
        if (!url || !name || price === undefined || urls.has(url) ||
          (titlePattern && !titlePattern.test(name)) || readCondition(description) === "new") return [];
        if (maxPrice && price > Number(maxPrice)) return [];
        urls.add(url);
        return [{ url, name, price, location: text(item.location, 100), ...publishedSizes(description) }];
      }).slice(0, 8);
      response.json({ offers });
    } catch {
      search.delete(key);
      response.status(502).json({ code: "AVITO_UNAVAILABLE" });
    }
  });
  router.get("/listing", async (request, response) => {
    const url = listingUrl(request.query.url);
    if (!endpoint || !url) {
      response.status(400).json({ code: "INVALID_AVITO_LISTING" });
      return;
    }
    try {
      const item = await call(endpoint, "avito_listing", { url }, AbortSignal.timeout(50_000));
      if (item.blocked === true) {
        response.status(503).json({ code: "AVITO_VERIFICATION" });
        return;
      }
      if (listingUrl(item.url) !== url || !text(item.title, 100)) {
        response.status(404).json({ code: "AVITO_NOT_FOUND" });
        return;
      }
      const details = [text(item.params, 1000), text(item.description, 1500)].join("\n");
      response.json({ url, name: text(item.title, 100), price: readPrice(item.price),
        condition: readCondition(details), ...publishedSizes(details) });
    } catch {
      response.status(502).json({ code: "AVITO_UNAVAILABLE" });
    }
  });
  return router;
};
