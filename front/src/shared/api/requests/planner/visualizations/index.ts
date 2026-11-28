import type { ApiRequest } from "@/shared/api";
import { api } from "@/shared/api/instance";

import type { PlannerContextInput } from "../analysis/index.ts";

export type PlannerVisualizationInput = {
  plan: PlannerContextInput;
  roomPhoto?: string;
  references: { itemIds: string[]; photo: string }[];
};

export const postPlannerVisualization = async (
  { params, config }: ApiRequest<PlannerVisualizationInput>
) => {
  const { data } = await api.post<unknown>("/planner/visualizations", params, {
    ...config,
    responseType: "blob",
    timeout: 135_000
  });
  if (!(data instanceof Blob) || !data.size || !["image/jpeg", "image/png"].includes(data.type)) {
    throw new Error("Некорректный результат визуализации");
  }
  return data;
};
