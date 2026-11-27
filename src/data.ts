import { arrange, dimensions, normalize, rect, round, validPolygon } from "./geometry.ts";
import type { EncryptedRecord, Item, Project, Protection, Room, VoicePatch } from "./types.ts";

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

export const initialProject = (): Project => {
  return {
    version: 1,
    room: {
      name: "Гостиная",
      points: rect(5.2, 3.8),
      source: "manual",
      verified: "review",
      openings: [
        { id: "window", type: "window", wall: 0, offset: 1.36, width: 2.42, hinge: "start" },
        { id: "door", type: "door", wall: 2, offset: 0.23, width: 0.9, hinge: "start" },
        { id: "socket", type: "socket", wall: 1, offset: 0.97, width: 0.08, hinge: "start" }
      ]
    },
    budget: 80000,
    material: materials[0],
    mode: "retail",
    passage: 0.8,
    variant: 0,
    items: [
      {
        id: "sofa",
        name: "Диван",
        kind: "sofa",
        w: 2.2,
        d: 0.9,
        h: 0.83,
        material: "Ткань",
        owned: true,
        source: "manual",
        verified: "review"
      },
      {
        id: "chair",
        name: "Кресло",
        kind: "chair",
        w: 0.76,
        d: 0.78,
        h: 0.81,
        material: "Ткань",
        owned: true,
        source: "manual",
        verified: "review"
      },
      ...catalog.map((item) => ({ ...item }))
    ],
    layouts: {},
    procurement: {}
  };
};

export const visibleItems = (project: Project) =>
  project.items.filter((item) => item.owned || item.mode === project.mode);
export const positionsFor = (project: Project, variant = project.variant) =>
  project.layouts[project.mode]?.[variant] ?? arrange(project.room, visibleItems(project), variant);
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const money = (value: number | string | undefined) =>
  `${Number(value).toLocaleString("ru-RU")} ₽`;
export const decimal = (value: number | string, digits = 1) =>
  Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
export const meters = (value: number | string, digits = 2) => `${decimal(value, digits)} м`;
export const centimeters = (value: number) => Math.round(value * 100);
export const itemSize = (item: Pick<Item, "w" | "d">) =>
  `${centimeters(item.w)} × ${centimeters(item.d)} см`;

export const safeUrl = (value: unknown) => {
  try {
    const parsed = new URL(String(value));
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};

export const purchaseIssues = (project: Project, item: Item) => {
  const problems = [];
  if ((item.cap ?? 0) > 0 && (item.price ?? 0) > (item.cap ?? 0))
    problems.push("Выше лимита позиции");
  if (
    project.material !== materials[0] &&
    !(item.materials ?? [item.material]).includes(project.material)
  )
    problems.push("Другой материал");
  return problems;
};

export const procurementMissing = (project: Project) => {
  const projectFields = Object.entries(procurementFields)
    .filter(
      ([key]) =>
        !String(project.procurement[key] ?? "").trim() ||
        (key === "offer" && !safeUrl(project.procurement[key]))
    )
    .map(([, label]) => label);
  const supplierFields = visibleItems(project)
    .filter((item) => !item.owned && (!item.seller || !item.details))
    .map((item) => `${item.name} — поставщик и реквизиты`);
  return [...projectFields, ...supplierFields];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const record = (value: unknown) => (isRecord(value) ? value : {});
const numeric = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const hasLabel = (labels: Record<string, string>, value: unknown): value is string =>
  typeof value === "string" && Object.hasOwn(labels, value);
const isPoint = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === 2 && value.every((v: unknown) => numeric(v, -35, 35));
type ImportItem = Record<string, unknown> & Pick<Item, "id" | "name" | "kind" | "w" | "d" | "h">;
const isImportItem = (item: unknown): item is ImportItem =>
  isRecord(item) &&
  typeof item.id === "string" &&
  typeof item.name === "string" &&
  hasLabel(types, item.kind) &&
  numeric(item.w, 0.05, 20) &&
  numeric(item.d, 0.05, 20) &&
  numeric(item.h, 0.05, 20) &&
  (item.owned === true || (hasLabel(modes, item.mode) && numeric(item.price, 0, 1e9)));

export const validateImport = (input: unknown): Project => {
  const raw = record(input);
  const room = record(raw.room);
  const items: unknown[] = Array.isArray(raw.items) ? raw.items : [];
  const rawPoints: unknown[] = Array.isArray(room.points) ? room.points : [];
  if (
    raw.version !== 1 ||
    typeof room.name !== "string" ||
    !Array.isArray(room.points) ||
    rawPoints.length > 32 ||
    !rawPoints.every(isPoint) ||
    !validPolygon(rawPoints) ||
    !Array.isArray(raw.items) ||
    items.length > 60 ||
    !items.every(isImportItem)
  )
    throw new Error("Это не похоже на файл проекта Метрики.");
  const points = normalize(rawPoints),
    extent = dimensions(points);
  if (
    extent.w > 35 ||
    extent.d > 35 ||
    !validPolygon(points) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new Error("Это не похоже на файл проекта Метрики.");
  const layouts = Object.fromEntries(
    Object.keys(modes).map((mode) => [
      mode,
      Object.fromEntries(
        [0, 1, 2].flatMap((index) => {
          const layout = record(record(raw.layouts)[mode])[index];
          if (!isRecord(layout)) return [];
          return [
            [
              index,
              Object.fromEntries(
                items.flatMap(({ id }) => {
                  const position = record(layout[id]);
                  return numeric(position.x, -35, 35) &&
                    numeric(position.y, -35, 35) &&
                    typeof position.r === "number" &&
                    [0, 90, 180, 270].includes(position.r)
                    ? [[id, { x: position.x, y: position.y, r: position.r }]]
                    : [];
                })
              )
            ]
          ];
        })
      )
    ])
  );
  const openings: unknown[] = Array.isArray(room.openings) ? room.openings : [];
  return {
    version: 1,
    room: {
      name: room.name.trim().slice(0, 80) || "Комната",
      points,
      source: hasLabel(sourceLabel, room.source) ? room.source : "import",
      verified: room.verified === "checked" ? "checked" : "review",
      openings: openings
        .filter(
          (
            o
          ): o is Record<string, unknown> & {
            type: string;
            wall: number;
            offset: number;
            width: number;
          } =>
            isRecord(o) &&
            typeof o.type === "string" &&
            ["door", "window", "socket"].includes(o.type) &&
            Number.isInteger(o.wall) &&
            numeric(o.wall, 0, points.length - 1) &&
            numeric(o.offset, 0, 35) &&
            numeric(o.width, 0.01, 35)
        )
        .slice(0, 40)
        .map((o) => ({
          id: newId(),
          wall: o.wall,
          offset: o.offset,
          width: o.width,
          type: o.type,
          hinge: o.hinge === "end" ? "end" : "start"
        }))
    },
    budget: numeric(raw.budget, 0, 1e9) ? raw.budget : 80000,
    passage: numeric(raw.passage, 0.45, 2) ? raw.passage : 0.8,
    material:
      typeof raw.material === "string" && materials.includes(raw.material)
        ? raw.material
        : materials[0],
    mode: hasLabel(modes, raw.mode) ? raw.mode : "retail",
    variant: typeof raw.variant === "number" && [0, 1, 2].includes(raw.variant) ? raw.variant : 0,
    items: items.map((item) => ({
      id: item.id,
      name: item.name.trim().slice(0, 100) || "Мебель",
      kind: item.kind,
      owned: item.owned === true,
      mode: typeof item.mode === "string" ? item.mode : undefined,
      w: item.w,
      d: item.d,
      h: item.h,
      price: Number(item.price) || 0,
      cap: numeric(item.cap, 0, 1e9) ? item.cap : 0,
      access: numeric(item.access, 0, 4) ? item.access : 0,
      url: safeUrl(item.url),
      material:
        typeof item.material === "string" && materials.includes(item.material)
          ? item.material
          : "Другое",
      seller: String(item.seller ?? "").slice(0, 120),
      sku: String(item.sku ?? "").slice(0, 120),
      details: String(item.details ?? "").slice(0, 500),
      materials: Array.isArray(item.materials)
        ? item.materials.filter(
            (value: unknown): value is string =>
              typeof value === "string" && materials.includes(value)
          )
        : undefined,
      availability: String(item.availability ?? "").slice(0, 200),
      source: hasLabel(sourceLabel, item.source) ? item.source : "import",
      verified: item.verified === "checked" ? "checked" : "review",
      illustration:
        typeof item.illustration === "string" &&
        ["table", "cabinet", "pouf"].includes(item.illustration)
          ? item.illustration
          : undefined,
      photo:
        typeof item.photo === "string" &&
        /^data:image\/(png|jpeg|webp);base64,/i.test(item.photo) &&
        item.photo.length <= 260000
          ? item.photo
          : undefined
    })),
    layouts,
    procurement: Object.fromEntries(
      Object.keys(procurementFields).map((key) => [
        key,
        String(record(raw.procurement)[key] ?? "").slice(0, 1500)
      ])
    )
  };
};

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
  const budget = input.match(/бюджет\s*(?:до\s*)?([\d\s]+(?:\.\d+)?)\s*(тыс[а-яё.]*)?/);
  if (budget) {
    const raw = budget[1].trim(),
      parts = raw.split(/\s+/).map(Number);
    const value =
      budget[2] && parts.length > 1 && parts[1] < 10
        ? parts.reduce((sum, part) => sum + part, 0)
        : Number(raw.replace(/\s/g, ""));
    if (Number.isFinite(value) && value * (budget[2] ? 1000 : 1) <= 1e9) {
      patch.budget = Math.round(value * (budget[2] ? 1000 : 1));
      notes.push(`Бюджет ${money(patch.budget)}`);
    }
  }
  const sofa = input.match(
    /диван\s*(\d+(?:\.\d+)?)(?:\s*(см|сантиметр[а-яё]*|м\b|метр[а-яё]*))?(?:\s*на\s*(\d+(?:\.\d+)?)\s*(см|сантиметр[а-яё]*|м\b|метр[а-яё]*)?)?/
  );
  if (sofa) {
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
  const mat = materials.slice(1).find((m) => input.includes(m.toLowerCase()));
  if (mat) {
    patch.material = mat;
    notes.push(`Материал: ${mat}`);
  }
  if (/тендер|служебн|закупк|\bкп\b/.test(input)) patch.mode = "office";
  if (/б\s*\/\s*у|авито|объявлени/.test(input)) patch.mode = "used";
  if (patch.mode) notes.push(modes[patch.mode]);
  return { patch, notes };
};

export const resizeRoom = (room: Room, width: number, depth: number) => {
  const old = dimensions(room.points);
  const points = room.points.map(([x, y]) => [
    round((x * width) / old.w),
    round((y * depth) / old.d)
  ]);
  return { ...room, points };
};

const storageKey = "metrika-project-v1";
const to64 = (data: Uint8Array<ArrayBuffer>) =>
  btoa(Array.from(data, (byte) => String.fromCharCode(byte)).join(""));
const from64 = (input: string) => Uint8Array.from(atob(input), (char) => char.charCodeAt(0));

const keyFor = async (password: string, salt: Uint8Array<ArrayBuffer>) => {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const readLocal = (): {
  project?: Project;
  locked?: EncryptedRecord;
  unreadable?: boolean;
} => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (isRecord(raw) && raw.encrypted) {
      if (
        typeof raw.salt !== "string" ||
        typeof raw.iv !== "string" ||
        typeof raw.body !== "string"
      )
        throw new Error("Повреждён зашифрованный проект.");
      return { locked: { encrypted: true, salt: raw.salt, iv: raw.iv, body: raw.body } };
    }
    return { project: raw ? validateImport(raw) : initialProject() };
  } catch {
    return { project: initialProject(), unreadable: true };
  }
};

export const newProtection = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt, key: await keyFor(password, salt) };
};

export const unlockLocal = async (record: EncryptedRecord, password: string) => {
  const salt = from64(record.salt),
    key = await keyFor(password, salt);
  const text = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: from64(record.iv) },
    key,
    from64(record.body)
  );
  return {
    protection: { key, salt },
    project: validateImport(JSON.parse(new TextDecoder().decode(text)))
  };
};

export const writeLocal = async (project: Project, protection: Protection | null) => {
  if (!protection) {
    localStorage.setItem(storageKey, JSON.stringify(project));
    return;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    protection.key,
    new TextEncoder().encode(JSON.stringify(project))
  );
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      encrypted: true,
      salt: to64(protection.salt),
      iv: to64(iv),
      body: to64(new Uint8Array(body))
    })
  );
};
