import { resizeRoom } from "../mock/index.ts";
import { distance } from "../planning/index.ts";
import type { Item, Positions, Project, Room, VoicePatch } from "../types/index.ts";

const resizeRoomFromVoice = (room: Room, [width, depth]: [number, number]): Room => {
  const resized = resizeRoom(room, width, depth);
  const openings = resized.openings.filter((opening) => {
    const a = resized.points[opening.wall];
    const b = resized.points[(opening.wall + 1) % resized.points.length];
    return a && b && opening.offset + opening.width <= distance(a, b) + 0.005;
  });
  return { ...resized, openings, source: "voice", verified: "review" };
};

export const upsertItem = (items: Item[], candidate: Item) => {
  if (!items.some((item) => item.id === candidate.id)) return [...items, candidate];
  return items.map((item) => (item.id === candidate.id ? candidate : item));
};

export const applyVoicePatch = (
  project: Project,
  { size, sofa, budget, material, mode }: VoicePatch
) => ({
  ...(budget === undefined ? {} : { budget }),
  ...(material === undefined ? {} : { material }),
  ...(mode === undefined ? {} : { mode }),
  room: size ? resizeRoomFromVoice(project.room, size) : project.room,
  items: sofa ? upsertItem(project.items, sofa) : project.items,
  ...(size || sofa ? { layouts: {} } : {})
});

export const getItemLayoutUpdate = (project: Project, item: Item, redraw: boolean) => {
  if (!redraw) return {};
  if (item.owned) return { layouts: {} };
  return { layouts: { ...project.layouts, [project.mode]: {} } };
};

export const getARLayoutUpdate = (
  project: Project,
  positions: Positions,
  starterItems: Item[]
) => ({
  items: starterItems
    .filter((item) => Object.hasOwn(positions, item.id))
    .reduce(upsertItem, project.items),
  layouts: { [project.mode]: { [project.variant]: positions } }
});
