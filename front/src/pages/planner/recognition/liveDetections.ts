import { suppressOverlaps, toImageBox } from "./boxes.ts";
import type { ImageBounds } from "./boxes.ts";
import { furniture } from "./furnitureTypes.ts";
import type { FurnitureMatch } from "./types.ts";

// Class indices in the Ultralytics COCO export.
const furnitureByClass = new Map([
  [13, furniture.bench],
  [56, furniture.chair],
  [57, furniture.sofa],
  [58, furniture.plant],
  [59, furniture.bed],
  [60, furniture.table]
]);

const classCount = 80;
const boxChannels = 4;
const confidence = Math.fround(0.45);
export const liveOutputChannels = boxChannels + classCount;

export const decodeLiveDetections = (output: Float32Array, image: ImageBounds) => {
  const anchors = output.length / liveOutputChannels;
  if (!Number.isInteger(anchors)) throw new Error("Unexpected YOLO11n output size");

  const candidates: FurnitureMatch[] = [];
  for (let i = 0; i < anchors; i++) {
    let bestClass = -1;
    let score = -Infinity;
    for (let category = 0; category < classCount; category++) {
      const candidate = output[(boxChannels + category) * anchors + i];
      if (candidate <= score || !Number.isFinite(candidate)) continue;
      bestClass = category;
      score = candidate;
    }

    const furnitureType = furnitureByClass.get(bestClass);
    if (!furnitureType || score < confidence) continue;
    const box = toImageBox(
      output[i],
      output[anchors + i],
      output[2 * anchors + i],
      output[3 * anchors + i],
      image
    );
    if (box) candidates.push({ ...furnitureType, score, box });
  }

  return suppressOverlaps(candidates, true);
};
