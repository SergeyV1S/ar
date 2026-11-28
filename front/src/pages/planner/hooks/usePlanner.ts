import type { ChangeEvent, KeyboardEvent, PointerEvent } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { getPlanStatus } from "../helpers/index.ts";
import { positionsFor } from "../mock/index.ts";
import { area, dimensions, inspect, pointIn, rotatePosition, round, variants } from "../planning/index.ts";
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

export const usePlanner = (showLayouts: boolean) => {
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
  const scaleLabel = useRef<HTMLSpanElement>(null);
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
      if (!drawing.current || !scaleLabel.current) return;
      const { scale } = drawing.current;
      const limit = Math.min(node.clientWidth / 2, 135);
      const meters =
        [1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01].find((unit) => unit * scale <= limit) ?? 0.01;
      node.parentElement?.style.setProperty("--scale-line", `${scale * meters}px`);
      scaleLabel.current.textContent = meters === 1 ? "1 м" : `${meters * 100} см`;
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
          ? pointIn([x, y], target.polygon) || target.sides?.some((side) => pointIn([x, y], side))
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
  const currentPosition = current ? positions[current.id] : undefined;
  const nudgeItem = (direction: (typeof moveDirections)[number], step: number) => {
    if (!current || !currentPosition) return;
    move(current.id, {
      ...currentPosition,
      x: round(currentPosition.x + direction.x * step),
      y: round(currentPosition.y + direction.y * step)
    });
  };
  const handleCanvasKey = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const direction = moveDirections.find((option) => option.key === event.key);
    if (!direction || !currentPosition || view !== "2d") return;
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
  const rotateTo = (angle: number) => {
    if (!current || !currentPosition) return;
    move(current.id, rotatePosition(current, currentPosition, angle));
  };
  const rotateItem = () => {
    if (currentPosition) rotateTo(currentPosition.r + 90);
  };
  const changeItemAngle = (event: ChangeEvent<HTMLInputElement>) => {
    rotateTo(event.currentTarget.valueAsNumber);
  };
  const clearSelection = () => setChosen(null);
  const openChecks = () => action("checks");
  const addOwned = () => action("add-owned");
  const openWishes = () => action("wishes");
  const replan = () => action(project.layouts[project.mode] ? "replan-confirm" : "replan");

  const viewOptions = (["2d", "3d"] as const).map((mode) => {
    const changeView = () => {
      setView(mode);
      setZoom(1);
    };
    return { mode, changeView };
  });
  const layoutChecks = useMemo(() => {
    if (!showLayouts) return [];
    return variants.map((_, index) => {
      const layout = index === project.variant ? positions : positionsFor(project, index);
      const unplaced = items.filter(({ id }) => !layout[id]).length;
      return { index, unplaced, warnings: inspect(project.room, items, layout, project.passage).warnings.length };
    });
  }, [items, positions, project, showLayouts]);
  const advice = project.brief?.layout;
  const recommended = [...layoutChecks].sort((a, b) =>
    a.unplaced - b.unplaced || a.warnings - b.warnings ||
    Number(b.index === advice?.variant) - Number(a.index === advice?.variant))[0];
  const variantOptions = variants.map((variant, i) => {
    const chooseVariant = () => action("variant", i);
    const check = layoutChecks[i];
    return { ...variant, index: i, chooseVariant, check,
      recommended: items.length > 0 && recommended?.index === i };
  });
  const planStatus = getPlanStatus(inspection, project.passage);
  const roomArea = area(project.room.points);
  const roomSize = dimensions(project.room.points);

  return {
    project,
    positions,
    canvas,
    scaleLabel,
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
    layoutReason: advice && recommended?.index === advice.variant ? advice.reason : undefined,
    roomArea,
    roomSize,
    openAR,
    zoomIn,
    zoomOut,
    resetZoom,
    editItem,
    rotateItem,
    changeItemAngle,
    clearSelection,
    openChecks,
    addOwned,
    openWishes,
    replan
  };
};
