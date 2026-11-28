import type { ChangeEvent } from "react";

import type { XRControlsProps } from "../components/index.ts";
import { getARCollectLabel, getARHeading } from "../helpers/index.ts";

export const useXRControls = ({ mode, state, items, control }: XRControlsProps) => {
  const scan = mode === "scan";
  const changeKind = (event: ChangeEvent<HTMLSelectElement>) => control("kind", event.target.value);
  const changeItem = (event: ChangeEvent<HTMLSelectElement>) => control("selectItem", event.target.value);
  const arrange = () => control("arrange");
  const findFurniture = () => control("findFurniture");
  const finishFurnitureSearch = () => control("finishFurnitureSearch");
  const skipFurnitureSearch = () => control("skipFurnitureSearch");
  const removePlacement = () => control("removePlacement");
  const startItemTrace = () => control("startItemTrace");
  const closeItemOutline = () => control("closeItemOutline");
  const cancelItemTrace = () => control("cancelItemTrace");
  const exit = () => control("exit");
  const undo = () => control("undo");
  const save = () => control("save");
  const closeOutline = () => control("closeOutline");
  const collect = () => control("collect");
  const toggleSnap = () => control("toggleSnap");
  const rotate = () => control("rotate");
  const collectLabel = getARCollectLabel(mode, state);
  const heading = getARHeading(mode, state);
  const collectAllowed = state.arranging ? Boolean(state.itemId) : !scan || !state.closed || state.kind !== "corner";
  const showCollect = !state.searchingFurniture && (collectAllowed || Boolean(state.tracingItem));
  const canClose = scan && !state.closed && !state.closing && (state.count ?? 0) >= 3;
  const canUndo = state.arranging ? Boolean(state.canUndoPlacement) : !scan || Boolean(state.count);
  const canRotate = state.arranging ? Boolean(state.itemId) : !scan && state.positioned;
  const canRemovePlacement = state.arranging && state.itemId && state.placedIds?.includes(state.itemId);
  const furnitureOptions = [...items, ...(state.detectedItems ?? []), ...(state.manualItems ?? [])];
  return {
    scan,
    heading,
    collectLabel,
    showCollect,
    canClose,
    canUndo,
    canRotate,
    canRemovePlacement,
    furnitureOptions,
    snap: state.snap !== false,
    changeKind,
    changeItem,
    arrange,
    findFurniture,
    finishFurnitureSearch,
    skipFurnitureSearch,
    removePlacement,
    startItemTrace,
    closeItemOutline,
    cancelItemTrace,
    exit,
    undo,
    save,
    closeOutline,
    collect,
    toggleSnap,
    rotate
  };
};
