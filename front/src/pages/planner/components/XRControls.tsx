import type { RefObject } from "react";

import { Button, Field, Icon, IconButton, Select } from "../../../shared/components/index.ts";
import type { ARController } from "../ar/index.ts";
import { useXRControls } from "../hooks/index.ts";
import type { ARMode, XRState } from "../types/index.ts";

export type XRControlsProps = {
  mode: ARMode | null;
  state: XRState;
  overlayRef: RefObject<HTMLDivElement | null>;
  control: (method: keyof ARController, value?: string) => void;
};

const metrics = (props: XRState) => {
  const rows: { label: string; value: string }[] = [];
  if (props.count) rows.push({ label: "Углов", value: String(props.count) });
  if (props.area) rows.push({ label: "Площадь", value: `${props.area.toFixed(1)} м²` });
  if (props.perimeter) rows.push({ label: "Периметр", value: `${props.perimeter.toFixed(1)} м` });
  if (props.rotation) rows.push({ label: "Поворот", value: `${props.rotation}°` });
  return rows;
};

export const XRControls = (props: XRControlsProps) => {
  const { mode, state, overlayRef } = props;
  const { scan, collectLabel, confidence, hint, snap, changeKind, exit, undo, save, collect, toggleSnap, rotate } =
    useXRControls(props);
  const rows = metrics(state);
  return (
    <div
      className='fixed inset-0 bg-transparent pointer-events-none z-20 text-white'
      ref={overlayRef}
      hidden={!mode}
    >
      <div className='xr-meter'>
        <span
          className='xr-meter-bar'
          style={{ width: `${Math.max(6, Math.min(100, confidence))}%` }}
        />
        <span className='xr-meter-label'>
          <Icon name={scan ? "scan" : "cube"} size={13} />
          {hint || "Поиск поверхности"}
        </span>
      </div>
      <div className='xr-reticle' aria-hidden='true'>
        <i className={state.ready ? "locked" : ""} />
      </div>
      <div className='xr-hud'>
        <div className='xr-head'>
          <span className='brand-mark'>
            <Icon name={scan ? "scan" : "cube"} />
          </span>
          <div>
            <strong>{scan ? "AR-обмер" : "Расстановка в AR"}</strong>
            <p aria-live='polite'>{state.text || "Подключаем камеру…"}</p>
          </div>
          <IconButton className='xr-exit' icon='close' label='Выйти из AR' onClick={exit} />
        </div>
        {rows.length > 0 && (
          <dl className='xr-metrics'>
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {scan && (
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
          <Button className={snap ? "xr-toggle on" : "xr-toggle"} onClick={toggleSnap}>
            {snap ? "Оси вкл." : "Оси выкл."}
          </Button>
          <Button icon='rotate' onClick={undo}>
            {scan ? "Отменить" : "Сбросить"}
          </Button>
          {!scan && state.positioned && (
            <Button icon='rotate' onClick={rotate}>
              Повернуть
            </Button>
          )}
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
