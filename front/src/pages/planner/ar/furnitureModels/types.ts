import type { GLTF } from "@gltf-transform/core";

export const MODEL_VERTEX_SIZE = 12;

export type ModelSampler = {
  mag: number;
  min: number;
  wrapS: number;
  wrapT: number;
};

export type ModelPart = {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
  textureIndex: number | null;
  alphaMode: GLTF.MaterialAlphaMode;
  alphaCutoff: number;
  doubleSided: boolean;
};

export type FurnitureModel = {
  parts: ModelPart[];
  images: (ModelSampler & { bitmap: ImageBitmap })[];
};

export type FurnitureInstance = {
  model: FurnitureModel;
  center: [number, number];
  size: [number, number, number];
  angle: number;
};
