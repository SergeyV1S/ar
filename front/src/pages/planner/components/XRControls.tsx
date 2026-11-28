import type { RefObject } from "react";

import { Button, Field, IconButton, Select } from "../../../shared/components/index.ts";
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
  if (props.area) rows.push({ label: "Площадь", value: `${props.area.toFixed(1)} м²` });
  if (props.perimeter) rows.push({ label: "Периметр", value: `${props.perimeter.toFixed(1)} м` });
  if (props.rotation) rows.push({ label: "Поворот", value: `${props.rotation}°` });
  return rows;
};

const meters = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const XRControls = (props: XRControlsProps) => {
  const { mode, state, overlayRef } = props;
  const {
    scan, collectLabel, showCollect, canClose, snap, changeKind, exit, undo, save, closeOutline,
    collect, toggleSnap, rotate
  } = useXRControls(props);
  const rows = metrics(state);
  return (
    <div
      className='fixed inset-0 bg-transparent pointer-events-none z-20 text-white'
      ref={overlayRef}
      hidden={!mode}
    >
      <div className='xr-head'>
        <div>
          <strong>{scan ? "Обмер комнаты" : "Расстановка в AR"}</strong>
          <p aria-live='polite'>{state.text ?? "Подключаем камеру…"}</p>
        </div>
        <IconButton className='xr-exit' icon='close' label='Выйти из AR' onClick={exit} />
      </div>
      {showCollect && (
        <div className='xr-reticle'>
          <i aria-hidden='true' className={state.ready ? "locked" : ""} />
          {state.wallLength !== undefined && (
            <span className='xr-wall-length'>{meters.format(state.wallLength)} м</span>
          )}
        </div>
      )}
      <div className='xr-hud'>
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
        {scan && state.closed && (
          <Field label='Проёмы и розетки'>
            <Select value={state.kind ?? "corner"} onChange={changeKind}>
              <option value='corner'>Только стены</option>
              <option value='door'>Края двери</option>
              <option value='window'>Края окна</option>
              <option value='socket'>Розетку</option>
            </Select>
          </Field>
        )}
        <div className='xr-actions'>
          {scan && !state.closed && (state.count ?? 0) >= 2 && (
            <Button className={snap ? "xr-toggle on" : "xr-toggle"} onClick={toggleSnap} aria-pressed={snap}>
              {snap ? "Привязка вкл." : "Привязка выкл."}
            </Button>
          )}
          <Button icon='rotate' onClick={undo} disabled={scan && !state.count}>
            {scan ? "Отменить" : "Сбросить"}
          </Button>
          {!scan && state.positioned && (
            <Button icon='rotate' onClick={rotate}>
              Повернуть
            </Button>
          )}
          {canClose && (
            <Button onClick={closeOutline}>
              Замкнуть контур
            </Button>
          )}
          {scan && state.closed && (
            <Button icon='check' className={showCollect ? undefined : "primary xr-primary"} onClick={save}>
              Сохранить комнату
            </Button>
          )}
          {showCollect && (
            <Button
              icon={scan ? "plus" : "cube"}
              className='primary xr-primary'
              disabled={!state.ready}
              onClick={collect}
            >
              {collectLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
