/// <reference lib="webworker" />
import loaderUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { InferenceSession, Tensor, env } from "onnxruntime-web/wasm";

import { decodeDetections } from "./detections.ts";
import type { DetectionRequest, DetectionResponse, ImageRotation } from "./types.ts";

declare const self: DedicatedWorkerGlobalScope;

const maxEdge = 640;
const maxPixels = 640 * 400;
const patchSize = 16;
const mean = [0.48145466, 0.4578275, 0.40821073];
const deviation = [0.26862954, 0.26130258, 0.27577711];

env.wasm.wasmPaths = {
  mjs: new URL(loaderUrl, self.location.origin),
  wasm: new URL(wasmUrl, self.location.origin)
};
env.wasm.numThreads = self.crossOriginIsolated ? 4 : 1;

let model: Promise<InferenceSession> | undefined;

const getModel = () => {
  model ??= InferenceSession.create(
    `${import.meta.env.BASE_URL}furniture-model/owlv2-furniture-v1.onnx`,
    { executionProviders: ["wasm"] }
  ).catch((error: unknown) => {
    model = undefined;
    throw error;
  });
  return model;
};

const tensorFromImage = (bitmap: ImageBitmap, rotation: ImageRotation) => {
  const swapAxes = rotation === 90 || rotation === 270;
  const scale = Math.min(
    maxEdge / Math.max(bitmap.width, bitmap.height),
    Math.sqrt(maxPixels / (bitmap.width * bitmap.height))
  );
  const rawWidth = Math.max(1, Math.round(bitmap.width * scale));
  const rawHeight = Math.max(1, Math.round(bitmap.height * scale));
  const width = swapAxes ? rawHeight : rawWidth;
  const height = swapAxes ? rawWidth : rawHeight;
  const inputWidth = Math.ceil(width / patchSize) * patchSize;
  const inputHeight = Math.ceil(height / patchSize) * patchSize;
  const canvas = new OffscreenCanvas(inputWidth, inputHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare furniture image");

  context.fillStyle = "#808080";
  context.fillRect(0, 0, inputWidth, inputHeight);
  if (rotation === 90 || rotation === 180) context.translate(width, 0);
  if (rotation === 180 || rotation === 270) context.translate(0, height);
  context.rotate((rotation * Math.PI) / 180);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, rawWidth, rawHeight);

  const { data } = context.getImageData(0, 0, inputWidth, inputHeight);
  const pixels = inputWidth * inputHeight;
  const values = new Float32Array(3 * pixels);
  for (let channel = 0; channel < 3; channel++) {
    for (let i = 0; i < pixels; i++) {
      values[channel * pixels + i] =
        (data[i * 4 + channel] / 255 - mean[channel]) / deviation[channel];
    }
  }
  const tensor = new Tensor("float32", values, [1, 3, inputHeight, inputWidth]);
  return { tensor, width, height };
};

const detect = async ({ bitmap, rotation }: DetectionRequest) => {
  const { tensor, width, height } = tensorFromImage(bitmap, rotation);
  try {
    const detector = await getModel();
    const output = await detector.run({ pixel_values: tensor });
    try {
      const { logits, pred_boxes: boxes } = output;
      if (!(logits?.data instanceof Float32Array) || !(boxes?.data instanceof Float32Array)) {
        throw new Error("Unexpected furniture model tensors");
      }
      // Both axes of the trained box priors use the original square grid.
      return decodeDetections(logits.data, boxes.data, width / maxEdge, height / maxEdge);
    } finally {
      Object.values(output).forEach((value) => value.dispose());
    }
  } finally {
    tensor.dispose();
  }
};

self.onmessage = async (event: MessageEvent<DetectionRequest>) => {
  const request = event.data;
  let matches: DetectionResponse["matches"] = null;
  try {
    matches = await detect(request);
  } catch (error) {
    console.error("Furniture detection failed", error);
  } finally {
    request.bitmap.close();
    const response: DetectionResponse = { id: request.id, matches };
    self.postMessage(response);
  }
};
