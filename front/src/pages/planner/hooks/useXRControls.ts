import type { ChangeEvent } from "react";

import type { XRControlsProps } from "../components/index.ts";
import { getARCollectLabel } from "../helpers/index.ts";

export const useXRControls = ({ mode, state, control }: XRControlsProps) => {
  const scan = mode === "scan";
  const changeKind = (event: ChangeEvent<HTMLSelectElement>) => control("kind", event.target.value);
  const changeItem = (event: ChangeEvent<HTMLSelectElement>) =>
    control("selectItem", event.target.value);
  const arrange = () => control("arrange");
  const exit = () => control("exit");
  const undo = () => control("undo");
  const save = () => control("save");
  const closeOutline = () => control("closeOutline");
  const collect = () => control("collect");
  const toggleSnap = () => control("toggleSnap");
  const rotate = (event: ChangeEvent<HTMLInputElement>) => control("rotate", event.target.value);
  const findObjects = () => control("findObjects");
  const trace = () => control("trace");
  const removeItem = () => control("removeItem");
  const collectLabel = getARCollectLabel(mode, state);
  const tracing = state.traceStep !== undefined;
  const showCollect =
    !state.finding &&
    (state.arranging
      ? Boolean(state.itemId)
      : !scan || !state.closed || state.kind !== "corner" || tracing);
  const canClose = scan && !state.closed && !state.closing && (state.count ?? 0) >= 3;
  const canUndo =
    !state.finding &&
    (tracing
      ? Boolean(state.traceStep)
      : !scan || Boolean(state.canUndo || (!state.arranging && state.count)));
  const canRotate = state.arranging ? Boolean(state.itemId) : !scan && state.positioned;
  const canRemove =
    state.arranging && Boolean(state.itemId && state.placedIds?.includes(state.itemId));
  return {
    scan,
    collectLabel,
    showCollect,
    canClose,
    canUndo,
    canRotate,
    canRemove,
    tracing,
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
    rotate,
    findObjects,
    trace,
    removeItem
  };
};
