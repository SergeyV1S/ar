import { suppressOverlaps, toImageBox } from "./boxes.ts";
import { furniture } from "./furnitureTypes.ts";
import queries from "./modelQueries.json" with { type: "json" };
import type { FurnitureMatch } from "./types.ts";

// Query order is fixed in the model. Null entries let background objects win over furniture.
const categories = Object.values(queries).map((key) => (key === null ? null : furniture[key]));

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
  const image = { left: 0, top: 0, width: widthRatio, height: heightRatio };
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
    const box = toImageBox(x, y, w, h, image);
    if (box) candidates.push({ ...category, score, box });
  }
  return suppressOverlaps(candidates);
};
