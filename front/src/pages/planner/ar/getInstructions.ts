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
      return "Мебель размещена. Обойдите её с камерой, поверните модель кнопкой или переставьте.";
    if (origin) return "Отметьте вторую точку вдоль стены вправо от начала плана.";
    return "Отметьте на полу угол, соответствующий левому верхнему углу плана.";
  }
  if (kind === "corner") {
    if (corners === 0) return "Начните с левого верхнего угла плана. Двигайте телефон медленно.";
    if (corners < 3) return `Углов: ${corners}. Продолжайте обход по периметру против часовой стрелки.`;
    return `Углов: ${corners}. Вернитесь к первому углу, чтобы замкнуть контур, или продолжайте обход.`;
  }
  if (kind === "socket") return "Наведитесь на розетку или на пол прямо под ней.";
  if (pending) return "Отметьте второй край на той же стене.";
  return "Отметьте первый край у стены. Для двери начните со стороны петель.";
};
