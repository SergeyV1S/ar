import type { CheerioAPI } from "cheerio";

type JsonObject = Record<string, unknown>;

const readObject = (value: unknown): JsonObject => {
  if (value && typeof value === "object" && !Array.isArray(value))
    return { ...value };
  return {};
};

const readArray = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.map(readObject) : [];

const findVariant = (
  value: unknown,
  sku: string,
  path: string,
): JsonObject | undefined => {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findVariant(entry, sku, path);
      if (result) return result;
    }
    return;
  }
  const properties = readObject(value);
  if (
    String(properties.id) === sku &&
    properties.link === path &&
    Array.isArray(properties.parameters) &&
    Array.isArray(properties.parameterValues)
  )
    return properties;
  for (const child of Object.values(properties)) {
    const result = findVariant(child, sku, path);
    if (result) return result;
  }
};

export const getPublishedDimensions = (
  $: CheerioAPI,
  sku: string,
  path: string,
) => {
  // Read the JSON already embedded in the product page. The scripts are never executed.
  const data = $("script:not([src])")
    .toArray()
    .flatMap((node) =>
      [
        ...$(node)
          .text()
          .matchAll(
            /self\.__next_f\.push\(\[1,("[^"\\]*(?:\\[\s\S][^"\\]*)*")\]\)/g,
          ),
      ].map((match): string => JSON.parse(match[1])),
    )
    .join("");
  for (const row of data.split("\n")) {
    const json = row.match(/^[0-9a-f]+:([\[{].*)$/)?.[1];
    if (!json) continue;
    let value: unknown;
    try {
      value = JSON.parse(json);
    } catch {
      continue;
    }
    const variant = findVariant(value, sku, path);
    if (!variant) continue;
    const names = readArray(variant.parameters);
    const units = readArray(variant.units);
    const sizes = new Map<string, number>();
    readArray(variant.parameterValues).forEach((attribute) => {
      const label = names.find(({ id }) => id === attribute.parameterId)?.title;
      const unit = units.find(({ id }) => id === attribute.unitId)?.title;
      if (
        typeof label !== "string" ||
        typeof unit !== "string" ||
        unit.trim() !== "см" ||
        !Array.isArray(attribute.value) ||
        attribute.value.length !== 1 ||
        typeof attribute.value[0] !== "number"
      )
        return;
      sizes.set(label, attribute.value[0] / 100);
    });
    return sizes;
  }
  return new Map<string, number>();
};
