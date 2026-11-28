import type { Point, ScanFeature } from "../types/index.ts";
import { rgb } from "./mesh.ts";
import type { MeshBuilder } from "./mesh.ts";
import type { Point as XRPoint } from "../types/index.ts";

const accent = rgb("#9b67ff");
const accentSoft = rgb("#bda0ff");
const dashed = rgb("#a992df");
const green = rgb("#67d6a2");
const greenSoft = rgb("#8ef0c4");
const yellow = rgb("#fac65c");
const yellowSoft = rgb("#ffe1a0");
const glassColor = rgb("#8f6be0");
const wallColor = rgb("#c9b6ee");

export const wallHeight = 1.15;

const P = (x: number, y: number, z: number): XRPoint => [x, y, z];

export const marker = (m: MeshBuilder, point: XRPoint, color: [number, number, number], radius = 0.045, pulse = 0) => {
  m.cylinder(point[0], point[1] + 0.006, point[2], radius, radius, 0.008, color, 20, 0.92);
  m.ring(point[0], point[1] + 0.016, point[2], radius * (1.9 + pulse * 0.7), radius * 0.36, color, 24);
  m.disc(point[0], point[1] + 0.004, point[2], radius * 0.42, [1, 1, 1], 0.55, 16);
};

export const vertical = (m: MeshBuilder, point: XRPoint, height: number, color: [number, number, number], alpha = 1, width = 0.012) => {
  m.post(point, P(point[0], point[1] + height, point[2]), width, color, alpha);
};

export const floorPatch = (m: MeshBuilder, corners: Point[], y: number) => {
  if (corners.length < 3) return;
  m.floor(corners, y, glassColor, 0.22);
  m.grid(corners, y + 0.003, 0.5, accentSoft, 0.4);
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    m.beam(P(a[0], y + 0.004, a[2]), P(b[0], y + 0.004, b[2]), 0.014, accent, 0.95);
  }
};

export const walls = (m: MeshBuilder, corners: Point[], y: number, height = wallHeight) => {
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (length < 0.05) continue;
    const dx = ((b[2] - a[2]) / length) * 0.006;
    const dz = ((a[0] - b[0]) / length) * 0.006;
    m.quad(
      P(a[0] + dx, y, a[2] + dz),
      P(b[0] + dx, y, b[2] + dz),
      P(b[0] + dx, y + height, b[2] + dz),
      P(a[0] + dx, y + height, a[2] + dz),
      wallColor,
      0.14
    );
    m.quad(
      P(a[0] - dx, y, a[2] - dz),
      P(b[0] - dx, y, b[2] - dz),
      P(b[0] - dx, y + height, b[2] - dz),
      P(a[0] - dx, y + height, a[2] - dz),
      wallColor,
      0.14
    );
    m.post(P(a[0], y, a[2]), P(b[0], y + height, b[2]), 0.012, accentSoft, 0.5);
  }
};

export const cornerPosts = (m: MeshBuilder, corners: Point[], y: number, active: number) => {
  corners.forEach((point, index) => {
    const color = index === active ? green : accent;
    vertical(m, P(point[0], y, point[2]), 0.45, color, 0.55, 0.01);
    marker(m, P(point[0], y, point[2]), color, index === active ? 0.055 : 0.04);
  });
};

export const closingEdge = (m: MeshBuilder, corners: Point[], y: number, ready: boolean) => {
  const first = corners[0];
  const last = corners[corners.length - 1];
  if (!first || !last || corners.length < 3) return;
  const from = P(last[0], y, last[2]);
  const to = P(first[0], y, first[2]);
  const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const steps = Math.max(2, Math.round(length / 0.16));
  for (let i = 0; i < steps; i += 2) {
    const t1 = i / steps;
    const t2 = Math.min(1, (i + 1) / steps);
    m.beam(
      P(from[0] + (to[0] - from[0]) * t1, y + 0.005, from[2] + (to[2] - from[2]) * t1),
      P(from[0] + (to[0] - from[0]) * t2, y + 0.005, from[2] + (to[2] - from[2]) * t2),
      0.012,
      ready ? green : dashed,
      ready ? 0.95 : 0.7
    );
  }
  if (ready) marker(m, to, greenSoft, 0.06);
};

export const featureMarks = (m: MeshBuilder, features: ScanFeature[], pending: Point[]) => {
  for (const feature of features) {
    const color = feature.type === "socket" ? yellowSoft : yellow;
    if (feature.points.length > 1) {
      const [a, b] = feature.points;
      vertical(m, a, 0.9, color, 0.5, 0.008);
      vertical(m, b, 0.9, color, 0.5, 0.008);
      m.beam(P(a[0], a[1] + 0.9, a[2]), P(b[0], b[1] + 0.9, b[2]), 0.01, color, 0.65);
      const across = Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.2);
      for (let i = 0; i <= across; i++) {
        const t = across ? i / across : 0;
        const point = P(a[0] + (b[0] - a[0]) * t, a[1] + 0.9, a[2] + (b[2] - a[2]) * t);
        m.disc(point[0], point[1], point[2], 0.012, color, 0.6, 8);
      }
    }
    feature.points.forEach((point) => marker(m, point, color, 0.036));
  }
  pending.forEach((point) => {
    marker(m, point, yellow, 0.042, 1);
    vertical(m, point, 0.55, yellow, 0.4, 0.008);
  });
};

export const ruler = (m: MeshBuilder, a: Point, b: Point, y: number) => {
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (length < 0.12) return;
  const steps = Math.max(1, Math.round(length / 0.25));
  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    const mid = (t1 + t2) / 2;
    const from = P(a[0] + (b[0] - a[0]) * t1, y + 0.02, a[2] + (b[2] - a[2]) * t1);
    const to = P(a[0] + (b[0] - a[0]) * t2, y + 0.02, a[2] + (b[2] - a[2]) * t2);
    m.beam(from, to, 0.006, accentSoft, 0.55);
    for (let k = 0; k <= 3; k++) {
      const t = t1 + ((t2 - t1) * k) / 3;
      const point = P(a[0] + (b[0] - a[0]) * t, y + 0.02, a[2] + (b[2] - a[2]) * t);
      m.disc(point[0], point[1], point[2], k === 0 || k === 3 ? 0.009 : 0.006, accent, 0.8, 8);
    }
    void mid;
  }
};

export const guide = (m: MeshBuilder, a: XRPoint, b: XRPoint, y: number) => {
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (length < 0.08) return;
  m.beam(P(a[0], y + 0.012, a[2]), P(b[0], y + 0.012, b[2]), 0.007, accentSoft, 0.6);
  const marks = Math.min(20, Math.max(1, Math.round(length / 0.5)));
  for (let i = 1; i <= marks; i++) {
    const t = i / marks;
    m.disc(
      a[0] + (b[0] - a[0]) * t,
      y + 0.012,
      a[2] + (b[2] - a[2]) * t,
      0.008,
      accent,
      0.7,
      6
    );
  }
};

export const closingHint = (m: MeshBuilder, first: XRPoint, last: XRPoint, distance: number, y: number) => {
  const gap = Math.hypot(first[0] - last[0], first[2] - last[2]);
  if (gap > 0.4) return;
  const t = Math.max(0, Math.min(1, 1 - distance / 0.25));
  const color: [number, number, number] = t > 0.5 ? green : [1, 0.8 + t * 0.2, 0.4];
  m.ring(first[0], y + 0.012, first[2], 0.08 + gap * 0.3, 0.015, color, 20);
  const mid: XRPoint = [(first[0] + last[0]) / 2, y + 0.012, (first[2] + last[2]) / 2];
  m.disc(mid[0], mid[1], mid[2], 0.012, color, t > 0.6 ? 0.8 : 0.4, 12);
};

export const sightCone = (m: MeshBuilder, hit: XRPoint, origin: XRPoint, y: number) => {
  const length = Math.hypot(hit[0] - origin[0], hit[2] - origin[2]);
  if (length < 0.2) return;
  m.beam(P(origin[0], y + 0.01, origin[2]), P(hit[0], y + 0.01, hit[2]), 0.007, green, 0.45);
  m.disc(hit[0], y + 0.008, hit[2], 0.05, green, 0.4, 20);
};

export { green, accent };
