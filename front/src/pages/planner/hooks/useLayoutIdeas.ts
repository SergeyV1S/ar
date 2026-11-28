import { useEffect, useRef, useState } from "react";
import axios from "axios";

import { postPlannerLayouts } from "@/shared/api/requests";

import { getLayoutIdeasUpdate, getPlanningContext } from "../helpers/index.ts";
import type { Item, Positions, Project } from "../types/index.ts";

export const useLayoutIdeas = (
  project: Project, items: Item[], positions: Positions,
  update: (patch: Partial<Project>) => void, notify: (message: string) => void
) => {
  const active = useRef<AbortController | null>(null);
  const [requestProject, setRequestProject] = useState<Project>();
  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, [project]);

  const requestLayouts = async () => {
    if (active.current) return;
    if (!items.length) {
      notify("Добавьте мебель, чтобы подобрать расстановку.");
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setRequestProject(project);
    try {
      const suggestions = await postPlannerLayouts({
        params: getPlanningContext(project, items, positions, project.brief?.phrase ?? ""),
        config: { signal: controller.signal, timeout: 62_000 }
      });
      if (controller.signal.aborted) return;
      const next = getLayoutIdeasUpdate(project, items, positions, suggestions);
      if (!next) {
        notify("Для этих размеров и проходов не нашлось другого подходящего варианта.");
        return;
      }
      update(next);
      notify("Расстановки готовы. Сравните варианты и выберите подходящий.");
    } catch (error: unknown) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      notify(axios.isAxiosError(error) && error.response?.status === 429
        ? "GigaChat занят. Повторите через несколько секунд."
        : "Не удалось получить расстановки. Попробуйте ещё раз.");
    } finally {
      if (active.current === controller) {
        active.current = null;
        setRequestProject(undefined);
      }
    }
  };
  return { requestLayouts, proposingLayouts: requestProject === project };
};
