import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";

import { getPublishedDimensions } from "./publicProduct.ts";
import { photoFrom } from "./photo.ts";

const STORE = "https://www.divan.ru";
const CITIES_PATH = "/category/stulya";
const CACHE_MS = 30 * 60 * 1000;
const BATCH_SIZE = 6;
const categories = {
  chair: "stulya",
  armchair: "kresla",
  sofa: "divany",
  table: "stoly",
  wardrobe: "shkafy",
  cabinet: "tumby",
  pouf: "pufy",
  bed: "krovati",
  dresser: "komody",
  shelving: "stellazhi",
} as const;
type Category = keyof typeof categories;

type City = { id: string; name: string };
type Listing = {
  path: string;
  price: number;
  priceWithoutPromotion: number;
  availability: "in-stock" | "made-to-order";
  stock?: number;
};
type Page = { entries: Listing[]; next: boolean; checkedAt: string };
type CatalogFilters = {
  maxPrice?: number;
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
  material?: string;
};

const record = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value))
    return { ...value };
  return {};
};

const schema = ($: CheerioAPI) =>
  $("script[type='application/ld+json']")
    .toArray()
    .flatMap((script) => {
      try {
        const value: unknown = JSON.parse($(script).text());
        return [record(value)];
      } catch {
        return [];
      }
    });

const publicPath = (href: unknown) => {
  if (typeof href !== "string") return;
  try {
    const url = new URL(href, STORE);
    if (url.origin === STORE && !url.search && !url.hash) return url.pathname;
  } catch {
    return;
  }
};

const productPath = (href: unknown) => {
  const path = publicPath(href);
  if (path && /^\/product\/[a-z0-9-]+$/.test(path)) return path;
};

const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

const getCities = ($: CheerioAPI) => {
  const cities = new Map<string, City>([
    ["moscow", { id: "moscow", name: "Москва" }],
  ]);
  $("a[href]").each((_, anchor) => {
    const path = publicPath($(anchor).attr("href"));
    const id = path?.match(/^\/([a-z][a-z0-9-]+)\/category\/stulya$/)?.[1];
    const name = normalizeText($(anchor).text());
    if (id && name && /^[а-яёА-ЯЁ][а-яёА-ЯЁ .()-]+$/.test(name))
      cities.set(id, { id, name });
  });
  if (cities.size === 1) throw new Error("Divan.ru city list unavailable");
  return [...cities.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  );
};

const getPrice = (offer: Record<string, unknown>, priceText: string) => {
  const raw = offer.price;
  if (
    (typeof raw !== "number" && typeof raw !== "string") ||
    offer.priceCurrency !== "RUB"
  )
    return;
  const schemaPrice = Number(raw);
  if (!Number.isFinite(schemaPrice) || schemaPrice <= 0) return;
  const displayed = [
    ...priceText.matchAll(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:руб\.|₽)/g),
  ].map((match) => Number(match[1].replace(/\s/g, "").replace(",", ".")));
  return {
    price: schemaPrice,
    priceWithoutPromotion: Math.max(schemaPrice, ...displayed),
  };
};

const readAvailability = (offer: Record<string, unknown>, text: string) => {
  const value = offer.availability;
  if (
    value === "https://schema.org/PreOrder" ||
    value === "https://schema.org/BackOrder" ||
    /^Под заказ/i.test(text)
  )
    return { availability: "made-to-order" } as const;
  if (
    value !== "https://schema.org/InStock" ||
    /В наличии в других цветах/i.test(text)
  )
    return;
  const quantity = text.match(/В наличии:\s*(более\s+)?(\d+)\s*шт/i);
  const stock = quantity
    ? Number(quantity[2]) + Number(Boolean(quantity[1]))
    : 1;
  if (stock > 0) return { availability: "in-stock", stock } as const;
};

const getListing = (
  $: CheerioAPI,
  base: string,
  path: string,
  nextPath: string,
  checkedAt: string,
): Page => {
  const canonical = publicPath($("link[rel='canonical']").attr("href"));
  if (
    (canonical !== base && canonical !== path) ||
    !$("span")
      .toArray()
      .some(
        (node) =>
          !$(node).children().length &&
          normalizeText($(node).text()) === "Самые популярные",
      )
  )
    throw new Error("Divan.ru returned a different catalog page");
  const list = schema($).find(
    (value) =>
      value["@type"] === "ItemList" &&
      Array.isArray(value.itemListElement) &&
      (value.itemListElement.length === 0 ||
        record(record(value.itemListElement[0]).item)["@type"] === "Product"),
  );
  const products: unknown = list?.itemListElement;
  if (!Array.isArray(products))
    throw new Error("Divan.ru product list missing");
  const cards = new Map<string, { priceText: string; stockText: string }>();
  $("[data-testid='product-card']").each((_, node) => {
    const card = $(node);
    const url = productPath(
      card.find("a[href*='/product/']").first().attr("href"),
    );
    if (!url || cards.has(url)) return;
    cards.set(url, {
      priceText: card.find("[class*='_prices']").first().text(),
      stockText: normalizeText(
        card.find("[class*='_stockCount']").first().text() || card.text(),
      ),
    });
  });
  const unique = new Set<string>();
  const entries = products
    .map(record)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .flatMap(({ item }) => {
      const product = record(item);
      const url = productPath(product.url);
      if (!url || unique.has(url)) return [];
      const offer = record(product.offers);
      const card = cards.get(url);
      const price = getPrice(offer, card?.priceText ?? "");
      const availability = readAvailability(offer, card?.stockText ?? "");
      if (price === undefined || !availability) return [];
      unique.add(url);
      return [{ path: url, ...price, ...availability }];
    });
  const next =
    $("[data-testid='show-more-button']")
      .toArray()
      .some(
        (button) =>
          publicPath($(button).closest("a").attr("href")) === nextPath,
      ) ||
    $("a[href]")
      .toArray()
      .some((anchor) => publicPath($(anchor).attr("href")) === nextPath);
  return { entries, next, checkedAt };
};

const getProduct = ($: CheerioAPI, path: string) => {
  const product = schema($).find(
    (entry) =>
      entry["@type"] === "Product" &&
      productPath(record(entry.offers).url) === path,
  );
  if (
    !product ||
    typeof product.name !== "string" ||
    typeof product.sku !== "string" ||
    !product.name.trim() ||
    !product.sku.trim()
  )
    throw new Error("Divan.ru product variant missing");
  const fields = $("span")
    .toArray()
    .filter((node) => !$(node).children().length);
  const dimensions = fields.find(
    (node) => normalizeText($(node).text()) === "Размеры:",
  );
  const explicit = new Map<string, number>();
  $(dimensions ? [dimensions] : [])
    .siblings("span")
    .each((_, label) => {
      const match = normalizeText($(label).text()).match(
        /^(Ширина|Длина|Глубина|Высота)\s+(\d+(?:[.,]\d+)?)\s*см$/u,
      );
      if (match)
        explicit.set(match[1], Number(match[2].replace(",", ".")) / 100);
    });
  const published =
    explicit.size >= 3
      ? new Map<string, number>()
      : getPublishedDimensions($, product.sku, path);
  const length = explicit.get("Длина") ?? published.get("Длина");
  const width = explicit.get("Ширина") ?? published.get("Ширина");
  const depth = explicit.get("Глубина") ?? published.get("Глубина");
  const h = explicit.get("Высота") ?? published.get("Высота");
  const horizontal = explicit.get("Длина") ?? width ?? length;
  const w = depth === undefined ? horizontal : (width ?? length);
  const d = depth ?? (explicit.has("Длина") ? width : length);
  if (
    w === undefined ||
    d === undefined ||
    h === undefined ||
    [w, d, h].some(
      (value) => !Number.isFinite(value) || value < 0.05 || value > 20,
    )
  )
    return;

  const materialText = fields
    .filter((node) => /^Материал[^:]*:$/iu.test(normalizeText($(node).text())))
    .map((node) => $(node).parent().text())
    .join(" ");
  const materials = [
    ["ЛДСП", /ЛДСП/i],
    ["МДФ", /МДФ/i],
    ["Массив", /массив/i],
    ["Металл", /металл|сталь|алюминий/i],
    ["Ткань", /ткань|велюр|шенилл|рогожка|букле|жаккард/i],
    ["Букле", /букле/i],
    ["Стекло", /стекло/i],
  ] as const;
  const conditionalPromotion = $("span, div")
    .toArray()
    .some(
      (node) =>
        !$(node).children().length &&
        /^(?:без|по) промокод[ау]/iu.test(normalizeText($(node).text())),
    );
  const name = normalizeText(product.name);
  const images = Array.isArray(product.image) ? product.image : [product.image];
  const photo = images.map((image: unknown) => photoFrom(
    typeof image === "string" ? image : record(image).url,
    /^(?:cdn\.servicecdn\.ru|(?:[\w-]+\.)*divan\.ru)$/i
  )).find(Boolean);
  return {
    conditionalPromotion,
    sku: product.sku,
    name,
    photo,
    w,
    d,
    h,
    materials: materials
      .filter(([label, pattern]) => pattern.test(materialText) ||
        ((label === "Ткань" || label === "Букле") && pattern.test(name)))
      .map(([name]) => name),
  };
};

const createCache = <T>(maxSize: number) => {
  const values = new Map<string, { expires: number; value: Promise<T> }>();
  return (key: string, read: () => Promise<T>) => {
    const current = values.get(key);
    if (current && current.expires > Date.now()) return current.value;
    values.delete(key);
    if (values.size >= maxSize) {
      const oldest = values.keys().next().value;
      if (oldest !== undefined) values.delete(oldest);
    }
    const value = read().catch((error: unknown) => {
      if (values.get(key)?.value === value) values.delete(key);
      throw error;
    });
    values.set(key, { value, expires: Date.now() + CACHE_MS });
    return value;
  };
};

const createPageReader = (fetchFromDivan: typeof fetch) => {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (path: string) => {
    if (active >= 4) {
      if (waiting.length >= 32)
        throw new Error("Divan.ru request limit reached");
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else active++;
    try {
      const response = await fetchFromDivan(new URL(path, STORE), {
        signal: AbortSignal.timeout(9500),
        redirect: "error",
        headers: { "User-Agent": "MetrikaCatalog/1.0", Accept: "text/html" },
      });
      if (!response.ok) throw new Error(`Divan.ru HTTP ${response.status}`);
      return load(await response.text());
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
};

export const createDivanCatalog = (fetchFromDivan: typeof fetch) => {
  const read = createPageReader(fetchFromDivan);
  const cityCache = createCache<City[]>(1);
  const categoryCache = createCache<Page>(256);
  const productCache = createCache<ReturnType<typeof getProduct>>(1500);
  const cities = () =>
    cityCache("cities", async () => getCities(await read(CITIES_PATH)));

  const page = async (
    city: string,
    category: Category,
    cursor: { page: number; offset: number },
    filters: CatalogFilters = {},
  ) => {
    if (!(await cities()).some(({ id }) => id === city)) return;
    const prefix = city === "moscow" ? "" : `/${city}`;
    const base = `${prefix}/category/${categories[category]}`;
    const path = cursor.page === 1 ? base : `${base}/page-${cursor.page}`;
    const nextPath = `${base}/page-${cursor.page + 1}`;
    const listing = await categoryCache(path, async () =>
      getListing(
        await read(path),
        base,
        path,
        nextPath,
        new Date().toISOString(),
      ),
    );
    const batch = listing.entries.slice(
      cursor.offset,
      cursor.offset + BATCH_SIZE,
    ).filter(({ price, priceWithoutPromotion }) =>
      filters.maxPrice === undefined || Math.min(price, priceWithoutPromotion) <= filters.maxPrice);
    const results = await Promise.allSettled(
      batch.map(
        async ({
          path: productPath,
          price,
          priceWithoutPromotion,
          ...entry
        }) => {
          const details = await productCache(productPath, async () =>
            getProduct(await read(productPath), productPath),
          );
          if (!details) return;
          const { conditionalPromotion, ...variant } = details;
          const actualPrice = conditionalPromotion ? priceWithoutPromotion : price;
          if (
            (filters.maxPrice !== undefined && actualPrice > filters.maxPrice) ||
            (filters.maxWidth !== undefined && variant.w > filters.maxWidth) ||
            (filters.maxDepth !== undefined && variant.d > filters.maxDepth) ||
            (filters.maxHeight !== undefined && variant.h > filters.maxHeight) ||
            (filters.material && !variant.materials.some((material) => material === filters.material))
          ) return;
          return {
            ...entry,
            ...variant,
            price: actualPrice,
            url: new URL(productPath, STORE).href,
            checkedAt: listing.checkedAt,
          };
        },
      ),
    );
    const nextOffset = cursor.offset + BATCH_SIZE;
    const nextCursor =
      nextOffset < listing.entries.length
        ? `${cursor.page}.${nextOffset}`
        : null;
    return {
      offers: results.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : [],
      ),
      nextCursor:
        nextCursor ??
        (listing.next && cursor.page < 1000 ? `${cursor.page + 1}.0` : null),
      incomplete: results.some((result) => result.status === "rejected"),
    };
  };

  return { cities, page };
};

export const readCatalogQuery = (query: Record<string, unknown>) => {
  const { city, category, cursor = "1.0" } = query;
  if (
    typeof city !== "string" ||
    !/^[a-z][a-z0-9-]{1,60}$/.test(city) ||
    typeof category !== "string" ||
    !Object.hasOwn(categories, category) ||
    typeof cursor !== "string"
  )
    return;
  const match = cursor.match(/^([1-9]\d{0,3})\.(\d{1,2})$/);
  if (!match) return;
  const page = Number(match[1]);
  const offset = Number(match[2]);
  if (page > 1000 || offset % BATCH_SIZE !== 0) return;
  // The own-property check above guarantees the category map contains this key.
  const filters: CatalogFilters = {};
  for (const key of ["maxPrice", "maxWidth", "maxDepth", "maxHeight"] as const) {
    const value = query[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return;
    const parsed = Number(value);
    if (parsed < 0 || parsed > (key === "maxPrice" ? 1e9 : 20)) return;
    filters[key] = parsed;
  }
  if (query.material !== undefined) {
    if (typeof query.material !== "string" || !query.material.trim() || query.material.length > 45)
      return;
    filters.material = query.material;
  }
  return { city, category: category as Category, cursor: { page, offset }, filters };
};
