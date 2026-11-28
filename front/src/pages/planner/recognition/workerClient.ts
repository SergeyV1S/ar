import type { DetectionResponse, FurnitureMatch } from "./types.ts";

export const createDetectionClient = <Frame>(worker: Worker) => {
  let disposed = false;
  let pending:
    | {
        resolve: (matches: FurnitureMatch[]) => void;
        reject: (error: Error) => void;
      }
    | undefined;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    worker.terminate();
    pending?.reject(new Error("Furniture detector stopped"));
    pending = undefined;
  };

  worker.onmessage = ({ data }: MessageEvent<DetectionResponse>) => {
    const request = pending;
    pending = undefined;
    if (data) request?.resolve(data);
    else request?.reject(new Error("Furniture detection failed"));
  };
  worker.onerror = dispose;
  worker.onmessageerror = dispose;

  const detect = (frame: Frame, transfer: Transferable[]) =>
    new Promise<FurnitureMatch[]>((resolve, reject) => {
      if (disposed || pending) {
        reject(new Error("Furniture detector unavailable"));
        return;
      }
      pending = { resolve, reject };
      try {
        worker.postMessage(frame, transfer);
      } catch (error) {
        pending = undefined;
        reject(error);
      }
    });

  return { detect, dispose };
};
