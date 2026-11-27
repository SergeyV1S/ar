import type { ReactNode } from "react";

import { Button, Icon } from "../../../shared/components/index.ts";

export const Submit = ({
  children = "Сохранить",
  disabled,
  close,
  extra = null
}: {
  children?: ReactNode;
  disabled?: boolean;
  close: () => void;
  extra?: ReactNode;
}) => {
  return (
    <div className='form-actions'>
      {extra}
      <Button onClick={close}>Отмена</Button>
      <button type='submit' className='btn primary' disabled={disabled}>
        <Icon name='check' />
        {children}
      </button>
    </div>
  );
};
