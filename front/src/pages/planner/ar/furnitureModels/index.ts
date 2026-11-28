import type { CatalogCategory, Item } from "../../types/index.ts";
import { getFurnitureCategory } from "./category.ts";
import type { FurnitureModel } from "./types.ts";

export { getFurnitureCategory } from "./category.ts";
export { MODEL_VERTEX_SIZE } from "./types.ts";
export type { FurnitureInstance, FurnitureModel, ModelPart } from "./types.ts";

export type FurnitureModelLookup = (item: Item) => FurnitureModel | undefined;

const textureSize = (size: number) => Math.min(2048, 2 ** Math.ceil(Math.log2(size)));

const loadModel = async (
  category: CatalogCategory,
  signal: AbortSignal
): Promise<FurnitureModel> => {
  const response = await fetch(`${import.meta.env.BASE_URL}models/furniture/${category}.glb`, {
    signal,
    headers: { Accept: "model/gltf-binary" }
  });
  if (!response.ok) throw new Error("Модель мебели недоступна.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { readFurnitureModel } = await import("./geometry.ts");
  signal.throwIfAborted();
  const { parts, textures } = await readFurnitureModel(bytes);
  const images: FurnitureModel["images"] = [];
  try {
    for (const { bytes, mimeType, size, sampler } of textures) {
      signal.throwIfAborted();
      // WebGL 1 requires power-of-two sizes for repeating textures and mipmaps.
      const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }), {
        resizeWidth: textureSize(size[0]),
        resizeHeight: textureSize(size[1]),
        resizeQuality: "high",
        premultiplyAlpha: "none",
        colorSpaceConversion: "none"
      });
      images.push({ bitmap, ...sampler });
    }
    signal.throwIfAborted();
    return { parts, images };
  } catch (error) {
    images.forEach(({ bitmap }) => bitmap.close());
    throw error;
  }
};

export const createFurnitureModels = (onLoad: () => void) => {
  const controller = new AbortController();
  const cache = new Map<CatalogCategory, FurnitureModel | undefined>();
  const get: FurnitureModelLookup = (item) => {
    const category = getFurnitureCategory(item);
    if (!category || controller.signal.aborted) return;
    if (!cache.has(category)) {
      cache.set(category, undefined);
      void loadModel(category, controller.signal).then(
        (model) => {
          if (controller.signal.aborted) {
            model.images.forEach(({ bitmap }) => bitmap.close());
            return;
          }
          cache.set(category, model);
          onLoad();
        },
        () => {
          // Keep the block visible. A new AR session can retry the file.
        }
      );
    }
    return cache.get(category);
  };

  const dispose = () => {
    controller.abort();
    cache.forEach((model) => model?.images.forEach(({ bitmap }) => bitmap.close()));
    cache.clear();
  };

  return { get, dispose };
};
