import type { FurnitureMatch } from "./detections.ts";
import type { DetectionRequest, DetectionResponse, ImageRotation } from "./types.ts";

export type { FurnitureMatch } from "./detections.ts";
export type { ImageRotation } from "./types.ts";

let worker: Worker | undefined;
let sequence = 0;

const pending = new Map<
  number,
  {
    resolve: (matches: FurnitureMatch[]) => void;
    reject: (error: Error) => void;
  }
>();

const getWorker = () => {
  if (worker) return worker;
  const detector = new Worker(new URL("./detector.worker.ts", import.meta.url), { type: "module" });
  detector.onmessage = ({ data }: MessageEvent<DetectionResponse>) => {
    const request = pending.get(data.id);
    pending.delete(data.id);
    if (data.matches) request?.resolve(data.matches);
    else request?.reject(new Error("Furniture detection failed"));
  };
  detector.onerror = () => {
    if (worker !== detector) return;
    detector.terminate();
    worker = undefined;
    for (const request of pending.values())
      request.reject(new Error("Furniture detector unavailable"));
    pending.clear();
  };
  worker = detector;
  return detector;
};

export const recognizeFurniture = async (
  image: HTMLImageElement | ImageData,
  rotation: ImageRotation = 0
) => {
  const detector = getWorker();
  const bitmap = await createImageBitmap(image);
  if (detector !== worker) {
    bitmap.close();
    throw new Error("Furniture detector unavailable");
  }
  return new Promise<FurnitureMatch[]>((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    const request: DetectionRequest = { id, bitmap, rotation };
    try {
      detector.postMessage(request, [bitmap]);
    } catch (error) {
      pending.delete(id);
      bitmap.close();
      reject(error);
    }
  });
};

export const identifyFurniture = async (uri: string) => {
  const image = new Image();
  image.src = uri;
  await image.decode();
  return recognizeFurniture(image);
};
