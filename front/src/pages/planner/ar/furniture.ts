import { bounds } from "../planning/index.ts";
import type { Item, Point, Positions } from "../types/index.ts";
import type { FurnitureInstance, FurnitureModelLookup } from "./furnitureModels/index.ts";
import { createMesh, rgb } from "./mesh.ts";

const blockColor = rgb("#b6a5cf");

export const furnitureMesh = (
  items: Item[],
  positions: Positions,
  getModel?: FurnitureModelLookup
) => {
  const solid: number[] = [];
  const glass: number[] = [];
  const models: FurnitureInstance[] = [];
  for (const item of items) {
    const pos = positions[item.id];
    if (!pos) continue;
    const { w, d, h } = item;
    const box = bounds(item, pos);
    const angle = (pos.r * Math.PI) / 180;
    const cx = box.x + box.w / 2;
    const cz = box.y + box.d / 2;
    const model = getModel?.(item);
    if (model && w > 0 && d > 0 && h > 0) {
      models.push({ model, center: [cx, cz], size: [w, h, d], angle });
      const shadow = createMesh();
      for (let layer = 0; layer < 3; layer++) {
        const grow = 0.05 * layer;
        shadow.quad(
          [box.x - grow, 0.003, box.y - grow],
          [box.x + box.w + grow, 0.003, box.y - grow],
          [box.x + box.w + grow, 0.003, box.y + box.d + grow],
          [box.x - grow, 0.003, box.y + box.d + grow],
          [0.16, 0.1, 0.22],
          0.16 - layer * 0.045
        );
      }
      glass.push(...shadow.finish().glass);
      continue;
    }

    const block = createMesh();
    block.box(0, 0, 0, w, h, d, blockColor);
    const vertices = block.finish().solid;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = 0; i < vertices.length; i += 7) {
      const x = vertices[i] - w / 2;
      const z = vertices[i + 2] - d / 2;
      solid.push(
        cx + x * cos - z * sin,
        vertices[i + 1],
        cz + x * sin + z * cos,
        vertices[i + 3],
        vertices[i + 4],
        vertices[i + 5],
        vertices[i + 6]
      );
    }
  }
  return { solid: new Float32Array(solid), glass: new Float32Array(glass), models };
};

export const itemCenter = (item: Item, positions: Positions): Point | null => {
  const pos = positions[item.id];
  if (!pos) return null;
  const box = bounds(item, pos);
  return [box.x + box.w / 2, item.h, box.y + box.d / 2];
};
