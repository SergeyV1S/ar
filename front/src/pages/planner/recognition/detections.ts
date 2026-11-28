import queries from "./modelQueries.json" with { type: "json" };

const furniture: Record<string, { kind: string; title: string }> = {
  chair: { kind: "stool", title: "Стул" },
  armchair: { kind: "chair", title: "Кресло" },
  table: { kind: "table", title: "Стол" },
  sofa: { kind: "sofa", title: "Диван" },
  bench: { kind: "other", title: "Скамья" },
  pouf: { kind: "pouf", title: "Пуф" },
  bed: { kind: "other", title: "Кровать" },
  wardrobe: { kind: "cabinet", title: "Шкаф" },
  cabinet: { kind: "cabinet", title: "Тумба" },
  dresser: { kind: "cabinet", title: "Комод" },
  shelving: { kind: "cabinet", title: "Стеллаж" },
  plant: { kind: "other", title: "Напольное растение" }
};

// Query order is fixed in the model. Null entries let background objects win over furniture.
const categories = Object.values(queries).map((key) => (key === null ? null : furniture[key]));

type Box = [left: number, top: number, width: number, height: number];

export type FurnitureMatch = {
  kind: string;
  title: string;
  score: number;
  box: Box;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const overlap = ([ax, ay, aw, ah]: Box, [bx, by, bw, bh]: Box) => {
  const width = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const height = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  if (width <= 0 || height <= 0) return 0;
  const intersection = width * height;
  return intersection / (aw * ah + bw * bh - intersection);
};

const bestClass = (logits: Float32Array, offset: number) => {
  let best = 0;
  for (let i = 1; i < categories.length; i++) {
    if (logits[offset + i] > logits[offset + best]) best = i;
  }
  return best;
};

export const decodeDetections = (
  logits: Float32Array,
  boxes: Float32Array,
  widthRatio: number,
  heightRatio: number
) => {
  const count = boxes.length / 4;
  if (!Number.isInteger(count) || count * categories.length !== logits.length) {
    throw new Error("Unexpected furniture model output");
  }
  const candidates: FurnitureMatch[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i * categories.length;
    const index = bestClass(logits, offset);
    const category = categories[index];
    const logit = logits[offset + index];
    if (!category || !Number.isFinite(logit)) continue;
    const score = 1 / (1 + Math.exp(-logit));
    if (score < 0.26) continue;
    const [x, y, w, h] = boxes.subarray(i * 4, i * 4 + 4);
    if (![x, y, w, h].every(Number.isFinite)) continue;
    const left = clampPercent(((x - w / 2) * 100) / widthRatio);
    const top = clampPercent(((y - h / 2) * 100) / heightRatio);
    const width = clampPercent(((x + w / 2) * 100) / widthRatio) - left;
    const height = clampPercent(((y + h / 2) * 100) / heightRatio) - top;
    if (width < 1 || height < 1) continue;
    candidates.push({ ...category, score, box: [left, top, width, height] });
  }
  const matches: FurnitureMatch[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (matches.some(({ box }) => overlap(box, candidate.box) >= 0.45)) continue;
    matches.push(candidate);
    if (matches.length >= 20) break;
  }
  return matches;
};
