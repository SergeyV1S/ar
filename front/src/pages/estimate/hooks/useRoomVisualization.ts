import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";

import { getPlanningContext } from "@/pages/planner/helpers";
import { usePlannerContext } from "@/pages/planner/hooks";
import { postPlannerVisualization } from "@/shared/api/requests";

import { getVisualizationError, getVisualizationReferences } from "../helpers";

type Preview = { url: string; extension: "png" | "jpg" };

export const useRoomVisualization = () => {
  const { project, allItems, positions, update } = usePlannerContext();
  const { room, passage } = project;
  const placed = useMemo(() => allItems.filter(({ id }) => Object.hasOwn(positions, id)), [allItems, positions]);
  const plan = useMemo(() => ({ room, passage, positions, placed }), [room, passage, positions, placed]);
  const [preview, setPreview] = useState<{ plan: typeof plan; image: Preview }>();
  const [request, setRequest] = useState<{ plan: typeof plan; error?: string }>();
  const active = useRef<AbortController | null>(null);
  const resultUrl = useRef<string | undefined>(undefined);

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = undefined;
  }, [plan]);

  const changePhoto = (photo: string | undefined) => update({ room: { ...room, photo } });
  const removePhoto = () => changePhoto(undefined);
  const canGenerate = Boolean(room.photo || placed.length);
  const generate = async () => {
    if (!canGenerate || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setRequest({ plan });
    try {
      const image = await postPlannerVisualization({
        params: {
          plan: getPlanningContext(project, placed, positions, ""),
          roomPhoto: room.photo,
          references: getVisualizationReferences(placed)
        },
        config: { signal: controller.signal }
      });
      if (controller.signal.aborted) return;
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      const url = URL.createObjectURL(image);
      resultUrl.current = url;
      setPreview({ plan, image: { url, extension: image.type === "image/png" ? "png" : "jpg" } });
      setRequest(undefined);
    } catch (error: unknown) {
      if (!controller.signal.aborted && !axios.isCancel(error))
        setRequest({ plan, error: getVisualizationError(error) });
    } finally {
      if (active.current === controller) active.current = null;
    }
  };

  return {
    photo: room.photo,
    changePhoto,
    removePhoto,
    canGenerate,
    generate,
    busy: request?.plan === plan && request.error === undefined,
    error: request?.plan === plan ? request.error : undefined,
    preview: preview?.plan === plan ? preview.image : undefined
  };
};
