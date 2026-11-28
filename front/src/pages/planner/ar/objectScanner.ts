import { newId } from "../../../shared/helpers/index.ts";
import { distance, pointIn } from "../planning/index.ts";
import { createLiveFurnitureDetector } from "../recognition/index.ts";
import type { ScanLayout } from "./geometry.ts";
import type { ObjectMeasurement } from "./objectMeasurement.ts";
import {
  combineMeasurements,
  measureObject,
  measurementsMatch,
  observationsMatch
} from "./objectMeasurement.ts";
import type { CameraPose } from "./projection.ts";
import { getCameraRotation } from "./projection.ts";
import { restrictRoomFrame } from "./roomImage.ts";
import { getDepth, readDepth } from "./tracking.ts";

type Track = { id: string; samples: ObjectMeasurement[]; lastFrame: number; confirmed: boolean };

export const createObjectTracks = () => {
  let tracks: Track[] = [];
  let frame = 0;
  return (objects: ObjectMeasurement[]) => {
    frame++;
    tracks = tracks.filter((track) => track.confirmed || frame - track.lastFrame <= 5);
    const results: { id: string; measurement: ObjectMeasurement }[] = [];
    const seen: ObjectMeasurement[] = [];
    for (const object of [...objects].sort((a, b) => b.score - a.score)) {
      if (seen.some((previous) => measurementsMatch(previous, object))) continue;
      seen.push(object);
      const candidates = tracks.flatMap((track) => {
        if (track.lastFrame === frame) return [];
        const previous = combineMeasurements(track.samples);
        if (!observationsMatch(previous, object)) return [];
        return [{ track, previous, distance: distance(previous.center, object.center) }];
      });
      const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
      if (!nearest) {
        if (tracks.length < 80)
          tracks.push({ id: newId(), samples: [object], lastFrame: frame, confirmed: false });
        continue;
      }
      const { track, previous } = nearest;
      track.lastFrame = frame;
      if (track.confirmed && previous.name !== object.name) continue;
      track.samples = [...track.samples.slice(-8), object];
      const reliable = track.samples.filter((sample) => sample.measured).length >= 2;
      if (!reliable && track.samples.length < 3 && !track.confirmed) continue;
      if (!track.confirmed) {
        const classified = track.samples.find((sample) => sample.measured) ?? track.samples[0];
        track.samples = track.samples.filter((sample) => sample.name === classified.name);
      }
      track.confirmed = true;
      results.push({ id: track.id, measurement: combineMeasurements(track.samples) });
    }
    return results;
  };
};

type Options = {
  readImage: (view: XRView) => ImageData | null;
  publish: (id: string, measurement: ObjectMeasurement) => void;
  onError: (message: string) => void;
};

export const createObjectScanner = ({ readImage, publish, onError }: Options) => {
  let process: ReturnType<typeof createObjectTracks> | null = null;
  let lastCapture: number | null = null;
  let waitSince: number | null = null;
  let detector: ReturnType<typeof createLiveFurnitureDetector> | null = null;
  let isDetecting = false;
  const stop = () => {
    process = null;
    isDetecting = false;
    detector?.dispose();
    detector = null;
  };
  const start = () => {
    stop();
    process = createObjectTracks();
    lastCapture = null;
    waitSince = null;
  };
  const fail = (message: string) => {
    stop();
    onError(message);
  };
  const update = (time: number, frame: XRFrame, view: XRView, layout: ScanLayout) => {
    if (!process || isDetecting || (lastCapture !== null && time - lastCapture < 650)) return;
    lastCapture = time;
    let image: ImageData | null;
    try {
      image = readImage(view);
    } catch {
      fail("Не удалось прочитать AR-камеру. Выделите предмет вручную.");
      return;
    }
    if (!image) {
      waitSince ??= time;
      if (time - waitSince > 2000)
        fail("Браузер не дал доступ к кадрам камеры. Выделите предмет вручную.");
      return;
    }
    waitSince = null;
    const transform = view.transform.matrix.slice();
    const rotation = getCameraRotation(transform);
    const camera: CameraPose = {
      transform,
      projection: view.projectionMatrix.slice(),
      rotation
    };
    const info = getDepth(frame, view);
    const depth = restrictRoomFrame(image, layout, camera, (u, v) => readDepth(info, u, v));
    if (!depth) return;
    const request = process;
    isDetecting = true;
    void Promise.resolve()
      .then(() => {
        if (process !== request) return [];
        detector ??= createLiveFurnitureDetector();
        return detector.detect(image, rotation);
      })
      .then((matches) => {
        if (process !== request) return;
        const objects = matches
          .map((match) => measureObject(layout, camera, depth, match))
          .filter((object) => object !== null);
        for (const { id, measurement } of request(objects)) {
          if (process !== request) break;
          if (pointIn(measurement.center, layout.points)) publish(id, measurement);
        }
      })
      .catch(() => {
        if (process === request)
          fail("Не удалось распознать мебель. Выделите предмет вручную или повторите поиск.");
      })
      .finally(() => {
        if (process === request) isDetecting = false;
      });
  };
  return { start, stop, update };
};
