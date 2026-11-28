import { decimal } from "../../../shared/helpers/index.ts";
import type {
  Box,
  Inspection,
  Item,
  Point,
  Position,
  Positions,
  Project,
  Room
} from "../types/index.ts";
import { bounds, corners, dimensions, itemFootprint, wallFeature } from "./geometry.ts";
import { localMeshPoints, meshTriangles, planMeshPoints } from "./scannedMesh.ts";

type Paint = string | CanvasGradient | CanvasPattern;
type Projection = (point: Point, z?: number) => Point;
type Entry = { item: Item; pos: Position; box: Box };
export type Target = {
  item: Item;
  box: Box;
  polygon?: Point[];
  front?: Point[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};
export type Drawing = { targets: Target[]; scale: number; to: Projection };

const timber = ["#eee5d9", "#f0e8de", "#eae0d4", "#eee4d8", "#f3ebe1"];
const purple = "#7546e8";
const palette: Record<string, string> = {
  sofa: "#e4d7c4",
  chair: "#aeb698",
  table: "#c69a69",
  cabinet: "#ba9270",
  pouf: "#d3c2e3",
  other: "#bab0cc"
};

export const canvasContext = (
  canvas: HTMLCanvasElement,
  fixedWidth?: number,
  fixedHeight?: number
) => {
  const { width, height } =
    fixedWidth && fixedHeight
      ? { width: fixedWidth, height: fixedHeight }
      : canvas.getBoundingClientRect();
  const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2.5);
  const pixelWidth = Math.round(width * pixelRatio),
    pixelHeight = Math.round(height * pixelRatio);
  if (!pixelWidth || !pixelHeight) return null;
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d")!; /* Canvas 2D is required by this renderer. */
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { c: context, width, height };
};

const line = (c: CanvasRenderingContext2D, points: Point[], color: Paint, thickness = 1) => {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = thickness;
  c.stroke();
};

const path = (c: CanvasRenderingContext2D, points: Point[]) => {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
};

const fill = (c: CanvasRenderingContext2D, points: Point[], color: Paint, stroke: Paint = "") => {
  path(c, points);
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.stroke();
  }
};

const shape = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: Paint,
  stroke: Paint = ""
) => {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 0.85;
    c.stroke();
  }
};

const oval = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: Paint,
  stroke: Paint = ""
) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 0.8;
    c.stroke();
  }
};

const woodgrain = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  strength: number
) => {
  for (let i = 0; i < 7; i++) {
    const yy = y + (h / 8) * (i + 1);
    c.beginPath();
    c.moveTo(x, yy);
    c.bezierCurveTo(x + w * 0.31, yy - h * 0.13, x + w * 0.68, yy + h * 0.12, x + w, yy - 1.6);
    c.strokeStyle = i % 2 ? `rgba(103,62,35,${strength})` : `rgba(255,255,255,${strength * 1.6})`;
    c.lineWidth = 0.55;
    c.stroke();
  }
};

const furniture = (
  c: CanvasRenderingContext2D,
  item: Item,
  pos: Position,
  to: Projection,
  scale: number
) => {
  const box = bounds(item, pos);
  const [centerX, centerY] = to([box.x + box.w / 2, box.y + box.d / 2]);
  const w = item.w * scale,
    h = item.d * scale;
  c.save();
  c.translate(centerX, centerY);
  c.rotate((pos.r * Math.PI) / 180);
  c.translate(-w / 2, -h / 2);
  c.shadowColor = "rgba(64,45,43,.28)";
  c.shadowBlur = 9;
  c.shadowOffsetY = 4;
  if (item.arMesh) {
    c.shadowColor = "transparent";
    const top = localMeshPoints(item).map(([x, , z]) => [x * scale, z * scale]);
    const color = palette[item.kind] ?? palette.other;
    for (const triangle of meshTriangles(top, item.arMesh.indices)) fill(c, triangle, color);
  } else if (item.arFootprint) {
    fill(
      c,
      item.arFootprint.map(([x, y]) => [x * w, y * h]),
      palette[item.kind] ?? palette.other,
      "#7c6b68"
    );
  } else if (item.kind === "sofa" || item.kind === "chair" || item.kind === "stool") {
    const couch = item.kind === "sofa";
    shape(c, 0, 0, w, h, h * 0.18, couch ? "#c7b8a6" : "#909a7e");
    c.shadowColor = "transparent";
    shape(
      c,
      1,
      1,
      w - 2,
      h - 3,
      h * 0.15,
      couch ? "#d9cbb8" : "#a7b295",
      couch ? "#b9aa99" : "#829075"
    );
    const inner = w * (couch ? 0.075 : 0.16);
    const count = couch ? 3 : 1;
    const seat = (w - inner * 2) / count;
    for (let i = 0; i < count; i++) {
      const x = inner + seat * i + 1;
      const gradient = c.createLinearGradient(0, h * 0.18, 0, h);
      gradient.addColorStop(0, couch ? "#e0d2c2" : "#b2bea0");
      gradient.addColorStop(1, couch ? "#f0e5d5" : "#c0c9ad");
      shape(c, x, h * 0.34, seat - 2, h * 0.62, h * 0.1, gradient, couch ? "#cbbdaa" : "#9da88a");
    }
    shape(
      c,
      1,
      1,
      w - 2,
      h * 0.31,
      h * 0.11,
      couch ? "#e9dfcf" : "#b9c3a7",
      couch ? "#d1c3b0" : "#a0ab8e"
    );
    shape(
      c,
      1,
      h * 0.2,
      inner - 0.5,
      h * 0.76,
      h * 0.1,
      couch ? "#ebe0cf" : "#b5c0a2",
      couch ? "#d1c3b0" : "#a0ab8e"
    );
    shape(
      c,
      w - inner,
      h * 0.2,
      inner - 0.5,
      h * 0.76,
      h * 0.1,
      couch ? "#ebe0cf" : "#b5c0a2",
      couch ? "#d1c3b0" : "#a0ab8e"
    );
    if (couch) {
      [[w * 0.21, "#bba5ca", -0.24] as const, [w * 0.81, "#a2a98b", 0.34] as const].forEach(
        ([x, color, rotation]) => {
          c.save();
          c.translate(x, h * 0.43);
          c.rotate(rotation);
          c.shadowColor = "#64536938";
          c.shadowBlur = 3;
          c.shadowOffsetY = 1;
          shape(c, -h * 0.2, -h * 0.17, h * 0.39, h * 0.38, h * 0.09, color);
          c.shadowColor = "transparent";
          shape(c, -h * 0.16, -h * 0.14, h * 0.32, h * 0.29, h * 0.07, "#ffffff17", "#ffffff38");
          c.restore();
        }
      );
    } else {
      shape(c, w * 0.29, h * 0.29, w * 0.42, h * 0.25, h * 0.09, "#d4d8bf", "#a4ae93");
    }
  } else if (item.kind === "table" || item.kind === "pouf") {
    const table = item.kind === "table";
    oval(c, w / 2, h / 2, w / 2, h / 2, table ? "#ac7d52" : "#b4a2c6");
    c.shadowColor = "transparent";
    const gradient = c.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, table ? "#e5bc8d" : "#efe4f6");
    gradient.addColorStop(1, table ? "#c89865" : "#cbb8dd");
    oval(
      c,
      w / 2,
      h / 2 - 0.75,
      w / 2 - 0.75,
      h / 2 - 0.9,
      gradient,
      table ? "#b3865f" : "#bba6cd"
    );
    c.save();
    c.clip();
    if (table) {
      woodgrain(c, 0, 0, w, h, 0.18);
      c.save();
      c.translate(w * 0.42, h * 0.49);
      c.rotate(-0.25);
      shape(c, -w * 0.13, -h * 0.16, w * 0.24, h * 0.32, 1.4, "#ece4d4", "#8e735c");
      shape(c, -w * 0.09, -h * 0.12, w * 0.15, h * 0.15, 1, "#a6a48d");
      c.restore();
      oval(c, w * 0.67, h * 0.61, w * 0.094, h * 0.094, "#f1ead8", "#a87e58");
      oval(c, w * 0.67, h * 0.61, w * 0.048, h * 0.048, "#7d5f49");
    } else {
      oval(c, w / 2, h / 2, w * 0.41, h * 0.41, "#ffffff15", "#fff7ff66");
      for (let i = 0; i < 39; i++) {
        oval(
          c,
          (((i * 23) % 37) / 36) * w,
          (((i * 13) % 43) / 42) * h,
          0.54,
          0.5,
          i % 2 ? "#ffffff51" : "#9f8eae44"
        );
      }
    }
    c.restore();
  } else {
    shape(c, 0, 0, w, h, 3, item.kind === "cabinet" ? "#ae8159" : "#ada0c3");
    c.shadowColor = "transparent";
    shape(c, 1, 1, w - 2, h - 2, 2, item.kind === "cabinet" ? "#d3a679" : "#d4c9e4", "#ad927b");
    if (item.kind === "cabinet") {
      woodgrain(c, 0, 0, w, h, 0.17);
      shape(c, w * 0.15, h * 0.36, w * 0.7, h * 0.3, 1.6, "#4a4240", "#302e2c");
      shape(c, w * 0.17, h * 0.39, w * 0.66, h * 0.07, 1, "#69615b");
    }
  }
  c.restore();
  return {
    item,
    box,
    x: to([box.x, box.y])[0],
    y: to([box.x, box.y])[1],
    w: box.w * scale,
    h: box.d * scale
  };
};

const rug = (
  c: CanvasRenderingContext2D,
  room: Room,
  to: Projection,
  scale: number,
  entries: Entry[],
  variant: number
) => {
  if (variant !== 0 || !entries.some(({ item }) => item.kind === "sofa")) return;
  const { w, d } = dimensions(room.points);
  const [x, y] = to([w * 0.16, d * 0.24]);
  const rw = w * 0.46 * scale,
    rh = d * 0.6 * scale;
  shape(c, x, y, rw, rh, 4, "#ded4e7", "#bfb0cd");
  for (let i = 1; i < rh - 3; i += 2.5)
    line(
      c,
      [
        [x + 2, y + i],
        [x + rw - 2, y + i]
      ],
      i % 3 ? "#f3e9f271" : "#bdaec442",
      0.7
    );
  shape(c, x + 5, y + 5, rw - 10, rh - 10, 3, "#fff5ff20", "#f7f0f8");
  for (const edge of [x, x + rw]) {
    for (let j = 4; j < rh - 3; j += 3)
      line(
        c,
        [
          [edge - 2.2, y + j],
          [edge + 2.2, y + j + 0.3]
        ],
        "#d1c4dc",
        0.8
      );
  }
};

const guide = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  room: Room
) => {
  const dim = dimensions(room.points),
    color = "#b3acbf",
    ink = "#686377";
  line(
    c,
    [
      [x, y - 12],
      [x, y - 28]
    ],
    color
  );
  line(
    c,
    [
      [x + w, y - 12],
      [x + w, y - 28]
    ],
    color
  );
  line(
    c,
    [
      [x, y - 20],
      [x + w, y - 20]
    ],
    color
  );
  line(
    c,
    [
      [x - 2.5, y - 22.5],
      [x + 2.5, y - 17.5]
    ],
    color
  );
  line(
    c,
    [
      [x + w - 2.5, y - 22.5],
      [x + w + 2.5, y - 17.5]
    ],
    color
  );
  c.font = "700 11px Manrope Variable, Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  const text = `${decimal(dim.w, 2)} м`;
  shape(c, x + w / 2 - 25, y - 28, 50, 15, 4, "#f7f6fa");
  c.fillStyle = ink;
  c.fillText(text, x + w / 2, y - 20);
  line(
    c,
    [
      [x - 9, y],
      [x - 28, y]
    ],
    color
  );
  line(
    c,
    [
      [x - 9, y + h],
      [x - 28, y + h]
    ],
    color
  );
  line(
    c,
    [
      [x - 21, y],
      [x - 21, y + h]
    ],
    color
  );
  c.save();
  c.translate(x - 21, y + h / 2);
  c.rotate(-Math.PI / 2);
  shape(c, -25, -7.5, 50, 15, 4, "#f7f6fa");
  c.fillStyle = ink;
  c.fillText(`${decimal(dim.d, 2)} м`, 0, 0);
  c.restore();
};

const iso = (
  c: CanvasRenderingContext2D,
  width: number,
  height: number,
  room: Room,
  entries: Entry[],
  zoom: number,
  selected?: string | null
) => {
  const { w, d } = dimensions(room.points);
  const scale =
    Math.min((width - 39) / ((w + d) * 0.82), (height - 30) / ((w + d) * 0.39 + 2.3)) * zoom;
  const baseX = width / 2 - (w - d) * 0.41 * scale;
  const baseY = height / 2 - (w + d) * 0.195 * scale + 0.48 * scale;
  const to = ([x, y]: Point, z = 0) => [
    baseX + (x - y) * 0.82 * scale,
    baseY + (x + y) * 0.39 * scale - z * scale
  ];
  const floor = room.points.map((p) => to(p));
  fill(
    c,
    floor.map(([x, y]) => [x, y + 7]),
    "#c4b1a9"
  );
  fill(c, floor, "#ede0ce", "#a99889");
  c.save();
  path(c, floor);
  c.clip();
  for (let y = 0.22; y < d; y += 0.22) line(c, [to([0, y]), to([w, y])], "#cab5a15e", 0.7);
  c.restore();
  room.points.forEach((p, i) => {
    const q = room.points[(i + 1) % room.points.length];
    if (i > 0 && i < room.points.length - 1) {
      line(c, [to(p), to(q)], "#655b70", 2);
      return;
    }
    const wallHeight = 1.5;
    fill(
      c,
      [to(p), to(q), to(q, wallHeight), to(p, wallHeight)],
      i === 0 ? "#eae5f3" : "#ddd5eb",
      "#b2a7c2"
    );
    room.openings
      .filter((o) => o.wall === i && o.type === "window")
      .forEach((o) => {
        const window = wallFeature(room.points, o);
        if (window)
          fill(
            c,
            [
              to(window.start, 0.55),
              to(window.end, 0.55),
              to(window.end, 1.25),
              to(window.start, 1.25)
            ],
            "#dde9f7",
            "#a3b5cc"
          );
      });
  });
  const targets: Target[] = [];
  [...entries]
    .sort((a, b) => a.box.x + a.box.y - b.box.x - b.box.y)
    .forEach(({ item, box, pos }) => {
      const base = corners(box);
      const color = palette[item.kind] ?? palette.other;
      const z = item.h;
      if (item.arMesh) {
        const surface = planMeshPoints(item, pos);
        const faces = meshTriangles(surface, item.arMesh.indices)
          .map((triangle) => ({
            triangle,
            depth: triangle.reduce((sum, [x, y]) => sum + x + y, 0)
          }))
          .sort((a, b) => a.depth - b.depth);
        for (const { triangle } of faces) {
          fill(
            c,
            triangle.map(([x, y, height]) => to([x, y], height)),
            color
          );
        }
        const polygon = base.map((point) => to(point, z));
        if (selected === item.id) fill(c, polygon, "transparent", purple);
        targets.push({ item, polygon, box });
        return;
      }
      if (item.arFootprint) {
        const outline = itemFootprint(item, pos);
        outline
          .map((point, index) => [point, outline[(index + 1) % outline.length]])
          .sort(([a, b], [c, d]) => a[0] + a[1] + b[0] + b[1] - c[0] - c[1] - d[0] - d[1])
          .forEach(([a, b]) => fill(c, [to(a), to(b), to(b, z), to(a, z)], color, "#7c6b68"));
        const top = outline.map((point) => to(point, z));
        fill(c, top, color, selected === item.id ? purple : "#8e7d73");
        targets.push({ item, polygon: top, box });
        return;
      }
      fill(c, [to(base[1]), to(base[2]), to(base[2], z), to(base[1], z)], color, "#7c6b68");
      fill(c, [to(base[2]), to(base[3]), to(base[3], z), to(base[2], z)], color, "#8e7e73");
      const front = [to(base[2]), to(base[3]), to(base[3], z), to(base[2], z)];
      fill(c, front, "#3930391c");
      const top = base.map((p) => to(p, z));
      fill(c, top, color, selected === item.id ? purple : "#8e7d73");
      fill(c, top, "#ffffff37");
      if (["sofa", "chair", "stool"].includes(item.kind)) {
        const inset = {
          x: box.x + box.w * 0.14,
          y: box.y + box.d * 0.12,
          w: box.w * 0.72,
          d: box.d * 0.76
        };
        fill(
          c,
          corners(inset).map((p) => to(p, z + 0.01)),
          "#ffffff39",
          "#79726966"
        );
      }
      targets.push({ item, polygon: [...top], front, box });
    });
  return { targets, scale, to };
};

export const drawPlan = (
  canvas: HTMLCanvasElement,
  project: Project,
  items: Item[],
  positions: Positions,
  inspection: Inspection,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    view?: string;
    selected?: string | null;
  } = {}
): Drawing | null => {
  const screen = canvasContext(canvas, options.width, options.height);
  if (!screen) return null;
  const { c, width, height } = screen;
  const { room } = project,
    zoom = options.zoom || 1;
  c.clearRect(0, 0, width, height);
  const entries = items.flatMap((item) =>
    positions[item.id]
      ? [{ item, pos: positions[item.id], box: bounds(item, positions[item.id]) }]
      : []
  );
  if (options.view === "3d") return iso(c, width, height, room, entries, zoom, options.selected);
  const { w, d } = dimensions(room.points);
  const scale = Math.min((width - (width < 430 ? 81 : 143)) / w, (height - 95) / d) * zoom;
  const origin = [(width - w * scale) / 2 + (width < 430 ? 7 : 1), (height - d * scale) / 2 + 8];
  const to = ([x, y]: Point) => [origin[0] + x * scale, origin[1] + y * scale];
  const floor = room.points.map(to);
  guide(c, origin[0], origin[1], w * scale, d * scale, room);
  c.save();
  c.shadowColor = "#43344e38";
  c.shadowBlur = 16;
  c.shadowOffsetY = 6;
  fill(c, floor, "#efe6da");
  c.restore();
  c.save();
  path(c, floor);
  c.clip();
  const plank = Math.max(6, scale * 0.19);
  for (let i = 0; i <= (d * scale) / plank; i++) {
    const y = origin[1] + i * plank;
    for (let j = -1; j <= w / 1.15; j++) {
      const x = origin[0] + j * scale * 1.15 + (i % 3) * scale * 0.38;
      c.fillStyle = timber[(((i * 3 + j * 2) % timber.length) + timber.length) % timber.length];
      c.fillRect(x, y, scale * 1.15 + 1, plank + 1);
      line(
        c,
        [
          [x, y],
          [x + scale * 1.15, y],
          [x + scale * 1.15, y + plank]
        ],
        "#c9ad934f",
        0.55
      );
      if (i % 2 === 0) woodgrain(c, x + 2, y, scale * 1.15 - 4, plank, 0.055);
    }
  }
  rug(c, room, to, scale, entries, project.variant);
  const route = inspection.path.map(to);
  if (route.length) {
    c.lineCap = "round";
    c.lineJoin = "round";
    line(c, route, "#8fbe9e39", Math.max(11, project.passage * scale * 0.46));
    c.setLineDash([4, 5]);
    line(c, route, "#5b9e76a1", 1.25);
    c.setLineDash([]);
    const [x, y] = route[route.length - 1];
    oval(c, x, y, 3.1, 3.1, "#6ca681");
  }
  c.restore();
  const wall = Math.max(4, Math.min(7, scale * 0.072));
  c.lineJoin = "round";
  c.lineCap = "square";
  path(c, floor);
  c.strokeStyle = "#61596d";
  c.lineWidth = wall;
  c.stroke();
  path(c, floor);
  c.strokeStyle = "#81758a";
  c.lineWidth = wall * 0.28;
  c.stroke();
  room.openings.forEach((opening) => {
    const feature = wallFeature(room.points, opening);
    if (!feature) return;
    const a = to(feature.start),
      b = to(feature.end);
    if (opening.type === "window") {
      line(c, [a, b], "#c6d9ed", wall + 1);
      const [ix, iy] = feature.inward;
      line(
        c,
        [
          [a[0] + ix * 2, a[1] + iy * 2],
          [b[0] + ix * 2, b[1] + iy * 2]
        ],
        "#edf7fd",
        1
      );
    } else if (opening.type === "door") {
      line(c, [a, b], "#f7f6fa", wall + 0.7);
      const arc = feature.arc.map(to);
      fill(c, [to(feature.hinge), ...arc], "#bda9d42a");
      c.setLineDash([3, 2]);
      line(c, arc, "#9682aa", 1);
      c.setLineDash([]);
      line(c, [to(feature.hinge), arc[arc.length - 1]], "#756783", 1.65);
      const [x, y] = to(feature.hinge);
      oval(c, x, y, 2.3, 2.3, "#746482");
    } else {
      const [x, y] = to(feature.middle),
        [ix, iy] = feature.inward;
      shape(c, x + ix * 7 - 4, y + iy * 7 - 3.5, 8, 7, 1.4, "#fff8ef", "#937b71");
      oval(c, x + ix * 7 - 1.5, y + iy * 7, 0.65, 0.65, "#605268");
      oval(c, x + ix * 7 + 1.5, y + iy * 7, 0.65, 0.65, "#605268");
    }
  });
  const targets = entries.map(({ item, pos }) => furniture(c, item, pos, to, scale));
  targets.forEach(({ item, x, y, w: width, h }) => {
    const warning = inspection.warnings.some(
      (issue) => issue.id === item.id || issue.other === item.id
    );
    if (options.selected === item.id || warning) {
      c.beginPath();
      c.roundRect(x - 3, y - 3, width + 6, h + 6, 6);
      c.lineWidth = 1.7;
      c.strokeStyle = warning ? "#cb6653" : purple;
      c.setLineDash([3, 3]);
      c.stroke();
      c.setLineDash([]);
    }
  });
  return { targets, scale, to };
};
