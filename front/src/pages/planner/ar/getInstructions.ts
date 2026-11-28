import type { ARMode, Point, XRState } from "../types/index.ts";
import { maxCorners } from "./geometry.ts";
import { traceInstructions } from "./itemTrace.ts";

export const getInstructions = (
  mode: ARMode,
  origin: Point | null,
  { positioned, kind, count = 0, ready, closed, closing, arranging, itemId, finding, traceStep }: XRState,
  pending: number
) => {
  if (mode === "view") {
    if (positioned)
      return "Выберите предмет или весь план для поворота.";
    if (origin) return "Отметьте вторую точку вдоль стены вправо от начала плана.";
    return "Наведите прицел на угол пола, соответствующий началу плана.";
  }
  if (finding)
    return "Покажите мебель с двух сторон. 3D-модели появятся после завершения поиска.";
  if (traceStep !== undefined) return traceInstructions[traceStep];
  if (arranging) {
    if (!itemId) return "Выберите предмет. Чтобы передвинуть мебель, выберите её снова.";
    if (!ready) return "Наведите прицел на свободное место внутри контура, где поместится предмет.";
    return "Подтвердите положение или поверните предмет.";
  }
  if (kind === "corner") {
    if (closed) return "Найдите мебель камерой, выделите её вручную или отметьте проёмы.";
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
