import { legacyStarterItems, resizeRoom } from "../mock/index.ts";
import { bounds, centeredPosition, distance } from "../planning/index.ts";
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
  ...(budget === undefined ? {} : { budget, budgetConfirmed: true }),
  ...(material === undefined ? {} : { material }),
  ...(mode === undefined ? {} : { mode }),
  room: size ? resizeRoomFromVoice(project.room, size) : project.room,
  items: sofa ? upsertItem(project.items, sofa) : project.items,
  ...(size || sofa ? { layouts: {}, layoutIdeas: undefined } : {})
});

export const getItemLayoutUpdate = (project: Project, item: Item, redraw: boolean): Pick<Partial<Project>, "layouts"> => {
  if (!redraw) return {};
  const previous = project.items.find(({ id }) => id === item.id);
  if (
    previous?.owned &&
    (previous.source === "xr" || previous.source === "manual") &&
    item.kind !== "service"
  ) {
    const layouts = Object.fromEntries<Record<number, Positions>>(
      Object.entries(project.layouts).map(([mode, variants]) => [
        mode,
        Object.fromEntries<Positions>(
          Object.entries(variants).map(([variant, positions]) => {
            const position = positions[item.id];
            if (!position) return [variant, positions];
            const box = bounds(previous, position);
            const center = [box.x + box.w / 2, box.y + box.d / 2];
            return [
              variant,
              { ...positions, [item.id]: centeredPosition(item, center, position.r) }
            ];
          })
        )
      ])
    );
    return { layouts };
  }
  if (item.owned) return { layouts: {} };
  return { layouts: { ...project.layouts, [project.mode]: {} } };
};

export const getARLayoutUpdate = (
  project: Project,
  positions: Positions,
  starterItems: Item[]
) => ({
  items: [...project.items, ...starterItems.filter((item) => Object.hasOwn(positions, item.id))],
  layouts: { [project.mode]: { [project.variant]: positions } },
  layoutIdeas: undefined
});

export const getScanLayoutUpdate = (project: Project, positions: Positions, measured: Item[]) => {
  const samples = legacyStarterItems();
  const existing = project.items.filter((item) => !samples.some((sample) =>
    item.id === sample.id && item.name === sample.name && item.kind === sample.kind &&
    item.w === sample.w && item.d === sample.d && item.h === sample.h &&
    item.material === sample.material && item.owned && item.source === sample.source &&
    item.verified === sample.verified && !item.photo &&
    !Object.values(project.layouts).some((variants) => Object.values(variants).some(
      (layout) => Object.hasOwn(layout, item.id)
    ))
  ));
  const ids = new Set([...existing, ...measured].map(({ id }) => id));
  const placed = Object.fromEntries(Object.entries(positions).filter(([id]) => ids.has(id)));
  return getARLayoutUpdate({ ...project, items: existing }, placed, measured);
};
