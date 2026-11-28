import { load } from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import { getBackend, setBackend } from "@tensorflow/tfjs-core";

const mapping: Record<string, [string, string]> = {
  couch: ["sofa", "Диван"],
  chair: ["chair", "Стул или кресло"],
  "dining table": ["table", "Стол"],
  bed: ["other", "Кровать"],
  bench: ["other", "Скамья"],
  "potted plant": ["other", "Напольное растение"]
};
let model: ReturnType<typeof loadModel> | null;

const loadModel = async () => {
  try {
    if (!getBackend() && !(await setBackend("webgl"))) await setBackend("cpu");
  } catch {
    await setBackend("cpu");
  }
  const modelUrl = new URL("./furniture-model/model.json", document.baseURI).href;
  return load({ base: "lite_mobilenet_v2", modelUrl });
};

export const identifyFurnitureInFrame = async (image: HTMLImageElement | ImageData) => {
  if (!model)
    model = loadModel().catch((error) => {
      model = null;
      throw error;
    });
  const detector = await model;
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const detected = await detector.detect(image, 20, 0.45);
  return detected.flatMap(({ class: key, score, bbox }) => {
    if (!Object.hasOwn(mapping, key)) return [];
    const [kind, title] = mapping[key];
    return [
      {
        kind,
        title,
        score,
        box: bbox.map(
          (value, i) => (100 * value) / (i % 2 === 0 ? width : height)
        )
      }
    ];
  });
};

export const identifyFurniture = async (uri: string) => {
  const image = new Image();
  image.src = uri;
  await image.decode();
  return identifyFurnitureInFrame(image);
};

export type FurnitureMatch = Awaited<ReturnType<typeof identifyFurniture>>[number];
