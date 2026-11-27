import { arHelp } from "../ar/index.ts";
import type { ARMode, Inspection, Opening } from "../types/index.ts";

export const getPlanStatus = (inspection: Inspection, passage: number) => {
  const warnings = inspection.warnings.length;
  if (warnings) return { className: "warning", icon: "alert", label: `Замечаний: ${warnings}` };
  if (inspection.state === "ok") {
    return {
      className: "",
      icon: "checkCircle",
      label: `Проход ≥ ${Math.round(passage * 100)} см`
    };
  }
  return { className: "neutral", icon: "info", label: "Укажите дверь" };
};

export const getOpeningWidth = (
  opening: Pick<Opening, "type"> & { width: string | number },
  type: string
) => {
  if (type === "socket") return 0.08;
  if (opening.type === "socket") return 0.8;
  return opening.width;
};

export const getARCollectLabel = (mode: ARMode | null, positioned?: boolean) => {
  if (mode === "scan") return "Поставить точку";
  if (positioned) return "Разместить заново";
  return "Отметить точку";
};

export const getPassageMessage = (inspection: Inspection, passage: number) => {
  if (inspection.state === "ok") {
    return `От двери до центра комнаты проходит маршрут шириной ${Math.round(passage * 100)} см.`;
  }
  if (inspection.state === "no-door") return "Добавьте дверь, чтобы проверить маршрут прохода.";
  return "Переместите мебель или попробуйте другой вариант расстановки.";
};

const thumbnailClasses = {
  table: "image-table",
  cabinet: "image-cabinet",
  pouf: "image-pouf"
} as const;

export const getThumbnailClass = (illustration?: string) => {
  const match = Object.entries(thumbnailClasses).find(([key]) => key === illustration);
  return match?.[1] ?? "image-placeholder";
};

export const getARAvailabilityMessage = (support: boolean | null) => {
  if (support === true) return "Разрешите камеру, когда браузер попросит доступ.";
  if (support === null) return "Проверяем поддержку дополненной реальности…";
  return arHelp;
};

export const getCatalogError = (cause: unknown) => {
  if (cause instanceof TypeError)
    return "Не удалось получить файл предложений. Проверьте подключение.";
  if (cause instanceof SyntaxError) return "Не удалось прочитать данные каталога.";
  if (cause instanceof Error) return cause.message;
  return "Ошибка чтения файла.";
};
