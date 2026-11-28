import type { ImageRotation, LiveFrame } from "./types.ts";
import { createDetectionClient } from "./workerClient.ts";

export { cameraImagePoint } from "./imageRotation.ts";
export type { FurnitureMatch, ImageRotation } from "./types.ts";

export const createLiveFurnitureDetector = () => {
  const detector = createDetectionClient<LiveFrame>(
    new Worker(new URL("./liveDetector.worker.ts", import.meta.url), { type: "module" })
  );
  const detect = ({ data, width, height }: ImageData, rotation: ImageRotation = 0) =>
    detector.detect({ data, width, height, rotation }, [data.buffer]);
  return { detect, dispose: detector.dispose };
};

export const identifyFurniture = async (uri: string, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const image = new Image();
  image.src = uri;
  await image.decode();
  signal?.throwIfAborted();
  const bitmap = await createImageBitmap(image);
  try {
    signal?.throwIfAborted();
    const detector = createDetectionClient<ImageBitmap>(
      new Worker(new URL("./photoDetector.worker.ts", import.meta.url), { type: "module" })
    );
    signal?.addEventListener("abort", detector.dispose, { once: true });
    try {
      return await detector.detect(bitmap, [bitmap]);
    } finally {
      signal?.removeEventListener("abort", detector.dispose);
      detector.dispose();
    }
  } finally {
    bitmap.close();
  }
};
