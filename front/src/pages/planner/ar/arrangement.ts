import { newId } from "../../../shared/helpers/index.ts";
import {
  centeredPosition,
  fitsFootprint,
  itemFootprint,
  normalizeAngle,
  rotatePosition,
  round
} from "../planning/index.ts";
import type { Item, Point, Position, Positions } from "../types/index.ts";
import { furnitureMesh } from "./furniture.ts";
import type { ScanLayout } from "./geometry.ts";
import { roomPoint, worldPoint } from "./geometry.ts";

const prototypes = [
  { name: "Диван", kind: "sofa", w: 2.2, d: 0.9, h: 0.83 },
  { name: "Кресло", kind: "chair", w: 0.76, d: 0.78, h: 0.81 },
  { name: "Стол", kind: "table", w: 1, d: 0.8, h: 0.75 }
];

export const createARStarterItems = (available: number): Item[] =>
  prototypes.slice(0, Math.max(0, available)).map((item) => ({
    ...item,
    id: newId(),
    owned: true,
    source: "xr",
    verified: "review",
    material: ""
  }));

export const getItemTarget = (layout: ScanLayout, item: Item, hit: Point, rotation: number) => {
  const center = roomPoint(layout, hit);
  const raw = centeredPosition(item, center, rotation);
  const position = { ...raw, x: round(raw.x), y: round(raw.y) };
  const dx = position.x - raw.x;
  const dz = position.y - raw.y;
  return {
    position,
    valid: fitsFootprint(itemFootprint(item, position), layout.points),
    modelOrigin: worldPoint(layout, [center[0] + dx - item.w / 2, center[1] + dz - item.d / 2])
  };
};

export const createArrangement = (initialItems: Item[]) => {
  const items = new Map(initialItems.map((item) => [item.id, item]));
  const added = new Set<string>();
  const placed = new Map<string, Position>();
  const history: { id: string; previous: Position | undefined }[] = [];
  let selected: Item | undefined;
  let rotating = false;
  let rotation = 0;
  let model = furnitureMesh([], {});
  let withoutSelection = model;
  let preview = model;

  const positions = (): Positions => Object.fromEntries(placed);
  const updateModel = () => {
    const visible = [...items.values()].filter(({ id }) => placed.has(id));
    const layout = positions();
    model = furnitureMesh(visible, layout);
    withoutSelection =
      selected && placed.has(selected.id)
        ? furnitureMesh(
            visible.filter(({ id }) => id !== selected?.id),
            layout
          )
        : model;
  };
  const select = (id?: string) => {
    selected = id ? items.get(id) : undefined;
    rotating = false;
    rotation = selected ? (placed.get(selected.id)?.r ?? 0) : 0;
    if (selected) preview = furnitureMesh([selected], { [selected.id]: { x: 0, y: 0, r: 0 } });
    updateModel();
  };
  const place = (position: Position) => {
    if (!selected) return;
    const { id } = selected;
    if (!rotating) history.push({ id, previous: placed.get(id) });
    placed.set(id, position);
    select();
  };
  const undo = () => {
    const change = history.pop();
    if (!change) return;
    if (change.previous) placed.set(change.id, change.previous);
    else {
      placed.delete(change.id);
      if (added.delete(change.id)) items.delete(change.id);
    }
    select();
  };

  const add = (item: Item, pos: Position) => {
    if (!added.has(item.id)) history.push({ id: item.id, previous: undefined });
    added.add(item.id);
    items.set(item.id, item);
    placed.set(item.id, pos);
    updateModel();
  };

  const removeSelected = () => {
    if (!selected) return;
    const previous = placed.get(selected.id);
    if (!previous) return;
    history.push({ id: selected.id, previous });
    placed.delete(selected.id);
    select();
  };

  return {
    add,
    select,
    place,
    undo,
    removeSelected,
    positions,
    rotate: (angle: number) => {
      rotation = normalizeAngle(angle);
      if (!selected) return;
      const pos = placed.get(selected.id);
      if (!pos || pos.r === rotation) return;
      if (!rotating) history.push({ id: selected.id, previous: pos });
      rotating = true;
      placed.set(selected.id, rotatePosition(selected, pos, rotation));
      updateModel();
    },
    get items() {
      return [...items.values()];
    },
    get additions() {
      return [...items.values()].filter(({ id }) => added.has(id) && placed.has(id));
    },
    get canUndo() {
      return history.length > 0;
    },
    get selected() {
      return selected;
    },
    get rotation() {
      return rotation;
    },
    get placedIds() {
      return [...placed.keys()];
    },
    get model() {
      return model;
    },
    get withoutSelection() {
      return withoutSelection;
    },
    get preview() {
      return preview;
    }
  };
};
