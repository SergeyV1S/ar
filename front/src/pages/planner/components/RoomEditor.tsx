import { Button, Field, IconButton, Select } from "../../../shared/components/index.ts";
import { checkLabel, sourceLabel } from "../data/index.ts";
import { useRoomEditor } from "../hooks/index.ts";
import type { RoomProps } from "../types/index.ts";
import type { Action } from "../types/index.ts";
import { Submit } from "./Submit.tsx";

const featureTypes: Record<string, string> = { door: "Дверь", window: "Окно", socket: "Розетка" };

export type RoomEditorProps = RoomProps & { action: Action };

export const RoomEditor = (props: RoomEditorProps) => {
  const { project, close } = props;
  const {
    openingRows,
    status,
    error,
    extent,
    submit,
    add,
    scanRoom,
    drawOutline,
    markForReview,
    changeStatus
  } = useRoomEditor(props);
  return (
    <form onSubmit={submit}>
      <div className='inline-actions'>
        <Button icon='scan' className='ar-soft' onClick={scanRoom}>
          AR-обмер
        </Button>
        <Button icon='camera' onClick={drawOutline}>
          Обвести по фото
        </Button>
      </div>
      <Field label='Название комнаты'>
        <input name='name' required maxLength={80} defaultValue={project.room.name} />
      </Field>
      <div className='form-grid three'>
        <Field label='Ширина, м'>
          <input
            type='number'
            inputMode='decimal'
            name='width'
            min='.7'
            max='35'
            step='.01'
            onChange={markForReview}
            defaultValue={extent.w.toFixed(2)}
            required
          />
        </Field>
        <Field label='Глубина, м'>
          <input
            type='number'
            inputMode='decimal'
            name='depth'
            min='.7'
            max='35'
            step='.01'
            onChange={markForReview}
            defaultValue={extent.d.toFixed(2)}
            required
          />
        </Field>
        <Field label='Мин. проход, см'>
          <input
            type='number'
            inputMode='numeric'
            name='passage'
            min='45'
            max='200'
            defaultValue={Math.round(project.passage * 100)}
            required
          />
        </Field>
      </div>
      <div className='row-title form-section-title'>
        <h3>Двери, окна и розетки</h3>
        <Button icon='plus' onClick={add}>
          Добавить
        </Button>
      </div>
      <p className='support-text'>
        Стены идут по порядку от первой точки контура. В прямоугольной комнате первая стена
        находится сверху на плане.
      </p>
      {openingRows.map(
        (
          { opening, remove, changeType, changeWall, changeOffset, changeWidth, changeHinge },
          index
        ) => (
          <fieldset className='opening' key={opening.id}>
            <legend>
              {featureTypes[opening.type]} {index + 1}
            </legend>
            <IconButton
              icon='trash'
              label={`Удалить проём ${index + 1}`}
              className='remove-opening'
              onClick={remove}
            />
            <div className='form-grid'>
              <Field label='Тип'>
                <Select value={opening.type} onChange={changeType}>
                  {Object.entries(featureTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label='Стена'>
                <Select value={opening.wall} onChange={changeWall}>
                  {project.room.points.map((_, i) => (
                    <option key={i} value={i}>
                      Стена {i + 1}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label='От начала стены, м'>
                <input
                  type='number'
                  min='0'
                  max='35'
                  step='.01'
                  value={opening.offset}
                  onChange={changeOffset}
                  required
                />
              </Field>
              {opening.type !== "socket" && (
                <Field label='Ширина проёма, м'>
                  <input
                    type='number'
                    min='.2'
                    max='10'
                    step='.01'
                    value={opening.width}
                    onChange={changeWidth}
                    required
                  />
                </Field>
              )}
              {opening.type === "door" && (
                <Field label='Петли относительно стены'>
                  <Select value={opening.hinge} onChange={changeHinge}>
                    <option value='start'>Со стороны начала проёма</option>
                    <option value='end'>Со стороны конца проёма</option>
                  </Select>
                </Field>
              )}
            </div>
          </fieldset>
        )
      )}
      <div className='form-grid mt-3'>
        <Field label='Статус размеров'>
          <Select value={status} onChange={changeStatus}>
            {Object.entries(checkLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className='field source-field'>
          <span>Источник</span>
          <strong>{sourceLabel[project.room.source]}</strong>
        </div>
      </div>
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      <Submit close={close} />
    </form>
  );
};
