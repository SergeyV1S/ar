/// <reference lib="webworker" />
import { Tensor } from "onnxruntime-web/wasm";

import { decodeDetections } from "./detections.ts";
import type { DetectionResponse } from "./types.ts";
import { loadModel } from "./wasmRuntime.ts";

declare const self: DedicatedWorkerGlobalScope;

const maxEdge = 640;
const maxPixels = 640 * 400;
const patchSize = 16;
const mean = [0.48145466, 0.4578275, 0.40821073];
const deviation = [0.26862954, 0.26130258, 0.27577711];

const tensorFromImage = (bitmap: ImageBitmap) => {
  const scale = Math.min(
    maxEdge / Math.max(bitmap.width, bitmap.height),
    Math.sqrt(maxPixels / (bitmap.width * bitmap.height))
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const inputWidth = Math.ceil(width / patchSize) * patchSize;
  const inputHeight = Math.ceil(height / patchSize) * patchSize;
  const canvas = new OffscreenCanvas(inputWidth, inputHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare furniture image");

  context.fillStyle = "#808080";
  context.fillRect(0, 0, inputWidth, inputHeight);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);

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

const detect = async (bitmap: ImageBitmap) => {
  const { tensor, width, height } = tensorFromImage(bitmap);
  try {
    const detector = await loadModel("owlv2-furniture-v1.onnx");
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

self.onmessage = async ({ data: bitmap }: MessageEvent<ImageBitmap>) => {
  let matches: DetectionResponse = null;
  try {
    matches = await detect(bitmap);
  } catch (error) {
    console.error("Photo furniture detection failed", error);
  } finally {
    bitmap.close();
    self.postMessage(matches);
  }
};
