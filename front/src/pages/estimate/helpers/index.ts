import axios from "axios";

import type { Item } from "@/pages/planner/types";

export const getVisualizationError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return "Не удалось получить изображение. Попробуйте ещё раз.";
  if (error.response?.status === 429) return "GigaChat занят. Повторите чуть позже.";
  if (error.response?.status === 503) return "Генерация сейчас недоступна.";
  if (error.response?.status === 504 || error.code === "ECONNABORTED")
    return "Генерация заняла слишком много времени. Попробуйте ещё раз.";
  return "Не удалось получить изображение. Попробуйте ещё раз.";
};

export const getVisualizationReferences = (items: Item[]) => {
  const references = new Map<string, string[]>();
  for (const { id, photo } of items) {
    if (!photo) continue;
    const ids = references.get(photo);
    if (ids) ids.push(id);
    else if (references.size < 9) references.set(photo, [id]);
  }
  return [...references].map(([photo, itemIds]) => ({ photo, itemIds }));
};
