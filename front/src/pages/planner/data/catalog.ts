import type { Item } from "../types/index.ts";

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

export const catalog: Item[] = [
  {
    id: "table",
    name: "Журнальный стол Дуэт",
    kind: "table",
    w: 0.6,
    d: 0.6,
    h: 0.5,
    price: 5099,
    material: "МДФ",
    materials: ["МДФ", "Металл"],
    seller: "Hoff",
    url: "https://hoff.ru/catalog/gostinaya/mebel_dlya_gostinykh/zhurnalnye_stoliki/zhurnalnyy_stol_duet_id10854534/?articul=80735302",
    availability: "Доступен для доставки по данным магазина",
    sku: "80735302"
  },
  {
    id: "cabinet",
    name: "Тумба ТВ Лофт 120",
    kind: "cabinet",
    w: 1.2,
    d: 0.37,
    h: 0.551,
    access: 0.4,
    price: 4999,
    material: "ЛДСП",
    seller: "Hoff",
    url: "https://hoff.ru/catalog/gostinaya/mebel_dlya_gostinykh/mebel_dlya_tv/tumba_pod_tv_loft_id9475227/?articul=80587346",
    availability: "Доступна для доставки по данным магазина",
    sku: "80587346"
  },
  {
    id: "pouf",
    name: "Пуф Керли",
    kind: "pouf",
    w: 0.41,
    d: 0.41,
    h: 0.43,
    price: 7990,
    material: "Букле",
    materials: ["Букле", "Ткань"],
    seller: "Диван.ру",
    url: "https://shop.divan.ru/products/puf-kerli-bukle-bejevyiy-108433",
    availability: "Уточнить на сайте магазина",
    sku: "108433"
  }
].map((item) => ({
  ...item,
  mode: "retail",
  owned: false,
  source: "catalog",
  verified: "review",
  illustration: item.kind
}));
