import type { createARCamera } from "./camera.ts";
import { pointVertices, projectDepthGrid, readCenterDepth, readDepthMap } from "./depth.ts";
import type { ScanLayout } from "./geometry.ts";
import { rgb } from "./mesh.ts";
import { createSurfaceScan } from "./surfaceScan.ts";

type Camera = ReturnType<typeof createARCamera>;
const emptyPoints = new Float32Array(0);
const depthColor = rgb("#c0b5ef");
const objectColor = rgb("#63f2d0");

export const createFurnitureScanner = (camera: Camera, capacity: number, depthEnabled: boolean) => {
  let search: { layout: ScanLayout; surfaces: ReturnType<typeof createSurfaceScan> } | undefined;
  let available = depthEnabled;
  let canLabel = Boolean(camera);
  let labeling = false;
  let hasAnalyzed = false;
  let nextProbe = 0;
  let nextDepth = 0;
  let nextRefresh = 0;
  let nextLabels = 0;
  let cloud = emptyPoints;
  let highlights = emptyPoints;

  const start = (layout: ScanLayout) => {
    if (!available || search || capacity <= 0) return false;
    search = { layout, surfaces: createSurfaceScan(layout, capacity) };
    hasAnalyzed = false;
    nextDepth = 0;
    nextRefresh = 0;
    nextLabels = 0;
    return true;
  };

  const cancel = () => {
    search = undefined;
    cloud = emptyPoints;
    highlights = emptyPoints;
  };

  const finish = () => {
    const active = search;
    active?.surfaces.refresh();
    const entries = active?.surfaces.results() ?? [];
    cancel();
    return entries;
  };

  const update = (time: number, frame: XRFrame, view: XRView) => {
    if (!available && time >= nextProbe) {
      nextProbe = time + 500;
      available = readCenterDepth(frame, view) !== null;
    }
    if (!search || time < nextDepth) return;
    nextDepth = time + 220;
    const active = search;
    const depth = readDepthMap(frame, view);
    if (!depth) {
      cloud = emptyPoints;
      return;
    }
    const grid = projectDepthGrid(
      active.layout,
      {
        transform: view.transform.matrix,
        projection: view.projectionMatrix
      },
      depth
    );
    const points = grid.points.filter((point) => point !== null);
    cloud = pointVertices(points, depthColor, 0.6);
    if (!points.length) return;
    hasAnalyzed = true;
    const keys = active.surfaces.capture(grid);
    if (time >= nextRefresh) {
      nextRefresh = time + 550;
      active.surfaces.refresh();
      highlights = pointVertices(active.surfaces.highlightPoints(), objectColor, 1);
    }
    if (!camera || !canLabel || !view.camera || labeling || time < nextLabels) return;
    nextLabels = time + 1100;
    try {
      const pixels = camera.read(view);
      if (!pixels) return;
      labeling = true;
      void import("../recognition/index.ts")
        .then(({ identifyFurnitureInFrame }) => identifyFurnitureInFrame(pixels))
        .then((matches) => {
          if (search === active) active.surfaces.label(keys, grid.width, grid.height, matches);
        })
        .catch(() => {
          canLabel = false;
        })
        .finally(() => {
          labeling = false;
        });
    } catch {
      canLabel = false;
    }
  };

  return {
    start,
    update,
    finish,
    cancel,
    dispose: () => {
      cancel();
      camera?.dispose();
    },
    get available() {
      return available;
    },
    get active() {
      return search !== undefined;
    },
    get hasAnalyzed() {
      return hasAnalyzed;
    },
    get foundCount() {
      return search?.surfaces.count ?? 0;
    },
    get cloud() {
      return cloud;
    },
    get highlights() {
      return highlights;
    }
  };
};
