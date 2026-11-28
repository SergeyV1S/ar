import { canvasContext, dimensions, itemFootprint } from "../planning/index.ts";
import type { Item, Point, Position } from "../types/index.ts";

type SketchItem = { item: Item; position: Position };
type Drawing = {
  photo: HTMLImageElement | null;
  outline: Point[];
  stroke: Point[];
  room: Point[] | null;
  furniture: SketchItem[];
  preview: SketchItem | null;
  selected: string;
};

export const drawRoomSketch = (canvas: HTMLCanvasElement, drawing: Drawing) => {
  const ctx = canvasContext(canvas);
  if (!ctx) return null;
  const { c, width, height } = ctx;
  c.clearRect(0, 0, width, height);
  const padding = 16;
  let w = Math.max(1, width - padding * 2);
  let h = Math.max(1, height - padding * 2);
  const metric = drawing.room ? dimensions(drawing.room) : { w: 1, d: 1 };
  if (drawing.room) {
    const scale = Math.min(w / metric.w, h / metric.d);
    w = metric.w * scale;
    h = metric.d * scale;
  } else if (drawing.photo) {
    const scale = Math.min(w / drawing.photo.naturalWidth, h / drawing.photo.naturalHeight);
    w = drawing.photo.naturalWidth * scale;
    h = drawing.photo.naturalHeight * scale;
  }
  const x = (width - w) / 2;
  const y = (height - h) / 2;
  if (!drawing.room && drawing.photo) c.drawImage(drawing.photo, x, y, w, h);
  const toScreen = ([px, py]: Point): [number, number] => [
    x + (px * w) / metric.w,
    y + (py * h) / metric.d
  ];
  const toDrawing = (px: number, py: number): Point => [
    ((px - x) * metric.w) / w,
    ((py - y) * metric.d) / h
  ];
  const path = (points: Point[], close: boolean, color: string, fill: string) => {
    if (!points.length) return;
    c.beginPath();
    c.moveTo(...toScreen(points[0]));
    points.slice(1).forEach((point) => c.lineTo(...toScreen(point)));
    if (close) {
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    }
    c.strokeStyle = color;
    c.lineWidth = 2.5;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.stroke();
  };
  const outline = drawing.room ?? drawing.outline;
  path(outline, outline.length > 2, "#7446d3", "#8659e829");
  if (drawing.stroke.length >= 2) path(drawing.stroke, false, "#8455eb", "");
  if (!drawing.room) {
    for (const point of outline) {
      c.beginPath();
      c.arc(...toScreen(point), 4, 0, Math.PI * 2);
      c.fillStyle = "#7446d3";
      c.fill();
    }
  }
  const furniture = drawing.preview
    ? [
        ...drawing.furniture.filter(({ item }) => item.id !== drawing.preview?.item.id),
        drawing.preview
      ]
    : drawing.furniture;
  for (const { item, position } of furniture) {
    const polygon = itemFootprint(item, position);
    const selected = item.id === drawing.selected || item === drawing.preview?.item;
    path(polygon, true, selected ? "#6742bb" : "#746483", selected ? "#c9b2f0" : "#e4d8f1");
    const center = polygon[0].map((value, axis) => (value + polygon[2][axis]) / 2);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "600 11px sans-serif";
    c.fillStyle = "#372750";
    c.fillText(item.name, ...toScreen(center), Math.max(12, (item.w * w) / metric.w - 7));
  }
  return toDrawing;
};
