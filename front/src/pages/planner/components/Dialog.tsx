import type { ReactNode } from "react";

import { Icon, IconButton } from "../../../shared/components/index.ts";
import { useDialog } from "../hooks/index.ts";

export type DialogProps = {
  title: string;
  icon: string;
  wide?: boolean;
  children: ReactNode;
  close: () => void;
};

export const Dialog = (props: DialogProps) => {
  const { title, icon, wide, children, close } = props;
  const { dialog, cancel, closeFromBackdrop } = useDialog(props);
  return (
    <dialog
      ref={dialog}
      className={wide ? "wide-dialog" : ""}
      aria-labelledby='dialog-title'
      onCancel={cancel}
      onClick={closeFromBackdrop}
    >
      <div className='min-w-0'>
        <header className='dialog-head'>
          <div>
            <span className='heading-icon'>
              <Icon name={icon} />
            </span>
            <h2 id='dialog-title'>{title}</h2>
          </div>
          <IconButton icon='close' label='Закрыть' onClick={close} />
        </header>
        <div className='dialog-body'>{children}</div>
      </div>
    </dialog>
  );
};
