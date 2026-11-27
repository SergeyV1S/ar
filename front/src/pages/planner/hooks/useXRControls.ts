import type { ChangeEvent } from "react";

import type { XRControlsProps } from "../components/index.ts";
import { getARCollectLabel } from "../helpers/index.ts";

export const useXRControls = ({ mode, state, control }: XRControlsProps) => {
  const scan = mode === "scan";

  const changeKind = (event: ChangeEvent<HTMLSelectElement>) => control("kind", event.target.value);
  const exit = () => control("exit");
  const undo = () => control("undo");
  const save = () => control("save");
  const collect = () => control("collect");
  const collectLabel = getARCollectLabel(mode, state.positioned);
  return { scan, collectLabel, changeKind, exit, undo, save, collect };
};
