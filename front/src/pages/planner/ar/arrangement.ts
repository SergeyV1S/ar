import { newId } from "../../../shared/helpers/index.ts";
import { bounds, itemFootprint, polygonFits, round } from "../planning/index.ts";
import type { Item, Point, Position, Positions } from "../types/index.ts";
import { furnitureMesh } from "./furniture.ts";
import type { ScanLayout } from "./geometry.ts";
import { toPlan, toWorld } from "./geometry.ts";

const prototypes = [
  { name: "Диван", kind: "sofa", w: 2.2, d: 0.9, h: 0.83 },
  { name: "Кресло", kind: "chair", w: 0.76, d: 0.78, h: 0.81 },
  { name: "Стол", kind: "table", w: 1, d: 0.8, h: 0.75 }
];

export const createARItem = (item: Pick<Item, "name" | "kind" | "w" | "d" | "h">): Item => ({
  ...item,
  id: newId(),
  owned: true,
  source: "xr",
  verified: "review",
  material: ""
});

export const createARStarterItems = (available: number) =>
  prototypes.slice(0, Math.max(0, available)).map(createARItem);

export const getItemTarget = (layout: ScanLayout, item: Item, hit: Point, rotation: number) => {
  const [x, z] = toPlan(layout, hit);
  const size = bounds(item, { x: 0, y: 0, r: rotation });
  const position = { x: round(x - size.w / 2), y: round(z - size.d / 2), r: rotation };
  return {
    position,
    valid: polygonFits(itemFootprint(item, position), layout.points),
    modelOrigin: toWorld(
      layout,
      position.x + (size.w - item.w) / 2,
      position.y + (size.d - item.d) / 2
    )
  };
};

export const createArrangement = (items: Item[], draftIds: string[] = [], maxAdded = Infinity) => {
  let available = [...items];
  const detectedItems: Item[] = [];
  const manualItems: Item[] = [];
  const drafts = new Set(draftIds);
  const edits = new Map<string, Item>();
  const placed = new Map<string, Position>();
  let history: { id: string; previous: Position | undefined; previousItem?: Item }[] = [];
  let selected: Item | undefined;
  let rotation = 0;
  let model = furnitureMesh([], {});
  let preview = model;

  const positions = (): Positions => Object.fromEntries(placed);
  const updateModel = () => {
    model = furnitureMesh(
      available.filter(({ id }) => id !== selected?.id && placed.has(id)),
      positions()
    );
  };
  const select = (id?: string) => {
    selected = available.find((item) => item.id === id);
    rotation = selected ? (placed.get(selected.id)?.r ?? 0) : 0;
    if (selected) preview = furnitureMesh([selected], { [selected.id]: { x: 0, y: 0, r: 0 } });
    updateModel();
  };
  const canAdd = () => [...placed.keys()].filter((key) => drafts.has(key)).length < maxAdded;
  const canPlace = (id: string) => !drafts.has(id) || placed.has(id) || canAdd();

  const updateItem = (item: Item) => {
    available = available.map((entry) => (entry.id === item.id ? item : entry));
    edits.set(item.id, item);
  };
  const changePosition = (id: string, position?: Position, item?: Item) => {
    history.push({ id, previous: placed.get(id), previousItem: item ? selected : undefined });
    if (item) updateItem(item);
    if (position) placed.set(id, position);
    else placed.delete(id);
    select();
  };
  const place = (position: Position) => {
    if (selected && canPlace(selected.id)) changePosition(selected.id, position);
  };
  const remove = () => {
    if (selected && placed.has(selected.id)) changePosition(selected.id);
  };
  const reshape = (item: Item, position: Position) => {
    if (selected?.id === item.id && canPlace(item.id)) changePosition(item.id, position, item);
  };
  const addManual = (item: Item, position: Position) => {
    if (!canAdd()) return;
    available.push(item);
    manualItems.push(item);
    drafts.add(item.id);
    changePosition(item.id, position);
  };
  const addDetected = (entries: { item: Item; position?: Position }[]) => {
    for (const { item, position } of entries) {
      available.push(item);
      detectedItems.push(item);
      drafts.add(item.id);
      if (position && canPlace(item.id)) placed.set(item.id, position);
    }
    updateModel();
  };
  const clearDetected = () => {
    const ids = new Set(detectedItems.map(({ id }) => id));
    available = available.filter(({ id }) => !ids.has(id));
    history = history.filter(({ id }) => !ids.has(id));
    for (const id of ids) {
      drafts.delete(id);
      edits.delete(id);
      placed.delete(id);
    }
    detectedItems.length = 0;
    select();
  };
  const undo = () => {
    const change = history.pop();
    if (!change) return;
    if (change.previous) placed.set(change.id, change.previous);
    else placed.delete(change.id);
    if (change.previousItem) updateItem(change.previousItem);
    select();
  };

  return {
    select,
    place,
    remove,
    reshape,
    addManual,
    canAdd,
    addDetected,
    clearDetected,
    canPlace,
    undo,
    positions,
    rotate: () => {
      rotation = (rotation + 90) % 360;
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
    get detectedItems() {
      return detectedItems;
    },
    get manualItems() {
      return manualItems;
    },
    get itemsForSave() {
      return [...detectedItems, ...manualItems, ...edits.values()];
    },
    get canUndo() {
      return history.length > 0;
    },
    get model() {
      return model;
    },
    get preview() {
      return preview;
    }
  };
};
