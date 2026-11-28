import { isRecord } from "./isRecord.ts";

const wishCategories = ["chair", "armchair", "sofa", "table", "wardrobe", "cabinet", "pouf",
  "bed", "dresser", "shelving", "other"] as const;

export type FurnitureWish = {
  name: string;
  query: string;
  category: (typeof wishCategories)[number];
  quantity: number;
  material?: string;
  maxUnit?: number;
  maxTotal?: number;
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
  replaceId?: string;
};
export type LayoutAdvice = { variant: number; reason: string };
export type PlanAnalysis = {
  summary: string;
  wishes: FurnitureWish[];
  budget?: number;
  layout?: LayoutAdvice;
};

export const hasAnalysisText = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
export const boundedAnalysisNumber = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const optionalNumber = (value: unknown, min: number, max: number) =>
  value === undefined || boundedAnalysisNumber(value, min, max);

export const isFurnitureWish = (value: unknown): value is FurnitureWish =>
  isRecord(value) && hasAnalysisText(value.name, 100) && hasAnalysisText(value.query, 120) &&
  wishCategories.some((key) => key === value.category) &&
  Number.isInteger(value.quantity) && boundedAnalysisNumber(value.quantity, 1, 20) &&
  (value.material === undefined || hasAnalysisText(value.material, 45)) &&
  (value.replaceId === undefined || hasAnalysisText(value.replaceId, 150)) &&
  optionalNumber(value.maxUnit, 1, 1e9) && optionalNumber(value.maxTotal, 1, 1e9) &&
  optionalNumber(value.maxWidth, 0.05, 20) && optionalNumber(value.maxDepth, 0.05, 20) &&
  optionalNumber(value.maxHeight, 0.05, 20);

export const isLayoutAdvice = (value: unknown): value is LayoutAdvice =>
  isRecord(value) && [0, 1, 2].some((index) => index === value.variant) && hasAnalysisText(value.reason, 400);
