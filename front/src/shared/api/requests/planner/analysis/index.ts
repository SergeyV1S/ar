import type { ApiRequest } from "@/shared/api";
import { api } from "@/shared/api/instance";
import { boundedAnalysisNumber, hasAnalysisText, isFurnitureWish, isLayoutAdvice, isRecord } from "@/shared/helpers";
import type { PlanAnalysis } from "@/shared/helpers";
type Params = {
  phrase: string;
  room: { points: number[][]; openings: { type: string; wall: number; offset: number; width: number }[] };
  items: { id: string; name: string; kind: string; owned: boolean; material: string;
    w: number; d: number; h: number; position?: { x: number; y: number; r: number } }[];
  passage: number;
  budget: number;
};

export const postPlannerAnalysis = async ({ params, config }: ApiRequest<Params>): Promise<PlanAnalysis> => {
  const { data } = await api.post<unknown>("/planner/analysis", params, config);
  if (!isRecord(data) || typeof data.summary !== "string" || !hasAnalysisText(data.summary, 600) ||
    !Array.isArray(data.wishes) || data.wishes.length > 10 || !data.wishes.every(isFurnitureWish) ||
    !(data.budget === undefined || typeof data.budget === "number" && boundedAnalysisNumber(data.budget, 0, 1e9)) ||
    (data.layout !== undefined && !isLayoutAdvice(data.layout)))
    throw new Error("Некорректный ответ GigaChat");
  return { summary: data.summary, wishes: data.wishes, budget: data.budget, layout: data.layout };
};
