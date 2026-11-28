import type { RefObject } from "react";

import { Button, Field, IconButton, Select } from "../../../shared/components/index.ts";
import type { ARController } from "../ar/index.ts";
import { useXRControls } from "../hooks/index.ts";
import type { ARMode, Item, XRState } from "../types/index.ts";

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
  if (props.rotation) rows.push({ label: "Поворот", value: `${props.rotation}°` });
  return rows;
};

const meters = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const XRControls = (props: XRControlsProps) => {
  const { mode, state, overlayRef } = props;
  const {
    scan,
    heading,
    collectLabel,
    showCollect,
    canClose,
    canUndo,
    canRotate,
    canRemovePlacement,
    furnitureOptions,
    snap,
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
  } = useXRControls(props);
  const rows = metrics(state);
  const dimension = state.tracingItem?.height ?? state.wallLength;
  return (
    <div
      className='fixed inset-0 bg-transparent pointer-events-none z-20 text-white'
      ref={overlayRef}
      hidden={!mode}
    >
      <div className='xr-head'>
        <div>
          <strong>{heading}</strong>
          <p aria-live='polite'>{state.text ?? "Подключаем камеру…"}</p>
        </div>
        <IconButton className='xr-exit' icon='close' label='Выйти из AR' onClick={exit} />
      </div>
      {showCollect && (
        <div className='xr-reticle'>
          <i aria-hidden='true' className={state.ready ? "locked" : ""} />
          {dimension !== undefined && (
            <span className='xr-wall-length'>{meters.format(dimension)} м</span>
          )}
        </div>
      )}
      <div className='xr-hud'>
        {state.searchingFurniture && (
          <div className='xr-actions'>
            {state.hasDepthPoints && (
              <p className='w-full text-xs text-white/80'>
                Бирюзовые точки отмечают выделенные объекты.
              </p>
            )}
            <Button onClick={skipFurnitureSearch}>Пропустить</Button>
            <Button
              icon='check'
              className='primary xr-primary'
              disabled={!state.analyzingFurniture}
              onClick={finishFurnitureSearch}
            >
              {state.foundFurnitureCount
                ? `Проверить найденное (${state.foundFurnitureCount})`
                : "Завершить поиск"}
            </Button>
          </div>
        )}
        {state.tracingItem && (
          <div className='xr-actions'>
            <Button onClick={cancelItemTrace}>Отменить обводку</Button>
            <Button onClick={undo} disabled={!state.tracingItem.count}>
              {state.tracingItem.heightStep ? "К основанию" : "Убрать точку"}
            </Button>
            {!state.tracingItem.heightStep && (
              <Button onClick={closeItemOutline} disabled={state.tracingItem.count < 3}>
                Задать высоту
              </Button>
            )}
            <Button
              icon='plus'
              className='primary xr-primary'
              disabled={!state.ready}
              onClick={collect}
            >
              {collectLabel}
            </Button>
          </div>
        )}
        {!state.searchingFurniture && !state.tracingItem && (
          <>
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
            {scan && state.closed && !state.arranging && state.depthAvailable === false && (
              <p className='mb-2 text-xs text-white/80'>
                Данные глубины пока недоступны. Предмет можно обвести вручную в расстановке.
              </p>
            )}
            {scan && state.closed && !state.arranging && (
              <Field label='Проёмы и розетки'>
                <Select value={state.kind ?? "corner"} onChange={changeKind}>
                  <option value='corner'>Только стены</option>
                  <option value='door'>Края двери</option>
                  <option value='window'>Края окна</option>
                  <option value='socket'>Розетку</option>
                </Select>
              </Field>
            )}
            {state.arranging && (
              <Field label='Предмет мебели'>
                <Select value={state.itemId ?? ""} onChange={changeItem}>
                  <option value=''>Выберите предмет</option>
                  {furnitureOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {state.detectedItems?.some(({ id }) => id === item.id) ? " · найден" : ""}
                      {state.placedIds?.includes(item.id) ? " · на плане" : " · без позиции"}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
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
              {canRotate && (
                <Button icon='rotate' onClick={rotate}>
                  Повернуть
                </Button>
              )}
              {canRemovePlacement && <Button onClick={removePlacement}>Убрать с плана</Button>}
              {state.canTraceItem && (
                <Button onClick={startItemTrace}>
                  {state.itemId ? "Обвести предмет" : "Обвести новый объект"}
                </Button>
              )}
              {canClose && <Button onClick={closeOutline}>Замкнуть контур</Button>}
              {scan && state.closed && (
                <>
                  {state.canFindFurniture && !state.arranging && (
                    <Button icon='scan' onClick={findFurniture}>
                      Сканировать объекты
                    </Button>
                  )}
                  {furnitureOptions.length > 0 && (
                    <Button onClick={arrange}>
                      {state.arranging ? "К обмеру" : "Расставить мебель"}
                    </Button>
                  )}
                  <Button
                    icon='check'
                    className={showCollect ? undefined : "primary xr-primary"}
                    onClick={save}
                  >
                    {state.placedIds?.length ? "Сохранить план" : "Сохранить комнату"}
                  </Button>
                </>
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
          </>
        )}
      </div>
    </div>
  );
};
