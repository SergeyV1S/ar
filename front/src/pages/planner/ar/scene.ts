import type { Point, ScanFeature } from "../types/index.ts";
import { duplicateRadius, nearPoint } from "./geometry.ts";
import { rgb } from "./mesh.ts";
import type { MeshBuilder } from "./mesh.ts";

const accent = rgb("#9b67ff");
const accentSoft = rgb("#bda0ff");
const green = rgb("#67d6a2");
const greenSoft = rgb("#8ef0c4");
const yellow = rgb("#fac65c");
const yellowSoft = rgb("#ffe1a0");
const glassColor = rgb("#8f6be0");
const wallColor = rgb("#c9b6ee");

const wallHeight = 1.15;

const P = (x: number, y: number, z: number): Point => [x, y, z];

export const marker = (m: MeshBuilder, point: Point, color: [number, number, number], radius = 0.045, pulse = 0) => {
  m.cylinder(point[0], point[1] + 0.006, point[2], radius, radius, 0.008, color, 20, 0.92);
  m.ring(point[0], point[1] + 0.016, point[2], radius * (1.9 + pulse * 0.7), radius * 0.36, color, 24);
  m.disc(point[0], point[1] + 0.004, point[2], radius * 0.42, [1, 1, 1], 0.55, 16);
};

const vertical = (m: MeshBuilder, point: Point, height: number, color: [number, number, number], alpha = 1, width = 0.012) => {
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

export const wallSegment = (m: MeshBuilder, a: Point, b: Point, y: number, preview = false) => {
  if (nearPoint(a, b, duplicateRadius)) return;
  const bottomA = P(a[0], y + 0.008, a[2]);
  const bottomB = P(b[0], y + 0.008, b[2]);
  const topA = P(a[0], y + wallHeight, a[2]);
  const topB = P(b[0], y + wallHeight, b[2]);
  const edge = preview ? greenSoft : accentSoft;
  m.quad(bottomA, bottomB, topB, topA, preview ? green : wallColor, preview ? 0.56 : 0.36);
  m.beam(bottomA, bottomB, 0.012, edge);
  m.beam(topA, topB, 0.012, edge);
  m.post(bottomA, topA, 0.02, edge);
  m.post(bottomB, topB, 0.02, edge);
};

export const walls = (m: MeshBuilder, corners: Point[], y: number, closed: boolean) => {
  for (let i = 1; i < corners.length; i++) wallSegment(m, corners[i - 1], corners[i], y);
  const last = corners.at(-1);
  if (closed && last) wallSegment(m, last, corners[0], y);
};

export const cornerPosts = (m: MeshBuilder, corners: Point[], y: number, active: number) => {
  corners.forEach((point, index) => {
    const color = index === active ? green : accent;
    if (corners.length === 1) vertical(m, P(point[0], y, point[2]), 0.45, color, 1, 0.02);
    marker(m, P(point[0], y, point[2]), color, index === active ? 0.055 : 0.04);
  });
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

export const sightCone = (m: MeshBuilder, hit: Point, origin: Point, y: number) => {
  const length = Math.hypot(hit[0] - origin[0], hit[2] - origin[2]);
  if (length < 0.2) return;
  m.beam(P(origin[0], y + 0.01, origin[2]), P(hit[0], y + 0.01, hit[2]), 0.007, green, 0.45);
  m.disc(hit[0], y + 0.008, hit[2], 0.05, green, 0.4, 20);
};

export { green };
