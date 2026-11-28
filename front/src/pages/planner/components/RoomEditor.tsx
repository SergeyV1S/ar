import { Button, Field, Icon, IconButton, Select } from "../../../shared/components/index.ts";
import { ROOM_FORM_ID } from "../helpers/index.ts";
import { useRoomEditor } from "../hooks/index.ts";
import { checkLabel, sourceLabel } from "../mock/index.ts";
import type { RoomProps } from "../types/index.ts";
import type { Action } from "../types/index.ts";
import { Submit } from "./Submit.tsx";

const featureTypes: Record<string, string> = { door: "Дверь", window: "Окно", socket: "Розетка" };

export type RoomEditorProps = RoomProps & {
  action: Action;
  guided?: { onSaved: (target: string | undefined) => void };
};

export const RoomEditor = (props: RoomEditorProps) => {
  const { project, close, guided } = props;
  const {
    openingRows,
    status,
    error,
    extent,
    submit,
    add,
    scanRoom,
    drawOutline,
    dictate,
    markForReview,
    changeStatus,
    changeVerified,
    revealOpeningFields
  } = useRoomEditor(props);
  const measureButtons = (
    <div className='inline-actions'>
      <Button icon='scan' className={guided ? undefined : "ar-soft"} onClick={scanRoom}>
        AR-обмер
      </Button>
      {guided && (
        <Button icon='mic' onClick={dictate}>
          Голосовой ввод
        </Button>
      )}
      <Button icon='pencil' onClick={drawOutline}>
        Нарисовать комнату
      </Button>
    </div>
  );
  const openingFields = (
    <>
      <div className='row-title form-section-title'>
        {!guided && <h3>Двери, окна и розетки</h3>}
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
          <details
            className='opening-entry'
            key={opening.id}
            open={project.room.openings.every((saved) => saved.id !== opening.id) || undefined}
            onInvalid={revealOpeningFields}
          >
            <summary><Icon name={opening.type} /><strong>{featureTypes[opening.type]} {index + 1}</strong>
              <small>Стена {opening.wall + 1}</small><Icon name='down' size={16} /></summary>
            <fieldset className='opening'>
            <legend className='sr-only'>
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
                    step='.001'
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
          </details>
        )
      )}
    </>
  );
  return (
    <form
      id={guided ? ROOM_FORM_ID : undefined}
      className={guided ? "guided-room-editor" : undefined}
      autoComplete='off'
      onSubmit={submit}
    >
      {guided ? <div className='guided-measure-options'>{measureButtons} </div> : measureButtons}
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
            defaultValue={project.room.source === "draft" ? undefined : extent.w.toFixed(2)}
            required
          />
        </Field>
        <Field label='Длина, м'>
          <input
            type='number'
            inputMode='decimal'
            name='depth'
            min='.7'
            max='35'
            step='.01'
            onChange={markForReview}
            defaultValue={project.room.source === "draft" ? undefined : extent.d.toFixed(2)}
            required
          />
        </Field>
        <Field label={guided ? "Минимальный проход, см" : "Мин. проход, см"}>
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
      {guided ? (
        <>
          <label className='check-field'>
            <input type='checkbox' checked={status === "checked"} onChange={changeVerified} />
            Размеры сверены с замерами
          </label>
          <details
            className='guided-openings'
            open={error ? true : undefined}
            onInvalid={revealOpeningFields}
          >
            <summary>
              Двери, окна и розетки <span>{openingRows.length}</span>
            </summary>
            {openingFields}
          </details>
        </>
      ) : (
        openingFields
      )}
      {!guided && (
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
      )}
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      {guided ? (
        <Button type='submit' className='primary guided-room-submit'>
          Сохранить и продолжить <Icon name='chevron' />
        </Button>
      ) : (
        <Submit close={close} />
      )}
    </form>
  );
};
