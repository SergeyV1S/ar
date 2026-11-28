import type { ChangeEvent } from "react";

import type { XRControlsProps } from "../components/index.ts";
import { getARCollectLabel } from "../helpers/index.ts";

export const useXRControls = ({ mode, state, control }: XRControlsProps) => {
  const scan = mode === "scan";
  const changeKind = (event: ChangeEvent<HTMLSelectElement>) => control("kind", event.target.value);
  const changeItem = (event: ChangeEvent<HTMLSelectElement>) => control("selectItem", event.target.value);
  const arrange = () => control("arrange");
  const exit = () => control("exit");
  const undo = () => control("undo");
  const save = () => control("save");
  const closeOutline = () => control("closeOutline");
  const collect = () => control("collect");
  const toggleSnap = () => control("toggleSnap");
  const rotate = () => control("rotate");
  const collectLabel = getARCollectLabel(mode, state);
  const showCollect = state.arranging ? Boolean(state.itemId) : !scan || !state.closed || state.kind !== "corner";
  const canClose = scan && !state.closed && !state.closing && (state.count ?? 0) >= 3;
  const canUndo = state.arranging ? Boolean(state.placedIds?.length) : !scan || Boolean(state.count);
  const canRotate = state.arranging ? Boolean(state.itemId) : !scan && state.positioned;
  return {
    scan,
    collectLabel,
    showCollect,
    canClose,
    canUndo,
    canRotate,
    snap: state.snap !== false,
    changeKind,
    changeItem,
    arrange,
    exit,
    undo,
    save,
    closeOutline,
    collect,
    toggleSnap,
    rotate
  };
};
