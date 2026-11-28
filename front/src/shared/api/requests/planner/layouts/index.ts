import type { ApiRequest } from "@/shared/api";
import { api } from "@/shared/api/instance";
import { boundedAnalysisNumber, isRecord } from "@/shared/helpers";

import type { PlannerContextInput } from "../analysis/index.ts";

export type PlannerLayoutIdea = {
  title: string;
  reason: string;
  positions: { id: string; x: number; y: number; r: number }[];
};

const isPosition = (value: unknown): value is PlannerLayoutIdea["positions"][number] =>
  isRecord(value) && typeof value.id === "string" && value.id.length > 0 &&
  boundedAnalysisNumber(value.x, -35, 35) && boundedAnalysisNumber(value.y, -35, 35) &&
  boundedAnalysisNumber(value.r, 0, 360);

const isIdea = (value: unknown): value is PlannerLayoutIdea =>
  isRecord(value) && typeof value.title === "string" && value.title.length > 0 && value.title.length <= 65 &&
  typeof value.reason === "string" && value.reason.length <= 220 &&
  Array.isArray(value.positions) && value.positions.length > 0 && value.positions.length <= 60 &&
  value.positions.every(isPosition);

export const postPlannerLayouts = async ({ params, config }: ApiRequest<PlannerContextInput>) => {
  const { data } = await api.post<unknown>("/planner/layouts", params, config);
  if (!isRecord(data) || !Array.isArray(data.options) || data.options.length > 3 || !data.options.every(isIdea))
    throw new Error("Некорректный ответ о расстановках");
  return data.options;
};
