import { newId } from "../../../shared/helpers/index.ts";
import { bounds, fits, round } from "../planning/index.ts";
import type { Item, Point, Position, Positions } from "../types/index.ts";
import { furnitureMesh } from "./furniture.ts";
import type { getScanLayout } from "./geometry.ts";
import { toRoom } from "./geometry.ts";

type ScanLayout = NonNullable<ReturnType<typeof getScanLayout>>;

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

export const aimAtFloor = (camera: Float32Array, floor: number): Point | null => {
  const down = camera[9];
  if (down <= 0.01) return null;
  const distance = (camera[13] - floor) / down;
  if (distance <= 0 || distance > 35) return null;
  return [camera[12] - camera[8] * distance, floor, camera[14] - camera[10] * distance];
};

const toWorld = ({ origin, frame }: ScanLayout, x: number, z: number): Point => [
  origin[0] + x * frame.cos - z * frame.sin,
  origin[1],
  origin[2] + x * frame.sin + z * frame.cos
];

export const getItemTarget = (layout: ScanLayout, item: Item, hit: Point, rotation: number) => {
  const [x, z] = toRoom({ ...layout.frame, x: layout.origin[0], z: layout.origin[2] }, hit);
  const size = bounds(item, { x: 0, y: 0, r: rotation });
  const position = { x: round(x - size.w / 2), y: round(z - size.d / 2), r: rotation };
  return {
    position,
    valid: fits(bounds(item, position), layout.points),
    modelOrigin: toWorld(
      layout,
      position.x + (size.w - item.w) / 2,
      position.y + (size.d - item.d) / 2
    )
  };
};

export const createArrangement = (items: Item[]) => {
  const placed = new Map<string, Position>();
  const history: { id: string; previous: Position | undefined }[] = [];
  let selected: Item | undefined;
  let rotation = 0;
  let model = furnitureMesh([], {});
  let preview = model;

  const positions = (): Positions => Object.fromEntries(placed);
  const updateModel = () => {
    model = furnitureMesh(items.filter(({ id }) => id !== selected?.id && placed.has(id)), positions());
  };
  const select = (id?: string) => {
    selected = items.find((item) => item.id === id);
    rotation = selected ? (placed.get(selected.id)?.r ?? 0) : 0;
    if (selected) preview = furnitureMesh([selected], { [selected.id]: { x: 0, y: 0, r: 0 } });
    updateModel();
  };
  const place = (position: Position) => {
    if (!selected) return;
    const { id } = selected;
    history.push({ id, previous: placed.get(id) });
    placed.set(id, position);
    select();
  };
  const undo = () => {
    const change = history.pop();
    if (!change) return;
    if (change.previous) placed.set(change.id, change.previous);
    else placed.delete(change.id);
    select();
  };

  return {
    select,
    place,
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
    get model() {
      return model;
    },
    get preview() {
      return preview;
    }
  };
};
