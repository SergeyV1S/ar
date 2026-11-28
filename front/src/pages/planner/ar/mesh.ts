import { pointIn } from "../planning/index.ts";
import type { Point } from "../types/index.ts";

export type Rgb = [number, number, number];

export const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255
];

const light: Rgb = [0.38, 0.84, 0.39];
const lightLength = Math.hypot(...light);
const lightDir = light.map((value) => value / lightLength) as Rgb;

const shadeFor = (a: Point, b: Point, c: Point) => {
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2];
  const vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  const nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);
  if (length < 1e-9) return 0.72;
  const facing = Math.abs(nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]) / length;
  return 0.42 + 0.62 * facing;
};

const tri = (
  output: number[],
  a: Point,
  b: Point,
  c: Point,
  color: Rgb,
  alpha = 1,
  shade = true
) => {
  const factor = shade ? shadeFor(a, b, c) : 1;
  for (const point of [a, b, c])
    output.push(
      point[0],
      point[1],
      point[2],
      Math.min(color[0] * factor, 1),
      Math.min(color[1] * factor, 1),
      Math.min(color[2] * factor, 1),
      alpha
    );
};

const quad = (output: number[], a: Point, b: Point, c: Point, d: Point, color: Rgb, alpha = 1) => {
  tri(output, a, b, c, color, alpha);
  tri(output, a, c, d, color, alpha);
};

export const triangulate = (polygon: Point[]) => {
  if (polygon.length < 3) return [];
  const points = polygon.map(([x, y]) => [x, y]);
  const index = points.map((_, i) => i);
  const faces: number[][] = [];
  const turn = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const area = points.reduce(
    (sum, [x, y], i) => sum + x * points[(i + 1) % points.length][1] - y * points[(i + 1) % points.length][0],
    0
  );
  if (area < 0) index.reverse();
  let guard = 0;
  while (index.length > 3 && guard++ < 256) {
    let clipped = false;
    for (let i = 0; i < index.length; i++) {
      const previous = points[index[(i + index.length - 1) % index.length]];
      const current = points[index[i]];
      const next = points[index[(i + 1) % index.length]];
      if (turn(previous, current, next) <= 1e-9) continue;
      const inside = index.some((other) => {
        const point = points[other];
        if (point === previous || point === current || point === next) return false;
        return (
          turn(previous, current, point) >= 0 &&
          turn(current, next, point) >= 0 &&
          turn(next, previous, point) >= 0
        );
      });
      if (inside) continue;
      faces.push([index[(i + index.length - 1) % index.length], index[i], index[(i + 1) % index.length]]);
      index.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (index.length === 3) faces.push([...index]);
  return faces;
};

export const createMesh = () => {
  const solid: number[] = [],
    glass: number[] = [];
  const target = (alpha: number) => (alpha < 1 ? glass : solid);
  return {
    solid,
    glass,
    tri(a: Point, b: Point, c: Point, color: Rgb, alpha = 1, shade = true) {
      tri(target(alpha), a, b, c, color, alpha, shade);
    },
    quad(a: Point, b: Point, c: Point, d: Point, color: Rgb, alpha = 1) {
      quad(target(alpha), a, b, c, d, color, alpha);
    },
    box(x: number, y: number, z: number, width: number, height: number, depth: number, color: Rgb) {
      const a: Point = [x, y, z],
        b: Point = [x + width, y, z],
        c: Point = [x + width, y, z + depth],
        d: Point = [x, y, z + depth];
      const corners: Point[] = [a, b, c, d].map(([px, py, pz]) => [px, py + height, pz]);
      const [e, f, g, h] = corners;
      quad(solid, e, h, g, f, color);
      quad(solid, a, b, f, e, color);
      quad(solid, b, c, g, f, color);
      quad(solid, c, d, h, g, color);
      quad(solid, d, a, e, h, color);
      quad(solid, a, d, c, b, color);
    },
    cylinder(
      x: number,
      y: number,
      z: number,
      rx: number,
      rz: number,
      height: number,
      color: Rgb,
      steps = 24,
      alpha = 1
    ) {
      const buffer = target(alpha);
      for (let i = 0; i < steps; i++) {
        const angle = (i * 2 * Math.PI) / steps,
          next = ((i + 1) * 2 * Math.PI) / steps;
        const point = (a: number, lift: number): Point => [
          x + rx * Math.cos(a),
          y + lift,
          z + rz * Math.sin(a)
        ];
        tri(buffer, [x, y + height, z], point(angle, height), point(next, height), color, alpha);
        quad(
          buffer,
          point(angle, 0),
          point(next, 0),
          point(next, height),
          point(angle, height),
          color,
          alpha
        );
      }
    },
    ring(cx: number, cy: number, cz: number, radius: number, thickness: number, color: Rgb, steps = 32) {
      for (let i = 0; i < steps; i++) {
        const a1 = (i * 2 * Math.PI) / steps,
          a2 = ((i + 1) * 2 * Math.PI) / steps;
        const inner1: Point = [cx + (radius - thickness) * Math.cos(a1), cy, cz + (radius - thickness) * Math.sin(a1)];
        const inner2: Point = [cx + (radius - thickness) * Math.cos(a2), cy, cz + (radius - thickness) * Math.sin(a2)];
        const outer1: Point = [cx + radius * Math.cos(a1), cy, cz + radius * Math.sin(a1)];
        const outer2: Point = [cx + radius * Math.cos(a2), cy, cz + radius * Math.sin(a2)];
        quad(solid, inner1, outer1, outer2, inner2, color);
      }
    },
    disc(cx: number, cy: number, cz: number, radius: number, color: Rgb, alpha = 1, steps = 24) {
      for (let i = 0; i < steps; i++) {
        const a1 = (i * 2 * Math.PI) / steps,
          a2 = ((i + 1) * 2 * Math.PI) / steps;
        tri(
          target(alpha),
          [cx, cy, cz],
          [cx + radius * Math.cos(a1), cy, cz + radius * Math.sin(a1)],
          [cx + radius * Math.cos(a2), cy, cz + radius * Math.sin(a2)],
          color,
          alpha
        );
      }
    },
    beam(a: Point, b: Point, width: number, color: Rgb, alpha = 1) {
      const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (length < 0.001) return;
      const dx = ((b[2] - a[2]) * width) / length,
        dz = ((a[0] - b[0]) * width) / length;
      quad(
        target(alpha),
        [a[0] + dx, a[1], a[2] + dz],
        [a[0] - dx, a[1], a[2] - dz],
        [b[0] - dx, b[1], b[2] - dz],
        [b[0] + dx, b[1], b[2] + dz],
        color,
        alpha
      );
    },
    post(a: Point, b: Point, width: number, color: Rgb, alpha = 1) {
      quad(
        target(alpha),
        [a[0] - width / 2, a[1], a[2] - width / 2],
        [a[0] + width / 2, a[1], a[2] + width / 2],
        [b[0] + width / 2, b[1], b[2] + width / 2],
        [b[0] - width / 2, b[1], b[2] - width / 2],
        color,
        alpha
      );
      quad(
        target(alpha),
        [a[0] + width / 2, a[1], a[2] - width / 2],
        [a[0] - width / 2, a[1], a[2] + width / 2],
        [b[0] - width / 2, b[1], b[2] + width / 2],
        [b[0] + width / 2, b[1], b[2] - width / 2],
        color,
        alpha
      );
    },
    floor(points: Point[], y: number, color: Rgb, alpha: number) {
      const flat = points.map(([x, , z]) => [x, z]);
      for (const face of triangulate(flat))
        tri(
          glass,
          [flat[face[0]][0], y, flat[face[0]][1]],
          [flat[face[1]][0], y, flat[face[1]][1]],
          [flat[face[2]][0], y, flat[face[2]][1]],
          color,
          alpha,
          false
        );
    },
    grid(points: Point[], y: number, spacing: number, color: Rgb, alpha: number) {
      const flat = points.map(([x, , z]) => [x, z]);
      const xs = flat.map((p) => p[0]),
        zs = flat.map((p) => p[1]);
      const left = Math.floor(Math.min(...xs) / spacing) * spacing,
        right = Math.ceil(Math.max(...xs) / spacing) * spacing;
      const top = Math.floor(Math.min(...zs) / spacing) * spacing,
        bottom = Math.ceil(Math.max(...zs) / spacing) * spacing;
      const step = spacing / 6;
      const run = (from: Point, to: Point) => {
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const count = Math.round(length / step);
        let start: number | null = null;
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const point: Point = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
          const inside = pointIn(point, flat);
          if (inside && start === null) start = t;
          if ((!inside || i === count) && start !== null) {
            const end = inside ? t : (i - 1) / count;
            if (end - start > 0.002)
              this.beam(
                [from[0] + (to[0] - from[0]) * start, y, from[1] + (to[1] - from[1]) * start],
                [from[0] + (to[0] - from[0]) * end, y, from[1] + (to[1] - from[1]) * end],
                0.004,
                color,
                alpha
              );
            start = null;
          }
        }
      };
      for (let x = left; x <= right + 1e-9; x += spacing) run([x, top], [x, bottom]);
      for (let z = top; z <= bottom + 1e-9; z += spacing) run([left, z], [right, z]);
    },
    finish() {
      return {
        solid: new Float32Array(solid),
        glass: new Float32Array(glass)
      };
    },
    reset() {
      solid.length = 0;
      glass.length = 0;
    },
    get empty() {
      return solid.length === 0 && glass.length === 0;
    }
  };
};

export type MeshBuilder = ReturnType<typeof createMesh>;
