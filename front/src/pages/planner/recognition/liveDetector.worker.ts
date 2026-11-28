/// <reference lib="webworker" />
import { Tensor } from "onnxruntime-web/wasm";

import { decodeLiveDetections, liveOutputChannels } from "./liveDetections.ts";
import { liveInputSize, prepareLiveImage } from "./liveImage.ts";
import type { DetectionResponse, LiveFrame } from "./types.ts";
import { loadModel } from "./wasmRuntime.ts";

declare const self: DedicatedWorkerGlobalScope;

let model: ReturnType<typeof loadModel> | undefined;

const detect = async (frame: LiveFrame) => {
  model ??= loadModel("yolo11n-coco-v1.onnx", {
    batch: 1,
    height: liveInputSize,
    width: liveInputSize
  });
  const detector = await model;
  const { values, image } = prepareLiveImage(frame);
  const tensor = new Tensor("float32", values, [1, 3, liveInputSize, liveInputSize]);
  try {
    const output = await detector.run({ images: tensor });
    try {
      const prediction = output.output0;
      if (
        !(prediction?.data instanceof Float32Array) ||
        prediction.dims.length !== 3 ||
        prediction.dims[0] !== 1 ||
        prediction.dims[1] !== liveOutputChannels
      ) {
        throw new Error("Unexpected YOLO11n output");
      }
      return decodeLiveDetections(prediction.data, image);
    } finally {
      Object.values(output).forEach((value) => value.dispose());
    }
  } finally {
    tensor.dispose();
  }
};

self.onmessage = async ({ data }: MessageEvent<LiveFrame>) => {
  let matches: DetectionResponse = null;
  try {
    matches = await detect(data);
  } catch (error) {
    console.error("Live furniture detection failed", error);
  }
  self.postMessage(matches);
};
