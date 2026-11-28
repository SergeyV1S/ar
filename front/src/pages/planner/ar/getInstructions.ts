import type { ARMode, Point, XRState } from "../types/index.ts";
import { maxCorners } from "./geometry.ts";

export const getInstructions = (
  mode: ARMode,
  origin: Point | null,
  {
    positioned,
    kind,
    count = 0,
    ready,
    closed,
    closing,
    arranging,
    itemId,
    searchingFurniture,
    analyzingFurniture,
    detectedItems,
    tracingItem
  }: XRState,
  pending: number
) => {
  if (mode === "view") {
    if (positioned)
      return "Мебель размещена. Обойдите её с камерой, поверните модель кнопкой или переставьте.";
    if (origin) return "Отметьте вторую точку вдоль стены вправо от начала плана.";
    return "Наведите прицел на угол пола, соответствующий началу плана.";
  }
  if (tracingItem) {
    if (tracingItem.heightStep) return "Наведите прицел на верх предмета и зафиксируйте высоту.";
    return "Отметьте углы основания по порядку. Затем задайте высоту предмета.";
  }
  if (searchingFurniture) {
    return analyzingFurniture
      ? "Обойдите объекты с нескольких сторон. Бирюзовые точки отмечают отсканированную поверхность."
      : "Наведите камеру на предмет и медленно двигайтесь, пока не появятся точки глубины.";
  }
  if (arranging) {
    if (!itemId && detectedItems?.length) {
      return "Выберите найденный предмет, чтобы поправить положение или обвести его.";
    }
    if (!itemId) return "Выберите предмет для расстановки или обведите новый объект.";
    if (!ready) return "Наведите прицел на свободное место внутри контура, где поместится предмет.";
    return "Подтвердите положение или поверните предмет.";
  }
  if (kind === "corner") {
    if (closed) return "Контур замкнут. Отметьте проёмы, расставьте мебель или сохраните комнату.";
    if (!count && !ready) return "Наведите камеру на пол и медленно подвигайте телефоном.";
    if (!count) return "Наведите прицел на стык стен с полом и отметьте первый угол.";
    if (closing) return "Прицел на первом углу. Замкните контур.";
    if (count >= maxCorners) return "Достигнут предел углов. Замкните контур.";
    return "Наведите прицел на следующий угол у пола. Закрепите стену, когда она появится.";
  }
  if (kind === "socket") return "Наведитесь на розетку или на пол прямо под ней.";
  if (pending) return "Отметьте второй край на той же стене.";
  return "Отметьте первый край у стены. Для двери начните со стороны петель.";
};
