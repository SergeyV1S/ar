import type { PlannerContextInput, PlannerLayoutIdea } from "../../../shared/api/requests/index.ts";
import { arrange, inspect, round, variants } from "../planning/index.ts";
import type { Item, LayoutIdea, Positions, Project } from "../types/index.ts";

export const getPlanningContext = (
  project: Project, items: Item[], positions: Positions, phrase: string
): PlannerContextInput => ({
  phrase,
  room: { points: project.room.points, openings: project.room.openings },
  passage: project.passage,
  items: items.map(({ id, name, kind, owned, material, w, d, h }) => ({
    id, name, kind, owned, material, w, d, h, position: positions[id]
  }))
});

const layoutKey = (items: Item[], positions: Positions) =>
  JSON.stringify(items.map(({ id }) => {
    const pos = positions[id];
    return pos && [round(pos.x), round(pos.y), pos.r % 360];
  }));

export const getLayoutIdeasUpdate = (
  project: Project, items: Item[], current: Positions, suggestions: PlannerLayoutIdea[]
) => {
  const slots = variants.flatMap((_, index) => index === project.variant ? [] : [index]);
  const layouts: Record<number, Positions> = { [project.variant]: current };
  const ideas: Record<number, LayoutIdea> = {};
  const seen = new Set([layoutKey(items, current)]);
  const ids = new Set(items.map(({ id }) => id));
  const valid = (positions: Positions) => !inspect(project.room, items, positions, project.passage).warnings.length;

  for (const { title, reason, positions } of suggestions) {
    const index = slots[Object.keys(ideas).length];
    if (index === undefined) break;
    const proposed = Object.fromEntries(positions.filter(({ id }) => ids.has(id)).map(({ id, x, y, r }) =>
      [id, { x, y, r: r % 360 }]));
    const originalFits = valid(proposed);
    const candidate = originalFits
      ? proposed : arrange(project.room, items, index, project.passage, undefined, proposed);
    if (!valid(candidate)) continue;
    const key = layoutKey(items, candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    layouts[index] = candidate;
    ideas[index] = { title, reason: originalFits ? reason : "Положение уточнено по контуру и проходам." };
  }
  if (!Object.keys(ideas).length) return;
  return {
    layouts: { ...project.layouts, [project.mode]: layouts },
    layoutIdeas: { ...project.layoutIdeas, [project.mode]: ideas }
  };
};
