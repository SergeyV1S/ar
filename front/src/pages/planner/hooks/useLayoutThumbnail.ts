import { useLayoutEffect, useRef } from "react";

import { dimensions, itemFootprint } from "../planning/index.ts";
import type { Item, Point, Positions, Room } from "../types/index.ts";

export const useLayoutThumbnail = (room: Room, items: Item[], positions: Positions) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    const { w, d } = dimensions(room.points);
    const scale = Math.min((width - 16) / w, (height - 16) / d);
    const left = (width - w * scale) / 2;
    const top = (height - d * scale) / 2;
    const draw = (points: Point[], fill: string, stroke: string) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(left + x * scale, top + y * scale);
        else ctx.lineTo(left + x * scale, top + y * scale);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.fill();
      ctx.stroke();
    };
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    draw(room.points, "#f5ede2", "#756050");
    items.forEach((item) => {
      const position = positions[item.id];
      if (position) draw(itemFootprint(item, position), item.owned ? "#b6c2a5" : "#d4af88", "#5d5247");
    });
  }, [items, positions, room]);
  return ref;
};
