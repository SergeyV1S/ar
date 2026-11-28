import { meters, money, newId } from "../../../shared/helpers/index.ts";
import { describeCatalogVoice, readCatalogVoice, readVoiceBudget } from "../helpers/catalogVoice.ts";
import type { Project, VoicePatch } from "../types/index.ts";
import { materials, modes } from "./catalog.ts";
import { itemSize } from "./project.ts";

export const parseVoice = (phrase: string, project: Project) => {
  const words: Record<string, number> = {
    ноль: 0,
    один: 1,
    одна: 1,
    два: 2,
    две: 2,
    три: 3,
    четыре: 4,
    пять: 5,
    шесть: 6,
    семь: 7,
    восемь: 8,
    девять: 9,
    десять: 10,
    одиннадцать: 11,
    двенадцать: 12,
    тринадцать: 13,
    четырнадцать: 14,
    пятнадцать: 15,
    шестнадцать: 16,
    семнадцать: 17,
    восемнадцать: 18,
    девятнадцать: 19,
    двадцать: 20,
    тридцать: 30,
    сорок: 40,
    пятьдесят: 50,
    шестьдесят: 60,
    семьдесят: 70,
    восемьдесят: 80,
    девяносто: 90,
    сто: 100
  };
  const input = phrase
    .toLowerCase()
    .replace(/[а-яё]+/g, (word) => (Object.hasOwn(words, word) ? String(words[word]) : word))
    .replace(/,/g, (mark, i, str) =>
      /\d/.test(str[i - 1] ?? "") && /\d/.test(str[i + 1] ?? "") ? "." : mark
    );
  const patch: VoicePatch = {},
    notes = [];
  const size = input.match(
    /(?:комнат[ауы]|габарит[ы]?|размер[ы]?)\s*(\d+(?:\.\d+)?)\s*(?:на|[xх×*])\s*(\d+(?:\.\d+)?)/
  );
  if (size && [Number(size[1]), Number(size[2])].every((x) => x >= 0.7 && x <= 35)) {
    patch.size = [Number(size[1]), Number(size[2])];
    notes.push(`Комната ${meters(patch.size[0])} × ${meters(patch.size[1])}`);
  }
  const mat = materials.slice(1).find((material) => input.includes(material.toLowerCase()));
  const purchase = readCatalogVoice(input, materials.slice(1));
  const budgetPattern = purchase
    ? /бюджет\s+проекта\s*(?:до\s*)?([\d\s]+(?:\.\d+)?)\s*(тыс[а-яё.]*)?/
    : /бюджет\s*(?:до\s*)?([\d\s]+(?:\.\d+)?)\s*(тыс[а-яё.]*)?/;
  const budget = input.match(budgetPattern);
  if (budget) {
    const value = readVoiceBudget(budget[1], Boolean(budget[2]));
    if (value !== undefined) {
      patch.budget = value;
      notes.push(`Бюджет ${money(value)}`);
    }
  }
  if (purchase) {
    patch.purchase = purchase;
    notes.push(describeCatalogVoice(purchase));
  }
  const sofa = input.match(
    /диван\s*(\d+(?:\.\d+)?)(?:\s*(см|сантиметр[а-яё]*|м\b|метр[а-яё]*))?(?:\s*на\s*(\d+(?:\.\d+)?)\s*(см|сантиметр[а-яё]*|м\b|метр[а-яё]*)?)?/
  );
  if (sofa && purchase?.category !== "sofa") {
    const old = project.items.find((item) => item.owned && item.kind === "sofa");
    const dimension = (value: string, unit?: string) =>
      Number(value) / (unit?.startsWith("с") || Number(value) > 20 ? 100 : 1);
    const w = dimension(sofa[1], sofa[2]),
      d = sofa[3] ? dimension(sofa[3], sofa[4]) : (old?.d ?? 0.9);
    if (w >= 0.2 && w <= 20 && d >= 0.2 && d <= 20) {
      patch.sofa = {
        ...old,
        id: old?.id ?? newId(),
        name: old?.name ?? "Диван",
        kind: "sofa",
        owned: true,
        w,
        d,
        h: old?.h ?? 0.83,
        material: old?.material ?? "Ткань",
        source: "voice",
        verified: "review"
      };
      notes.push(`Диван ${itemSize(patch.sofa)}${sofa[3] ? "" : " (глубину проверьте)"}`);
    }
  }
  if (mat && !purchase) {
    patch.material = mat;
    notes.push(`Материал: ${mat}`);
  }
  if (/(?:новая|новую)\s+покупк/.test(input)) patch.mode = "retail";
  if (/тендер|служебн|закупк|\bкп\b/.test(input)) patch.mode = "office";
  if (/б\s*\/\s*у|авито|объявлени/.test(input)) patch.mode = "used";
  if (patch.mode) notes.push(modes[patch.mode]);
  return { patch, notes };
};
