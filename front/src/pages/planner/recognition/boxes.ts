import type { FurnitureBox, FurnitureMatch } from "./types.ts";

export type ImageBounds = { left: number; top: number; width: number; height: number };

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export const toImageBox = (
  x: number,
  y: number,
  w: number,
  h: number,
  image: ImageBounds
): FurnitureBox | null => {
  if (![x, y, w, h].every(Number.isFinite)) return null;
  const left = clampPercent(((x - w / 2 - image.left) * 100) / image.width);
  const top = clampPercent(((y - h / 2 - image.top) * 100) / image.height);
  const width = clampPercent(((x + w / 2 - image.left) * 100) / image.width) - left;
  const height = clampPercent(((y + h / 2 - image.top) * 100) / image.height) - top;
  return width >= 1 && height >= 1 ? [left, top, width, height] : null;
};

const overlap = ([ax, ay, aw, ah]: FurnitureBox, [bx, by, bw, bh]: FurnitureBox) => {
  const width = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const height = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  if (width <= 0 || height <= 0) return 0;
  const intersection = width * height;
  return intersection / (aw * ah + bw * bh - intersection);
};

export const suppressOverlaps = (candidates: FurnitureMatch[], classAware = false) => {
  const matches: FurnitureMatch[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    const duplicate = matches.some((match) => {
      if (classAware && match.title !== candidate.title) return false;
      return overlap(match.box, candidate.box) >= 0.45;
    });
    if (duplicate) continue;
    matches.push(candidate);
    if (matches.length >= 20) break;
  }
  return matches;
};
