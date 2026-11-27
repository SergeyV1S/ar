import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { arHelp, startAR, supportsAR } from "../ar/index.ts";
import type { ARController } from "../ar/index.ts";
import type { ARMode, Item, Positions, Project, Room, XRState } from "../types/index.ts";

type Options = {
  project: Project;
  items: Item[];
  positions: Positions;
  close: () => void;
  openHelp: (mode: ARMode) => void;
  saveRoom: (room: Room, passage: number) => void;
  notify: (message: string) => void;
};

export const usePlannerAR = ({
  project,
  items: allItems,
  positions,
  close,
  openHelp,
  saveRoom,
  notify
}: Options) => {
  const [arSupport, setArSupport] = useState<boolean | null>(null),
    [arError, setArError] = useState("");
  const [xrMode, setXrMode] = useState<ARMode | null>(null),
    [xrState, setXrState] = useState<XRState>({});

  const overlay = useRef<HTMLDivElement>(null);
  const controller = useRef<ARController | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    supportsAR().then((supported) => {
      if (active) setArSupport(supported);
    });
    return () => {
      active = false;
      pending.current?.abort();
      pending.current = null;
      controller.current?.exit().catch(() => {});
    };
  }, []);

  const launchAR = async (mode: ARMode) => {
    if (pending.current || controller.current) return;
    const attempt = new AbortController();
    pending.current = attempt;
    flushSync(() => {
      setXrMode(mode);
      setXrState({});
      setArError("");
      close();
    });
    try {
      const root = overlay.current;
      if (!root) throw new Error(arHelp);
      let ended = false;
      const started = await startAR({
        mode,
        overlay: root,
        items: allItems,
        positions,
        onState: (state) => {
          if (!attempt.signal.aborted) setXrState(state);
        },
        onScan: (data) => {
          if (attempt.signal.aborted) return;
          saveRoom(
            {
              ...project.room,
              points: data.points,
              openings: data.openings,
              source: "xr",
              verified: "review"
            },
            project.passage
          );
          notify(
            data.skipped
              ? `Контур сохранён. Проёмов вдали от измеренных стен пропущено: ${data.skipped}.`
              : "Контур измерен. Проверьте размеры и проёмы на плане."
          );
        },
        onEnd: () => {
          ended = true;
          if (attempt.signal.aborted) return;
          controller.current = null;
          setXrMode(null);
        }
      });
      if (attempt.signal.aborted) {
        if (!ended) await started.exit().catch(() => {});
      } else if (!ended) {
        controller.current = started;
      }
    } catch (failure) {
      if (attempt.signal.aborted) return;
      controller.current = null;
      setXrMode(null);
      setArError(
        failure instanceof Error &&
          (failure.name === "NotAllowedError" || failure.name === "SecurityError")
          ? "Доступ к AR или камере не разрешён. Проверьте разрешения сайта."
          : `Не удалось запустить AR. ${arHelp}`
      );
      openHelp(mode);
    } finally {
      if (pending.current === attempt) pending.current = null;
    }
  };

  const controlAR = (method: keyof ARController, value?: string) => {
    Promise.resolve(controller.current?.[method]?.(value)).catch(() =>
      notify("Не удалось выполнить действие в AR.")
    );
  };

  const resetARError = () => setArError("");
  return { arSupport, arError, xrMode, xrState, overlay, launchAR, controlAR, resetARError };
};
