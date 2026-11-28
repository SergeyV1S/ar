import type { FurnitureMatch } from "./detections.ts";

export type ImageRotation = 0 | 90 | 180 | 270;

export type DetectionRequest = { id: number; bitmap: ImageBitmap; rotation: ImageRotation };
export type DetectionResponse = { id: number; matches: FurnitureMatch[] | null };
