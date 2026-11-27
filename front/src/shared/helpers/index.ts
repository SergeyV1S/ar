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
export const safeUrl = (value: unknown) => {
  try {
    const parsed = new URL(String(value));
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const readNumber = (data: FormData, key: string) => Number(data.get(key));
export const readText = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
export const download = (name: string, content: string, type: string) => {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type }));
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
