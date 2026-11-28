import type { Point } from "../types/index.ts";

type Placement = { origin: Point; angle: number };

export const createViewAnchor = (space: XRReferenceSpace) => {
  let anchor: XRAnchor | undefined;
  let pending: Placement | undefined;
  let pose: Placement | undefined;
  let revision = 0;

  const set = (placement?: Placement) => {
    revision += 1;
    anchor?.delete();
    anchor = undefined;
    pending = placement;
    pose = placement;
  };

  const request = async (frame: XRFrame, { origin, angle }: Placement, version: number) => {
    if (!frame.createAnchor) return;
    try {
      const transform = new XRRigidTransform(
        { x: origin[0], y: origin[1], z: origin[2] },
        { x: 0, y: -Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }
      );
      const created = await frame.createAnchor(transform, space);
      if (revision === version) anchor = created;
      else created.delete();
    } catch {
      // The measured pose also works on devices without anchors.
    }
  };

  const update = (frame: XRFrame) => {
    if (pending) {
      void request(frame, pending, revision);
      pending = undefined;
    }
    if (anchor) {
      const matrix = frame.getPose(anchor.anchorSpace, space)?.transform.matrix;
      if (matrix) {
        pose = {
          origin: [matrix[12], matrix[13], matrix[14]],
          angle: Math.atan2(matrix[2], matrix[0])
        };
      }
    }
    return pose;
  };

  return { set, update };
};
