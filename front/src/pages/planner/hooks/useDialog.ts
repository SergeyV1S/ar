import { useLayoutEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";

import type { DialogProps } from "../components/index.ts";

export const useDialog = ({ close }: DialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    return () => {
      if (node.open) node.close();
    };
  }, []);

  const cancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    close();
  };
  const closeFromBackdrop = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return { dialog, cancel, closeFromBackdrop };
};
