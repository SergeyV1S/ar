import type { RefObject } from "react";

import { Button, Field, Icon, Select } from "../../../shared/components/index.ts";
import type { ARController } from "../ar/index.ts";
import { useXRControls } from "../hooks/index.ts";
import type { ARMode, XRState } from "../types/index.ts";

export type XRControlsProps = {
  mode: ARMode | null;
  state: XRState;
  overlayRef: RefObject<HTMLDivElement | null>;
  control: (method: keyof ARController, value?: string) => void;
};

export const XRControls = (props: XRControlsProps) => {
  const { mode, state, overlayRef } = props;
  const { scan, collectLabel, changeKind, exit, undo, save, collect } = useXRControls(props);
  return (
    <div
      className='fixed inset-0 bg-transparent pointer-events-none z-20 text-white'
      ref={overlayRef}
      hidden={!mode}
    >
      <div className='xr-hud'>
        <div className='xr-head'>
          <span className='brand-mark'>
            <Icon name={scan ? "scan" : "cube"} />
          </span>
          <div>
            <strong>{scan ? "AR-обмер" : "Расстановка в AR"}</strong>
            <p aria-live='polite'>{state.text || "Подключаем камеру…"}</p>
          </div>
        </div>
        {scan && (state.count ?? 0) >= 3 && (
          <Field label='Что отметить'>
            <Select value={state.kind ?? "corner"} onChange={changeKind}>
              <option value='corner'>Угол комнаты</option>
              <option value='door'>Края двери</option>
              <option value='window'>Края окна</option>
              <option value='socket'>Розетку</option>
            </Select>
          </Field>
        )}
        <div className='xr-actions'>
          <Button onClick={exit}>Выйти</Button>
          <Button icon='rotate' onClick={undo}>
            {scan ? "Отменить точку" : "Сбросить"}
          </Button>
          {scan && (state.count ?? 0) >= 3 && (
            <Button icon='check' onClick={save}>
              Сохранить контур
            </Button>
          )}
          <Button
            icon={scan ? "plus" : "cube"}
            className='primary'
            disabled={!state.ready}
            onClick={collect}
          >
            {collectLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
