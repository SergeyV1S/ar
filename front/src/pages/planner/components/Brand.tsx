import React from "react";

import { Icon } from "../../../shared/components/index.ts";

export const Brand = ({ onClick }: { onClick: React.MouseEventHandler<HTMLButtonElement> }) => {
  return (
    <button type='button' className='brand' onClick={onClick} aria-label='Метрика, планировка'>
      <span className='brand-mark'>
        <Icon name='brand' size={23} />
      </span>
      <span>
        метрика<span className='text-purple'>.</span>
      </span>
    </button>
  );
};
