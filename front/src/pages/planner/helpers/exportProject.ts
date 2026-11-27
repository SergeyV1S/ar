import { decimal } from "../../../shared/helpers/index.ts";
import {
  checkLabel,
  modes,
  procurementFields,
  purchaseIssues,
  purchaseTotal,
  sourceLabel,
  visibleItems
} from "../data/index.ts";
import { variants } from "../planning/index.ts";
import type { Item, Positions, Project } from "../types/index.ts";

export const makeCsv = (project: Project, bought: Item[], positions: Positions) => {
  const items = visibleItems(project);
  const headers = [
    "Позиция",
    "Статус",
    "Ширина, м",
    "Глубина, м",
    "Высота, м",
    "Материал",
    "Цена, ₽",
    "Лимит позиции, ₽",
    "Поставщик",
    "Артикул",
    "Реквизиты",
    "Ссылка",
    "Наличие",
    "Источник",
    "Проверка",
    "Примечания"
  ];
  const rows = items.map((item) => [
    item.name,
    item.owned ? "Есть у пользователя" : "К покупке",
    decimal(item.w, 2),
    decimal(item.d, 2),
    decimal(item.h, 2),
    item.material,
    item.owned ? 0 : item.price,
    item.cap || "",
    item.seller ?? "",
    item.sku ?? "",
    item.details ?? "",
    item.url ?? "",
    item.availability ?? "",
    sourceLabel[item.source],
    checkLabel[item.verified],
    [
      ...(item.owned ? [] : purchaseIssues(project, item)),
      ...(positions[item.id] ? [] : ["Не размещено"])
    ].join(", ")
  ]);
  const total = purchaseTotal(bought);
  const csvField = (value: unknown) => {
    const entry = String(value ?? "");
    const safe =
      typeof value === "string" && /^[\t\n\r ]*[=+\-@]/.test(entry) ? `'${entry}` : entry;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const lines = [
    headers,
    ...rows,
    [],
    ["Комната", project.room.name],
    ["Способ закупки", modes[project.mode]],
    ["Вариант", variants[project.variant].title],
    ["Бюджет", project.budget],
    ["Итого", total],
    ["Разница", project.budget - total]
  ];
  if (project.mode === "office")
    lines.push(
      ...Object.entries(procurementFields).map(([key, title]) => [
        title,
        project.procurement[key] ?? ""
      ])
    );
  return "\uFEFF" + lines.map((line) => line.map(csvField).join(";")).join("\r\n");
};

export const getImportError = (error: unknown) => {
  if (error instanceof SyntaxError) return "Не удалось прочитать JSON проекта.";
  if (error instanceof Error) return error.message;
  return String(error);
};
