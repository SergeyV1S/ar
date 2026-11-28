import { newId } from "../../../shared/helpers/index.ts";
import type { ScanLayout } from "./geometry.ts";
import type { ObjectMeasurement } from "./objectMeasurement.ts";
import {
  combineMeasurements,
  depthGridSize,
  measureObject,
  measurementsMatch
} from "./objectMeasurement.ts";
import type { CameraPose } from "./projection.ts";
import { cameraImagePoint, getCameraRotation } from "./projection.ts";
import { getDepth, readDepth } from "./tracking.ts";

type Track = { id: string; samples: ObjectMeasurement[]; lastFrame: number; confirmed: boolean };

export const createObjectTracks = () => {
  let tracks: Track[] = [];
  let frame = 0;
  return (objects: ObjectMeasurement[]) => {
    frame++;
    tracks = tracks.filter((track) => track.confirmed || frame - track.lastFrame <= 5);
    const results: { id: string; measurement: ObjectMeasurement }[] = [];
    for (const object of [...objects].sort((a, b) => b.score - a.score)) {
      const candidates = tracks.flatMap((track) => {
        if (track.lastFrame === frame) return [];
        const previous = combineMeasurements(track.samples);
        if (!measurementsMatch(previous, object)) return [];
        return [
          {
            track,
            distance: Math.hypot(
              previous.center[0] - object.center[0],
              previous.center[1] - object.center[1]
            )
          }
        ];
      });
      const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
      if (!nearest) {
        if (tracks.length < 80)
          tracks.push({ id: newId(), samples: [object], lastFrame: frame, confirmed: false });
        continue;
      }
      const { track } = nearest;
      track.lastFrame = frame;
      track.samples = [...track.samples.slice(-8), object];
      const reliable = track.samples.filter((sample) => sample.measured).length >= 2;
      if (!reliable && track.samples.length < 3 && !track.confirmed) continue;
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
  let inFlight = false;
  const stop = () => {
    process = null;
  };
  const start = () => {
    process = createObjectTracks();
    lastCapture = null;
    waitSince = null;
  };
  const fail = (message: string) => {
    stop();
    onError(message);
  };
  const update = (time: number, frame: XRFrame, view: XRView, layout: ScanLayout) => {
    if (!process || inFlight || (lastCapture !== null && time - lastCapture < 650)) return;
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
    const depth = new Float32Array(depthGridSize ** 2);
    const info = getDepth(frame, view);
    if (info) {
      for (let i = 0; i < depth.length; i++) {
        const u = (i % depthGridSize) / (depthGridSize - 1);
        const v = Math.floor(i / depthGridSize) / (depthGridSize - 1);
        const [cameraU, cameraV] = cameraImagePoint(rotation, u, v);
        depth[i] = readDepth(info, cameraU, cameraV) ?? 0;
      }
    }
    const request = process;
    inFlight = true;
    void import("../recognition/index.ts")
      .then(({ recognizeFurniture }) => recognizeFurniture(image, rotation))
      .then((matches) => {
        if (process !== request) return;
        const objects = matches
          .map((match) => measureObject(layout, camera, depth, match))
          .filter((object) => object !== null);
        for (const { id, measurement } of request(objects)) {
          if (process !== request) break;
          publish(id, measurement);
        }
      })
      .catch(() => {
        if (process === request)
          fail("Не удалось распознать мебель. Выделите предмет вручную или повторите поиск.");
      })
      .finally(() => {
        inFlight = false;
      });
  };
  return { start, stop, update };
};
