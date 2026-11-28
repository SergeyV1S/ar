import type { ARMode, Point, XRState } from "../types/index.ts";
import { maxCorners } from "./geometry.ts";

export const getInstructions = (
  mode: ARMode,
  origin: Point | null,
  { positioned, kind, count = 0, ready, closed, closing }: XRState,
  pending: number
) => {
  if (mode === "view") {
    if (positioned)
      return "Мебель размещена. Обойдите её с камерой, поверните модель кнопкой или переставьте.";
    if (origin) return "Отметьте вторую точку вдоль стены вправо от начала плана.";
    return "Наведите прицел на угол пола, соответствующий началу плана.";
  }
  if (kind === "corner") {
    if (closed) return "Контур замкнут. Добавьте проёмы или сохраните комнату.";
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
