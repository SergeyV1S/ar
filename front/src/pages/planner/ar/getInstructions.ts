import type { ARMode, Point } from "../types/index.ts";

export const getInstructions = (
  mode: ARMode,
  orientation: number | null,
  origin: Point | null,
  kind: string,
  corners: number,
  pending: number
) => {
  if (mode === "view") {
    if (orientation !== null)
      return "Мебель размещена. Обойдите её с камерой или переставьте модель.";
    if (origin) return "Отметьте вторую точку вдоль стены вправо от начала плана.";
    return "Отметьте на полу угол, соответствующий левому верхнему углу плана.";
  }
  if (kind === "corner") {
    return `Углов: ${corners}. Отмечайте углы по периметру, начиная с левого верхнего угла плана.`;
  }
  if (kind === "socket") return "Наведитесь на розетку или на пол прямо под ней.";
  if (pending) return "Отметьте второй край на той же стене.";
  return "Отметьте первый край у стены. Для двери начните со стороны петель.";
};
