import { Button, Field, Select } from "../../../shared/components/index.ts";
import { useOutline } from "../hooks/index.ts";
import type { Item, Positions, Room, RoomProps } from "../types/index.ts";
import { AngleInput } from "./AngleInput.tsx";
import { ImagePicker } from "./ImagePicker.tsx";
import { Submit } from "./Submit.tsx";

export type OutlineProps = Omit<RoomProps, "save"> & {
  save: (room: Room, positions: Positions, items: Item[]) => void;
};

export const Outline = (props: OutlineProps) => {
  const { project, close } = props;
  const {
    canvas,
    outline,
    error,
    start,
    track,
    stop,
    submit,
    width,
    depth,
    changeWidth,
    changeDepth,
    changePhoto,
    undoPoint,
    clear,
    room,
    continueToFurniture,
    back,
    drawFurniture,
    rotate,
    renaming,
    active,
    rename,
    setHeight,
    remove,
    tool,
    existing,
    existingId,
    pickExisting
  } = useOutline(props);
  return (
    <form onSubmit={submit}>
      <p className='support-text'>
        {room
          ? "Выберите мебель из проекта или протяните рамку нового предмета. Предметы можно перетаскивать."
          : "Обведите комнату одним движением или отметьте углы. Затем укажите ширину и длину комнаты."}
      </p>
      {!room && <ImagePicker onPhoto={changePhoto} label='Загрузить план или фото' />}
      <canvas
        ref={canvas}
        className='outline-canvas'
        onPointerDown={start}
        onPointerMove={track}
        onPointerUp={stop}
        onPointerCancel={stop}
        aria-label={
          room ? "План комнаты для расстановки мебели" : "Холст для рисования контура комнаты"
        }
      />
      {room ? (
        <>
          <div className='inline-actions'>
            <Button icon='pencil' aria-pressed={tool === "draw"} onClick={drawFurniture}>
              Нарисовать мебель
            </Button>
            <Button onClick={back}>Вернуться к контуру</Button>
          </div>
          {existing.length > 0 && (
            <Field label='Поставить предмет из проекта'>
              <Select value={existingId} onChange={pickExisting}>
                <option value=''>Выберите предмет</option>
                {existing.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {active && (
            <>
              <div className='row-title'>
                <strong>
                  {active.item.name || "Предмет"} · {Math.round(active.item.w * 100)} ×{" "}
                  {Math.round(active.item.d * 100)} см
                </strong>
                <Button onClick={remove}>Убрать с плана</Button>
              </div>
              <AngleInput value={active.position.r} onChange={rotate} />
              {renaming && (
                <div className='form-grid'>
                  <Field label='Название'>
                    <input value={active.item.name} maxLength={100} onChange={rename} />
                  </Field>
                  <Field label='Высота, м'>
                    <input
                      type='number'
                      min='.05'
                      max='20'
                      step='.01'
                      value={Number.isFinite(active.item.h) ? active.item.h : ""}
                      onChange={setHeight}
                    />
                  </Field>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className='row-title'>
            <span className='secondary'>Углов: {outline.length}</span>
            <div className='inline-actions'>
              <Button icon='rotate' disabled={!outline.length} onClick={undoPoint}>
                Отменить штрих
              </Button>
              <Button disabled={!outline.length} onClick={clear}>
                Очистить
              </Button>
            </div>
          </div>
          <div className='form-grid mt-3'>
            <Field label='Ширина по контуру, м'>
              <input
                type='number'
                min='.7'
                max='35'
                step='.01'
                required
                value={width}
                onChange={changeWidth}
              />
            </Field>
            <Field label='Длина по контуру, м'>
              <input
                type='number'
                min='.7'
                max='35'
                step='.01'
                required
                value={depth}
                onChange={changeDepth}
              />
            </Field>
          </div>
          <Button icon='plus' onClick={continueToFurniture} disabled={outline.length < 3}>
            Перейти к мебели
          </Button>
        </>
      )}
      {project.room.openings.length > 0 && (
        <p className='support-text'>
          Укажите проёмы и розетки заново после сохранения нового контура.
        </p>
      )}
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      <Submit close={close}>{room ? "Сохранить комнату и мебель" : "Сохранить контур"}</Submit>
    </form>
  );
};
