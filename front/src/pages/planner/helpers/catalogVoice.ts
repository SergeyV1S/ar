import { money } from "../../../shared/helpers/index.ts";
import { CATALOG_CATEGORIES } from "../types/index.ts";
import type { CatalogCategory, CatalogCriteria } from "../types/index.ts";

const categoryPatterns: Record<CatalogCategory, RegExp> = {
  chair: /(?:^|\s)(?:(\d+)\s+)?(?:стуль[яев]|стул(?:а|ов)?)(?=[^а-яё]|$)/u,
  armchair: /(?:^|\s)(?:(\d+)\s+)?(?:кресл[оа]|кресел)(?=[^а-яё]|$)/u,
  sofa: /(?:^|\s)(?:(\d+)\s+)?диван(?:а|ы|ов)?(?=[^а-яё]|$)/u,
  table: /(?:^|\s)(?:(\d+)\s+)?(?:стол|столик)(?:а|ы|ов)?(?=[^а-яё]|$)/u,
  wardrobe: /(?:^|\s)(?:(\d+)\s+)?шкаф(?:а|ы|ов)?(?=[^а-яё]|$)/u,
  cabinet: /(?:^|\s)(?:(\d+)\s+)?(?:тумб[ауые]?|тумбочек)(?=[^а-яё]|$)/u,
  pouf: /(?:^|\s)(?:(\d+)\s+)?пуф(?:а|ы|ов)?(?=[^а-яё]|$)/u
};

export const readVoiceBudget = (raw: string, thousands: boolean) => {
  const parts = raw.trim().split(/\s+/).map(Number);
  const number =
    thousands && parts.length === 2 && parts[1] < 10
      ? parts[0] + parts[1]
      : Number(raw.replace(/\s/g, ""));
  const rubles = Math.round(number * (thousands ? 1000 : 1));
  if (Number.isFinite(rubles) && rubles >= 0 && rubles <= 1e9) return rubles;
};

const readLimit = (input: string, label: string) => {
  const match = input.match(
    new RegExp(
      `${label}\\s*(?:до\\s*|не более\\s*|[:=]\\s*)?(\\d+(?:\\.\\d+)?)\\s*(см|сантиметр[а-яё]*|м(?![а-яё])|метр[а-яё]*)`,
      "u"
    )
  );
  if (match) return Number(match[1]) / (match[2].startsWith("с") ? 100 : 1);
};

export const readCatalogVoice = (
  input: string,
  materialOptions: string[]
): CatalogCriteria | undefined => {
  const explicit = input.match(
    /(?:^|[^а-яё])(?:купить|купи|покупк[ау]|подобрать|подбери|найти|найди|добавить|добавь)\s+(?!(?:свой|свою|свои|имеющ))/u
  );
  if (!explicit && /(?:добавить|добавь|поставить|поставь)\s+(?:свой|свою|свои|имеющ)/u.test(input))
    return;
  const intent = explicit ?? input.match(/(?:^|[^а-яё])(?:нужен|нужна|нужны|хочу)\s+/u);
  if (!intent) return;
  const purchaseClause = input.slice((intent.index ?? 0) + intent[0].length);
  const found = Object.entries(categoryPatterns)
    .flatMap(([category, pattern]) => {
      const match = purchaseClause.match(pattern);
      return match ? [{ category, match }] : [];
    })
    .sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0))[0];
  if (!found || !Object.hasOwn(CATALOG_CATEGORIES, found.category)) return;
  // These patterns are keyed by CatalogCategory and the key was checked above.
  const category = found.category as CatalogCategory;
  const itemClause = purchaseClause.slice((found.match.index ?? 0) + found.match[0].length);
  const after = itemClause.match(/^\s*(\d+)\s*(?:шт\.?|штук[аи]?)(?=[^а-яё]|$)/u)?.[1];
  const priceClause = itemClause.replace(
    /(?:ширин|глубин|высот)[а-яё]*\s*(?:до\s*|не более\s*|[:=]\s*)?\d+(?:\.\d+)?\s*(?:сантиметр[а-яё]*|метр[а-яё]*|см|м)(?=[^а-яё]|$)/gu,
    ""
  );
  const limit = priceClause.match(
    /(?:бюджет(?!\s+проекта)|до|не дороже)\s*(?:до\s*)?(\d+(?:[ ]\d{3})*(?:\.\d+)?)\s*(тыс[а-яё.]*)?\s*(?:руб[а-яё.]*|₽)?\s*(за\s+(?:штуку|единицу)|\/шт\.?)?(?=[^а-яё\d]|$)/u
  );
  const budget = limit ? readVoiceBudget(limit[1], Boolean(limit[2])) : undefined;
  return {
    category,
    quantity: Number(found.match[1] ?? after ?? 1),
    maxTotal: limit?.[3] ? undefined : budget,
    maxUnit: limit?.[3] ? budget : undefined,
    material: materialOptions.find((material) => purchaseClause.includes(material.toLowerCase())),
    maxWidth: readLimit(itemClause, "ширин(?:ой|а|у)"),
    maxDepth: readLimit(itemClause, "глубин(?:ой|а|у)"),
    maxHeight: readLimit(itemClause, "высот(?:ой|а|у)")
  };
};

export const describeCatalogVoice = (criteria: CatalogCriteria) => {
  const name = CATALOG_CATEGORIES[criteria.category];
  const count = `${criteria.quantity} шт.`;
  if (criteria.maxUnit !== undefined)
    return `Подбор: ${name}, ${count}, до ${money(criteria.maxUnit)} за шт.`;
  if (criteria.maxTotal !== undefined)
    return `Подбор: ${name}, ${count}, до ${money(criteria.maxTotal)} за всё`;
  return `Подбор: ${name}, ${count}`;
};
