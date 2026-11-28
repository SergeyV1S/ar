import type { RefObject } from "react";

import { Button, Field, IconButton, Select } from "../../../shared/components/index.ts";
import type { ARController } from "../ar/index.ts";
import { useXRControls } from "../hooks/index.ts";
import type { ARMode, Item, XRState } from "../types/index.ts";
import { AngleInput } from "./AngleInput.tsx";

export type XRControlsProps = {
  mode: ARMode | null;
  state: XRState;
  items: Item[];
  overlayRef: RefObject<HTMLDivElement | null>;
  control: (method: keyof ARController, value?: string) => void;
};

const metrics = (props: XRState) => {
  const rows: { label: string; value: string }[] = [];
  if (props.area) rows.push({ label: "Площадь", value: `${props.area.toFixed(1)} м²` });
  if (props.perimeter) rows.push({ label: "Периметр", value: `${props.perimeter.toFixed(1)} м` });
  return rows;
};

const meters = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const XRControls = (props: XRControlsProps) => {
  const { mode, state, items, overlayRef } = props;
  const {
    scan,
    collectLabel,
    showCollect,
    canClose,
    canUndo,
    canRotate,
    canRemove,
    tracing,
    snap,
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
  } = useXRControls(props);
  const rows = metrics(state);
  const furniture = [...items, ...(state.measuredItems ?? [])];
  const showItems = state.arranging || (!scan && state.positioned);
  return (
    <div
      className='fixed inset-0 bg-transparent pointer-events-none z-20 text-white'
      ref={overlayRef}
      hidden={!mode}
    >
      <div className='xr-head'>
        <div>
          <strong>{scan && !state.arranging ? "Обмер комнаты" : "Расстановка в AR"}</strong>
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
        {state.measurement && <p className='mb-2 text-xs'>{state.measurement}</p>}
        {scan && state.closed && !state.arranging && !tracing && !state.finding && (
          <Field label='Проёмы и розетки'>
            <Select value={state.kind ?? "corner"} onChange={changeKind}>
              <option value='corner'>Только стены</option>
              <option value='door'>Края двери</option>
              <option value='window'>Края окна</option>
              <option value='socket'>Розетку</option>
            </Select>
          </Field>
        )}
        {showItems && (
          <Field label='Предмет мебели'>
            <Select value={state.itemId ?? ""} onChange={changeItem}>
              <option value=''>{scan ? "Выберите предмет" : "Весь план"}</option>
              {furniture
                .filter((item) => scan || state.placedIds?.includes(item.id))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {state.placedIds?.includes(item.id) ? " · размещён" : ""}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        {canRotate && <AngleInput value={state.rotation ?? 0} onChange={rotate} />}
        <div className='xr-actions'>
          {scan && !state.closed && (state.count ?? 0) >= 2 && (
            <Button
              className={snap ? "xr-toggle on" : "xr-toggle"}
              onClick={toggleSnap}
              aria-pressed={snap}
            >
              {snap ? "Привязка вкл." : "Привязка выкл."}
            </Button>
          )}
          <Button icon='rotate' onClick={undo} disabled={!canUndo}>
            {scan ? "Отменить" : "Сбросить"}
          </Button>
          {canRemove && <Button onClick={removeItem}>Убрать с плана</Button>}
          {canClose && <Button onClick={closeOutline}>Замкнуть контур</Button>}
          {scan && state.closed && (
            <>
              {!state.arranging && !tracing && (
                <Button onClick={findObjects}>
                  {state.finding ? "Завершить поиск" : "Распознать мебель"}
                </Button>
              )}
              {!state.arranging && !state.finding && (
                <Button onClick={trace}>
                  {tracing ? "Выйти из выделения" : "Выделить предмет вручную"}
                </Button>
              )}
              {furniture.length > 0 && !tracing && !state.finding && (
                <Button onClick={arrange}>
                  {state.arranging ? "К обмеру" : "Расставить мебель"}
                </Button>
              )}
              <Button
                icon='check'
                className={showCollect ? undefined : "primary xr-primary"}
                onClick={save}
                disabled={tracing}
              >
                {state.placedIds?.length ? "Сохранить план" : "Сохранить комнату"}
              </Button>
            </>
          )}
          {!scan && state.viewEdited && (
            <Button icon='check' onClick={save}>
              Сохранить повороты
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
