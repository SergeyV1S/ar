import type { ChangeEvent } from "react";

import type { XRControlsProps } from "../components/index.ts";
import { getARCollectLabel } from "../helpers/index.ts";

export const useXRControls = ({ mode, state, control }: XRControlsProps) => {
  const scan = mode === "scan";
  const changeKind = (event: ChangeEvent<HTMLSelectElement>) => control("kind", event.target.value);
  const exit = () => control("exit");
  const undo = () => control("undo");
  const save = () => control("save");
  const closeOutline = () => control("closeOutline");
  const collect = () => control("collect");
  const toggleSnap = () => control("toggleSnap");
  const rotate = () => control("rotate");
  const collectLabel = getARCollectLabel(mode, state);
  const showCollect = !scan || !state.closed || state.kind !== "corner";
  const canClose = scan && !state.closed && !state.closing && (state.count ?? 0) >= 3;
  return {
    scan,
    collectLabel,
    showCollect,
    canClose,
    snap: state.snap !== false,
    changeKind,
    exit,
    undo,
    save,
    closeOutline,
    collect,
    toggleSnap,
    rotate
  };
};
