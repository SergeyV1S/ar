import type { PlanContext } from "./index.ts";

const round = (meters: number) => Math.round(meters * 100) / 100;

export const describeVisualizationLayout = (room: PlanContext["room"], items: PlanContext["items"]) => {
  const walls = room.points.flatMap(([x, y], wall) => {
    const [endX, endY] = room.points[(wall + 1) % room.points.length];
    const dx = endX - x;
    const dy = endY - y;
    const length = Math.hypot(dx, dy);
    return length ? [{ wall, x, y, dx, dy, length }] : [];
  });
  return items.flatMap(({ name, id, w, d, h, position: { x, y, r } }) => {
    if (x === undefined || y === undefined || r === undefined) return [];
    const radians = r * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const centerX = x + ((w ?? 0) * cos + (d ?? 0) * sin) / 2;
    const centerY = y + ((w ?? 0) * sin + (d ?? 0) * cos) / 2;
    const nearest = walls.map((wall) => {
      const fraction = ((centerX - wall.x) * wall.dx + (centerY - wall.y) * wall.dy) / wall.length ** 2;
      const along = Math.min(1, Math.max(0, fraction));
      const distance = Math.hypot(centerX - wall.x - along * wall.dx, centerY - wall.y - along * wall.dy);
      return { wall: wall.wall, along: along * wall.length, distance };
    }).sort((a, b) => a.distance - b.distance)[0];
    const anchor = nearest
      ? `, ближайшая стена №${nearest.wall}, ${round(nearest.along)} м от её начала, ${round(nearest.distance)} м от стены до центра`
      : "";
    const openings = room.openings.flatMap(({ type, wall, offset, width }) => {
      if (wall !== nearest?.wall || !nearest || offset === undefined || width === undefined) return [];
      if (type !== "window" && type !== "door") return [];
      const label = type === "window" ? "окно" : "дверь";
      if (nearest.along < offset) return [`перед проёмом «${label}» вдоль этой стены`];
      if (nearest.along > offset + width) return [`после проёма «${label}» вдоль этой стены`];
      return [`напротив проёма «${label}»`];
    }).join(", ");
    const size = w !== undefined && d !== undefined && h !== undefined
      ? `, габариты ${w} × ${d} × ${h} м`
      : "";
    const location = openings ? `, ${openings}` : "";
    return [`${id} — ${name}: центр (${round(centerX)}, ${round(centerY)}), поворот ${r}°${size}${anchor}${location}.`];
  }).join("\n");
};
