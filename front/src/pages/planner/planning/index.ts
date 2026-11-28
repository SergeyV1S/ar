export {
  area,
  arrange,
  bounds,
  clamp,
  dimensions,
  distance,
  fits,
  inspect,
  itemFootprint,
  maxItemOutlinePoints,
  maxOutlinePoints,
  minItemOutlineArea,
  normalize,
  normalizeWithOrigin,
  pointIn,
  polygonFits,
  rect,
  round,
  segmentDistance,
  validPolygon,
  variants
} from "./geometry.ts";
export { canvasContext, drawPlan } from "./drawing.ts";
export type { Drawing } from "./drawing.ts";
export {
  localMeshPoints,
  maxMeshTriangles,
  maxMeshVertices,
  meshCoordinateScale,
  meshTriangles
} from "./scannedMesh.ts";
