import type { ChangeEvent, FormEvent, PointerEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { newId } from "../../../shared/helpers/index.ts";
import type { OutlineProps } from "../components/index.ts";
import { drawRoomSketch, scaleRoomStroke, simplifyRoomStroke } from "../helpers/index.ts";
import { planItems } from "../mock/index.ts";
import {
  centeredPosition,
  dimensions,
  distance,
  fitsFootprint,
  itemFootprint,
  maxOutlinePoints,
  pointIn,
  rotatePosition,
  round
} from "../planning/index.ts";
import type { Item, Point, Position, Room } from "../types/index.ts";

type SketchItem = { item: Item; position: Position };
const emptyOutline: Point[] = [];
type Gesture =
  | { type: "outline"; points: Point[]; moved: boolean }
  | { type: "rectangle"; start: Point; item: Item }
  | { type: "move"; start: Point; entry: SketchItem };

const rectangle = (item: Item, start: Point, end: Point): SketchItem | null => {
  const w = round(Math.abs(start[0] - end[0]));
  const d = round(Math.abs(start[1] - end[1]));
  if (Math.min(w, d) < 0.1 || Math.max(w, d) > 20) return null;
  return {
    item: { ...item, w, d },
    position: { x: Math.min(start[0], end[0]), y: Math.min(start[1], end[1]), r: 0 }
  };
};

const getFurniturePreview = (drawing: Exclude<Gesture, { type: "outline" }>, point: Point) => {
  if (drawing.type === "rectangle") return rectangle(drawing.item, drawing.start, point);
  const { entry, start } = drawing;
  return {
    ...entry,
    position: {
      ...entry.position,
      x: entry.position.x + point[0] - start[0],
      y: entry.position.y + point[1] - start[1]
    }
  };
};

export const useOutline = ({ project, save }: OutlineProps) => {
  const initial = dimensions(project.room.points);
  const [width, setWidth] = useState(initial.w.toFixed(2));
  const [depth, setDepth] = useState(initial.d.toFixed(2));
  const [photo, setPhoto] = useState("");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [history, setHistory] = useState<Point[][]>([]);
  const [stroke, setStroke] = useState<Point[]>([]);
  const [draftRoom, setDraftRoom] = useState<Room | null>(null);
  const [furniture, setFurniture] = useState<SketchItem[]>([]);
  const [preview, setPreview] = useState<SketchItem | null>(null);
  const [tool, setTool] = useState<"select" | "draw">("select");
  const [existingId, setExistingId] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [resizeCount, setResizeCount] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const toDrawing = useRef<ReturnType<typeof drawRoomSketch>>(null);
  const gesture = useRef<Gesture | null>(null);
  const outline = history[history.length - 1] ?? emptyOutline;
  const room = draftRoom?.points ?? null;
  const existing = planItems(project).filter(
    (item) => !furniture.some((entry) => entry.item.id === item.id)
  );
  const active = furniture.find(({ item }) => item.id === selected);
  const newFurniture = furniture.filter(
    ({ item }) => !project.items.some(({ id }) => id === item.id)
  );
  const isNew = newFurniture.some(({ item }) => item.id === selected);
  const roomForSave = () => {
    const points = scaleRoomStroke(outline, Number(width), Number(depth));
    if (!points) {
      setError("Нарисуйте контур без пересечений и укажите ширину и длину от 0,7 до 35 м.");
      return null;
    }
    return {
      ...project.room,
      points,
      openings: [],
      source: photo ? "photo" : "manual",
      verified: "review"
    };
  };

  useEffect(() => {
    if (!photo) return;
    const picture = new Image();
    picture.onload = () => setImage(picture);
    picture.src = photo;
    return () => {
      picture.onload = null;
    };
  }, [photo]);

  useLayoutEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setResizeCount((count) => count + 1));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const node = canvas.current;
    if (node)
      toDrawing.current = drawRoomSketch(node, {
        photo: image,
        outline,
        stroke,
        room,
        furniture,
        preview,
        selected
      });
  }, [image, outline, stroke, room, furniture, preview, selected, resizeCount]);

  const pointerPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return toDrawing.current?.(
      event.clientX - box.left - event.currentTarget.clientLeft,
      event.clientY - box.top - event.currentTarget.clientTop
    );
  };
  const place = (entry: SketchItem) => {
    if (!room || !fitsFootprint(itemFootprint(entry.item, entry.position), room)) {
      setError("Предмет должен целиком помещаться внутри контура.");
      return false;
    }
    setFurniture((items) =>
      items.some(({ item }) => item.id === entry.item.id)
        ? items.map((previous) => (previous.item.id === entry.item.id ? entry : previous))
        : [...items, entry]
    );
    setSelected(entry.item.id);
    setError("");
    return true;
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const point = pointerPoint(event);
    if (!point) return;
    setError("");
    if (!room) {
      if (point.some((value) => value < 0 || value > 1)) return;
      gesture.current = { type: "outline", points: [point], moved: false };
    } else if (tool === "draw") {
      if (!pointIn(point, room)) return;
      if (project.items.length + newFurniture.length >= 60) {
        setError("В проекте достигнут предел мебели.");
        return;
      }
      gesture.current = {
        type: "rectangle",
        start: point,
        item: {
          id: newId(),
          name: "Предмет " + (newFurniture.length + 1),
          kind: "other",
          w: 0,
          d: 0,
          h: 0.75,
          owned: true,
          source: "manual",
          verified: "review",
          material: ""
        }
      };
    } else if (existingId) {
      const item = existing.find(({ id }) => id === existingId);
      if (!item) return;
      gesture.current = {
        type: "move",
        start: point,
        entry: {
          item,
          position: centeredPosition(
            item,
            point,
            project.layouts[project.mode]?.[project.variant]?.[item.id]?.r ?? 0
          )
        }
      };
      setPreview(gesture.current.entry);
    } else {
      const entry = [...furniture]
        .reverse()
        .find(({ item, position }) => pointIn(point, itemFootprint(item, position)));
      setSelected(entry?.item.id ?? "");
      if (!entry) return;
      gesture.current = { type: "move", start: point, entry };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const track = (event: PointerEvent<HTMLCanvasElement>) => {
    const drawing = gesture.current;
    const point = pointerPoint(event);
    if (!drawing || !point || !event.isPrimary) return;
    if (drawing.type !== "outline") {
      setPreview(getFurniturePreview(drawing, point));
      return;
    }
    const bounded = point.map((value) => Math.max(0, Math.min(1, value)));
    if (
      distance(drawing.points[drawing.points.length - 1], bounded) < 0.008 ||
      drawing.points.length >= 450
    )
      return;
    drawing.points.push(bounded);
    drawing.moved ||= distance(drawing.points[0], bounded) >= 0.022;
    if (drawing.moved) setStroke([...drawing.points]);
  };
  const stop = (event: PointerEvent<HTMLCanvasElement>) => {
    const drawing = gesture.current;
    gesture.current = null;
    setStroke([]);
    setPreview(null);
    if (!drawing || event.type === "pointercancel") return;
    const point = pointerPoint(event);
    if (!point) return;
    if (drawing.type === "outline") {
      if (drawing.moved) {
        const bounded = point.map((value) => Math.max(0, Math.min(1, value)));
        const path = simplifyRoomStroke([...drawing.points, bounded]);
        if (path.length < 3) {
          setError("Обведите комнату одним замкнутым движением или отметьте её углы.");
          return;
        }
        setHistory((previous) => [...previous, path]);
      } else if (outline.length < maxOutlinePoints) {
        setHistory((previous) => [...previous, [...outline, drawing.points[0]]]);
      }
      return;
    }
    const entry = getFurniturePreview(drawing, point);
    if (!entry) {
      setError("Протяните рамку мебели минимум на 10 см в обе стороны.");
      return;
    }
    if (place(entry)) {
      setExistingId("");
      setTool("select");
    }
  };
  const changeWidth = (event: ChangeEvent<HTMLInputElement>) => setWidth(event.target.value);
  const changeDepth = (event: ChangeEvent<HTMLInputElement>) => setDepth(event.target.value);
  const changePhoto = (value: string) => {
    setPhoto(value);
    setImage(null);
    setHistory([]);
    setError("");
  };
  const undoPoint = () => {
    setHistory((previous) => previous.slice(0, -1));
    setError("");
  };
  const clear = () => {
    setHistory([]);
    setError("");
  };
  const continueToFurniture = () => {
    const next = roomForSave();
    if (!next) return;
    setDraftRoom(next);
    setError("");
  };
  const back = () => {
    setDraftRoom(null);
    setFurniture([]);
    setSelected("");
    setExistingId("");
    setTool("select");
    setError("");
  };
  const drawFurniture = () => {
    setTool("draw");
    setSelected("");
    setExistingId("");
    setError("");
  };
  const pickExisting = (event: ChangeEvent<HTMLSelectElement>) => {
    setExistingId(event.target.value);
    setTool("select");
    setError("");
  };
  const rotate = (event: ChangeEvent<HTMLInputElement>) => {
    if (!active) return;
    place({
      ...active,
      position: rotatePosition(active.item, active.position, event.target.valueAsNumber)
    });
  };
  const rename = (event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    setFurniture((items) =>
      items.map((entry) =>
        entry.item.id === selected ? { ...entry, item: { ...entry.item, name } } : entry
      )
    );
  };
  const setHeight = (event: ChangeEvent<HTMLInputElement>) => {
    const h = event.target.valueAsNumber;
    setFurniture((items) =>
      items.map((entry) =>
        entry.item.id === selected ? { ...entry, item: { ...entry.item, h } } : entry
      )
    );
  };
  const remove = () => {
    setFurniture((items) => items.filter(({ item }) => item.id !== selected));
    setSelected("");
    setError("");
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draftRoom ?? roomForSave();
    if (!next) return;
    if (
      newFurniture.some(
        ({ item }) => !item.name.trim() || !Number.isFinite(item.h) || item.h < 0.05 || item.h > 20
      )
    ) {
      setError("Укажите название и высоту от 0,05 до 20 м для каждого нового предмета.");
      return;
    }
    save(
      next,
      Object.fromEntries(furniture.map(({ item, position }) => [item.id, position])),
      newFurniture.map(({ item }) => ({ ...item, name: item.name.trim() }))
    );
  };

  return {
    canvas,
    outline,
    error,
    start,
    track,
    stop,
    submit,
    width,
    depth,
    changeWidth,
    changeDepth,
    changePhoto,
    undoPoint,
    clear,
    room,
    continueToFurniture,
    back,
    drawFurniture,
    rotate,
    renaming: isNew,
    active,
    rename,
    setHeight,
    remove,
    tool,
    existing,
    existingId,
    pickExisting
  };
};
