import type { CatalogCriteria } from "./catalog.ts";

export { CATALOG_CATEGORIES, isCatalogCategory } from "./catalog.ts";
export type { CatalogCategory, CatalogCriteria, CatalogSearch } from "./catalog.ts";

export type Point = number[];
export type Position = { x: number; y: number; r: number };
export type Positions = Record<string, Position>;
export type Box = { x: number; y: number; w: number; d: number };
export type Opening = {
  id: string;
  type: string;
  wall: number;
  offset: number;
  width: number;
  hinge: string;
};
export type Room = {
  name: string;
  points: Point[];
  source: string;
  verified: string;
  openings: Opening[];
};
export type Item = {
  id: string;
  name: string;
  kind: string;
  w: number;
  d: number;
  h: number;
  owned: boolean;
  source: string;
  verified: string;
  mode?: string;
  price?: number;
  quantity?: number;
  offerReason?: string;
  demo?: boolean;
  catalogCity?: string;
  catalogCityId?: string;
  catalogCheckedAt?: string;
  cap?: number;
  access?: number;
  material: string;
  materials?: string[];
  seller?: string;
  url?: string;
  availability?: string;
  sku?: string;
  details?: string;
  illustration?: string;
  photo?: string;
};
export type Project = {
  version: number;
  room: Room;
  budget: number;
  catalogCity?: string;
  material: string;
  mode: string;
  passage: number;
  variant: number;
  items: Item[];
  layouts: Record<string, Record<number, Positions>>;
  procurement: Record<string, string>;
};
export type VoicePatch = Partial<Pick<Project, "budget" | "material" | "mode">> & {
  size?: [number, number];
  sofa?: Item;
  purchase?: CatalogCriteria;
};
export type Protection = { salt: Uint8Array<ArrayBuffer>; key: CryptoKey };
export type EncryptedRecord = { encrypted: true; salt: string; iv: string; body: string };
export type Inspection = {
  warnings: { id?: string; other?: string; message: string }[];
  path: Point[];
  state: string;
};
type DialogName =
  | "room"
  | "outline"
  | "voice"
  | "add-owned"
  | "add-buy"
  | "catalog-search"
  | "item"
  | "procurement"
  | "checks"
  | "projects"
  | "privacy"
  | "ar-scan"
  | "ar-view"
  | "new-project"
  | "replan-confirm";

export type PlannerModal = { name: DialogName; id?: string | number };
export type Action = (name: DialogName | "variant" | "replan", id?: string | number) => void;
export type ScanFeature = { type: string; points: Point[] };
export type ScanResult = { points: Point[]; openings: Opening[]; skipped: number; positions?: Positions };
export type XRState = {
  text?: string;
  kind?: string;
  ready?: boolean;
  count?: number;
  positioned?: boolean;
  closed?: boolean;
  closing?: boolean;
  wallLength?: number;
  area?: number;
  perimeter?: number;
  rotation?: number;
  snap?: boolean;
  arranging?: boolean;
  finding?: boolean;
  traceStep?: number;
  canUndo?: boolean;
  measuredItems?: Item[];
  measurement?: string;
  viewEdited?: boolean;
  itemId?: string;
  placedIds?: string[];
};
export type ARMode = "scan" | "view";
export type ExportFormat = "pdf" | "csv" | "json";

export type RoomProps = {
  project: Project;
  save: (room: Room, passage: number) => void;
  close: () => void;
};
