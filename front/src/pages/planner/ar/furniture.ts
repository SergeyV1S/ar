import { bounds } from "../planning/index.ts";
import type { Item, Point, Positions } from "../types/index.ts";
import { createMesh, rgb } from "./mesh.ts";
import type { Mesh } from "./renderer.ts";

const palette: Record<string, string> = {
  sofa: "#d7c6af",
  chair: "#a6b18e",
  table: "#c89567",
  cabinet: "#bf9873",
  pouf: "#d5c2e5",
  other: "#b6a5cf"
};
const wood = rgb("#5b453a");
const darkWood = rgb("#43342c");
const metal = rgb("#6d6a72");
const cushion = rgb("#f0e6d8");

const sofa = (m: ReturnType<typeof createMesh>, w: number, h: number, d: number, dye: number[]) => {
  const color = dye as [number, number, number];
  const arm = Math.min(w * 0.14, 0.24);
  const backDepth = Math.min(d * 0.24, 0.28);
  const legHeight = Math.min(h * 0.11, 0.14);
  m.box(0, legHeight, 0, w, h * 0.2, d, color);
  m.box(0, legHeight + h * 0.2, 0, w, h * 0.62, backDepth, color);
  m.box(0, legHeight + h * 0.24, backDepth, arm, h * 0.36, d - backDepth, color);
  m.box(w - arm, legHeight + h * 0.24, backDepth, arm, h * 0.36, d - backDepth, color);
  const seats = Math.max(1, Math.round(w / 0.72));
  const seatWidth = (w - arm * 2) / seats;
  for (let i = 0; i < seats; i++)
    m.box(
      arm + i * seatWidth + 0.008,
      legHeight + h * 0.2,
      backDepth + 0.02,
      seatWidth - 0.016,
      h * 0.16,
      d - backDepth - 0.04,
      color
    );
  for (const x of [w * 0.08, w * 0.92])
    for (const z of [d * 0.12, d * 0.88]) {
      m.cylinder(x, 0, z, 0.026, 0.026, legHeight, darkWood, 8);
    }
  m.box(w * 0.32, legHeight + h * 0.36, backDepth + 0.03, w * 0.36, h * 0.2, d * 0.18, cushion);
};

const chair = (m: ReturnType<typeof createMesh>, w: number, h: number, d: number, dye: number[]) => {
  const color = dye as [number, number, number];
  const legHeight = Math.min(h * 0.42, 0.44);
  m.box(0, legHeight, 0, w, h * 0.09, d, color);
  m.box(0, legHeight + h * 0.09, 0, w, h * 0.42, Math.min(d * 0.18, 0.1), color);
  for (const x of [w * 0.08, w * 0.92])
    for (const z of [d * 0.1, d * 0.9])
      m.cylinder(x, 0, z, Math.min(w, d) * 0.035, Math.min(w, d) * 0.035, legHeight, wood, 8);
};

const table = (m: ReturnType<typeof createMesh>, w: number, h: number, d: number, dye: number[]) => {
  const color = dye as [number, number, number];
  const top = Math.max(h * 0.07, 0.035);
  const columns = w > 1.1 ? 4 : 3;
  m.cylinder(w / 2, h - top, d / 2, w / 2, d / 2, top, color, 32);
  m.cylinder(
    w / 2,
    h - top - 0.012,
    d / 2,
    w / 2 - 0.02,
    d / 2 - 0.02,
    0.012,
    wood,
    32
  );
  if (w > 1.1) {
    for (const x of [w * 0.14, w * 0.86])
      for (const z of [d * 0.2, d * 0.8])
        m.cylinder(x, 0, z, 0.026, 0.026, h - top, wood, 10);
  } else {
    for (let i = 0; i < columns; i++) {
      const angle = (i * Math.PI * 2) / columns;
      m.cylinder(
        w / 2 + Math.cos(angle) * w * 0.31,
        0,
        d / 2 + Math.sin(angle) * d * 0.31,
        0.024,
        0.024,
        h - top,
        wood,
        10
      );
    }
  }
};

const cabinet = (m: ReturnType<typeof createMesh>, w: number, h: number, d: number, dye: number[]) => {
  const color = dye as [number, number, number];
  const plinth = Math.min(h * 0.06, 0.08);
  m.box(0, plinth, 0, w, h - plinth, d, color);
  m.box(-0.02, 0, -0.02, w + 0.04, plinth, d + 0.04, darkWood);
  const doorWidth = w / 2 - 0.02;
  for (let i = 0; i < 2; i++) {
    const x = 0.008 + i * (w / 2);
    m.box(x, plinth + 0.02, d, doorWidth, h * 0.86, 0.016, color);
    m.box(x + 0.008, plinth + 0.03, d + 0.016, doorWidth - 0.016, h * 0.85 - 0.02, 0.006, cushion);
    m.cylinder(x + doorWidth - 0.035, plinth + h * 0.5, d + 0.03, 0.008, 0.008, 0.1, metal, 8);
  }
};

const pouf = (m: ReturnType<typeof createMesh>, w: number, h: number, d: number, dye: number[]) => {
  const color = dye as [number, number, number];
  m.cylinder(w / 2, 0.012, d / 2, w / 2, d / 2, h - 0.012, color, 28);
  m.cylinder(w / 2, h - 0.02, d / 2, w / 2 * 0.96, (d / 2) * 0.96, 0.02, color, 28);
  m.cylinder(w / 2, 0.02, d / 2, w / 2 * 0.93, (d / 2) * 0.93, 0.006, cushion, 28);
};

const generic = (m: ReturnType<typeof createMesh>, w: number, h: number, d: number, dye: number[]) => {
  const color = dye as [number, number, number];
  m.box(0, 0, 0, w, h, d, color);
  m.box(-0.004, h, -0.004, w + 0.008, 0.008, d + 0.008, darkWood);
};

const shapeOf = (item: Item) => {
  const dye = rgb(palette[item.kind] ?? palette.other) as [number, number, number];
  const { w, d, h } = item;
  const m = createMesh();
<<<<<<< HEAD
  if (item.arMesh) {
    meshTriangles(localMeshPoints(item), item.arMesh.indices).forEach(([a, b, c]) =>
      m.tri(a, b, c, dye)
    );
  } else if (item.arFootprint)
    itemVolume(
      m,
      item.arFootprint.map(([x, z]) => [x * w, 0, z * d]),
      h,
      dye
    );
  else if (item.kind === "sofa") sofa(m, w, h, d, dye);
  else if (item.kind === "chair" || item.kind === "stool") chair(m, w, h, d, dye);
=======
  if (item.kind === "sofa") sofa(m, w, h, d, dye);
  else if (item.kind === "chair") chair(m, w, h, d, dye);
>>>>>>> parent of 340b4d0 (ar update)
  else if (item.kind === "table") table(m, w, h, d, dye);
  else if (item.kind === "cabinet") cabinet(m, w, h, d, dye);
  else if (item.kind === "pouf") pouf(m, w, h, d, dye);
  else generic(m, w, h, d, dye);
  return m.finish();
};

export const furnitureMesh = (items: Item[], positions: Positions): Mesh => {
  const solid: number[] = [];
  const glass: number[] = [];
  for (const item of items) {
    const pos = positions[item.id];
    if (!pos) continue;
    const { w, d } = item;
    const box = bounds(item, pos);
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
    const shade = shadow.finish();
    glass.push(...shade.glass);
    const angle = (pos.r * Math.PI) / 180;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const cx = box.x + box.w / 2,
      cz = box.y + box.d / 2;
    const local = shapeOf(item);
    for (const [data, target] of [
      [local.solid, solid],
      [local.glass, glass]
    ] as const) {
      for (let i = 0; i < data.length; i += 7) {
        const x = data[i] - w / 2,
          z = data[i + 2] - d / 2;
        target.push(
          cx + x * cos - z * sin,
          data[i + 1],
          cz + x * sin + z * cos,
          data[i + 3],
          data[i + 4],
          data[i + 5],
          data[i + 6]
        );
      }
    }
  }
  return { solid: new Float32Array(solid), glass: new Float32Array(glass) };
};

export const itemCenter = (item: Item, positions: Positions): Point | null => {
  const pos = positions[item.id];
  if (!pos) return null;
  const box = bounds(item, pos);
  return [box.x + box.w / 2, item.h, box.y + box.d / 2];
};
