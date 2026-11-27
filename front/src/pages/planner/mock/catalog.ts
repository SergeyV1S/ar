import type { Item } from "../types/index.ts";
import mockOffers from "./mock-offers.json" with { type: "json" };

export const materials = [
  "Любой материал",
  "ЛДСП",
  "МДФ",
  "Массив",
  "Металл",
  "Ткань",
  "Букле",
  "Стекло",
  "Другое"
];
export const modes: Record<string, string> = {
  retail: "Новая покупка",
  used: "Б/у объявления",
  office: "Служебная закупка"
};
export const types: Record<string, string> = {
  sofa: "Диван",
  chair: "Кресло",
  table: "Стол",
  cabinet: "Шкаф / тумба",
  pouf: "Пуф",
  other: "Другая мебель"
};
export const sourceLabel: Record<string, string> = {
  manual: "Ручной ввод",
  xr: "AR-обмер",
  photo: "Разметка по фото",
  voice: "Голосовой ввод",
  catalog: "Каталог магазина",
  import: "Импорт"
};
export const checkLabel: Record<string, string> = {
  checked: "Проверено",
  review: "Требует проверки"
};
export const procurementFields: Record<string, string> = {
  purpose: "Назначение помещения",
  person: "Ответственный",
  article: "Статья бюджета",
  reason: "Обоснование выбора поставщика",
  offer: "Ссылка на коммерческое предложение"
};

export const catalog: Item[] = mockOffers.filter((item) => item.mode === "retail");
