import loaderUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { InferenceSession, env } from "onnxruntime-web/wasm";

env.wasm.wasmPaths = {
  mjs: new URL(loaderUrl, self.location.origin),
  wasm: new URL(wasmUrl, self.location.origin)
};
env.wasm.numThreads = 1;

export const loadModel = (
  fileName: string,
  freeDimensionOverrides?: InferenceSession.SessionOptions["freeDimensionOverrides"]
) =>
  InferenceSession.create(
    new URL(`${import.meta.env.BASE_URL}furniture-model/${fileName}`, self.location.origin).href,
    { executionProviders: ["wasm"], freeDimensionOverrides }
  );
