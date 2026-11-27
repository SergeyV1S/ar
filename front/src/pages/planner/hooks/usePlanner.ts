import type { KeyboardEvent, PointerEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { getPlanStatus } from "../helpers/index.ts";
import { area, pointIn, round, variants } from "../planning/index.ts";
import type { Drawing } from "../planning/index.ts";
import { drawPlan } from "../planning/index.ts";
import type { Position } from "../types/index.ts";
import { usePlannerContext } from "./usePlannerContext.ts";

const moveDirections = [
  { key: "ArrowUp", x: 0, y: -1, label: "Вверх", symbol: "↑" },
  { key: "ArrowLeft", x: -1, y: 0, label: "Влево", symbol: "←" },
  { key: "ArrowDown", x: 0, y: 1, label: "Вниз", symbol: "↓" },
  { key: "ArrowRight", x: 1, y: 0, label: "Вправо", symbol: "→" }
] as const;

export const usePlanner = () => {
  const {
    project,
    allItems: items,
    positions,
    inspection,
    selected: chosen,
    setSelected: setChosen,
    view,
    setView,
    zoom,
    setZoom,
    move,
    action
  } = usePlannerContext();
  const canvas = useRef<HTMLCanvasElement>(null),
    drawing = useRef<Drawing | null>(null),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      pos: Position;
      scale: number;
      latest: Position | null;
    } | null>(null);
  const [live, setLive] = useState<{ id: string; pos: Position } | null>(null);
  useLayoutEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const paint = () => {
      const all = live ? { ...positions, [live.id]: live.pos } : positions;
      drawing.current = drawPlan(node, project, items, all, inspection, {
        view,
        zoom,
        selected: chosen
      });
      if (drawing.current)
        node.parentElement?.style.setProperty("--scale-line", `${drawing.current.scale}px`);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(node);
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) paint();
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [project, items, positions, inspection, view, zoom, chosen, live]);
  const eventPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const { left, top } = event.currentTarget.getBoundingClientRect();
    return [event.clientX - left, event.clientY - top];
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !drawing.current) return;
    const [x, y] = eventPoint(event);
    const found = [...drawing.current.targets]
      .reverse()
      .find((target) =>
        target.polygon
          ? pointIn([x, y], target.polygon) || pointIn([x, y], target.front ?? [])
          : x >= (target.x ?? 0) &&
            x <= (target.x ?? 0) + (target.w ?? 0) &&
            y >= (target.y ?? 0) &&
            y <= (target.y ?? 0) + (target.h ?? 0)
      );
    setChosen(found?.item.id ?? null);
    if (!found || view !== "2d") return;
    drag.current = {
      id: found.item.id,
      x,
      y,
      pos: positions[found.item.id],
      scale: drawing.current.scale,
      latest: null
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const track = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const [x, y] = eventPoint(event),
      origin = drag.current;
    if (Math.hypot(x - origin.x, y - origin.y) < 3 && !origin.latest) return;
    origin.latest = {
      ...origin.pos,
      x: round(origin.pos.x + (x - origin.x) / origin.scale),
      y: round(origin.pos.y + (y - origin.y) / origin.scale)
    };
    setLive({ id: origin.id, pos: origin.latest });
  };
  const stop = (event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = drag.current;
    drag.current = null;
    setLive(null);
    if (pointer?.latest && event.type !== "pointercancel") move(pointer.id, pointer.latest);
  };
  const current = items.find((item) => item.id === chosen);
  const nudgeItem = (direction: (typeof moveDirections)[number], step: number) => {
    if (!current) return;
    const position = positions[current.id];
    if (!position) return;
    move(current.id, {
      ...position,
      x: round(position.x + direction.x * step),
      y: round(position.y + direction.y * step)
    });
  };
  const handleCanvasKey = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const direction = moveDirections.find((option) => option.key === event.key);
    if (!direction || !current || !positions[current.id] || view !== "2d") return;
    event.preventDefault();
    nudgeItem(direction, event.shiftKey ? 0.15 : 0.03);
  };
  const movementControls = moveDirections.map((direction) => {
    const nudge = () => nudgeItem(direction, 0.03);
    return { ...direction, nudge };
  });
  const itemChoices = items.map((item) => {
    const select = () => setChosen(item.id);
    return { item, select };
  });

  const openAR = () => action("ar-view");
  const zoomIn = () => setZoom((value) => Math.min(2.3, value + 0.2));
  const zoomOut = () => setZoom((value) => Math.max(0.55, value - 0.2));
  const resetZoom = () => setZoom(1);
  const editItem = () => {
    if (current) action("item", current.id);
  };
  const rotateItem = () => {
    if (!current) return;
    const pos = positions[current.id];
    if (pos) move(current.id, { ...pos, r: (pos.r + 90) % 360 });
  };
  const clearSelection = () => setChosen(null);
  const openChecks = () => action("checks");
  const editRoom = () => action("room");
  const scanRoom = () => action("ar-scan");
  const dictate = () => action("voice");
  const addOwned = () => action("add-owned");
  const replan = () => action(project.layouts[project.mode] ? "replan-confirm" : "replan");

  const viewOptions = (["2d", "3d"] as const).map((mode) => {
    const changeView = () => {
      setView(mode);
      setZoom(1);
    };
    return { mode, changeView };
  });
  const variantOptions = variants.map((variant, i) => {
    const chooseVariant = () => action("variant", i);
    return { ...variant, index: i, chooseVariant };
  });
  const planStatus = getPlanStatus(inspection, project.passage);
  const roomArea = area(project.room.points);

  return {
    project,
    positions,
    canvas,
    view,
    start,
    track,
    stop,
    handleCanvasKey,
    current,
    movementControls,
    itemChoices,
    planStatus,
    viewOptions,
    variantOptions,
    roomArea,
    openAR,
    zoomIn,
    zoomOut,
    resetZoom,
    editItem,
    rotateItem,
    clearSelection,
    openChecks,
    editRoom,
    scanRoom,
    dictate,
    addOwned,
    replan
  };
};
