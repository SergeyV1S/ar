import { Button, Field } from "../../../shared/components/index.ts";
import { useOutline } from "../hooks/index.ts";
import type { RoomProps } from "../types/index.ts";
import { ImagePicker } from "./ImagePicker.tsx";
import { Submit } from "./Submit.tsx";

export type OutlineProps = RoomProps;

export const Outline = (props: OutlineProps) => {
  const { project, close } = props;
  const { canvas, points, error, onClick, submit, w, d, changePhoto, undoPoint } =
    useOutline(props);
  return (
    <form onSubmit={submit}>
      <p className='support-text'>
        Отмечайте углы по периметру на плане или на фото плана. Укажите фактические размеры по двум
        осям. Снимок комнаты в перспективе измеряйте в AR.
      </p>
      <ImagePicker onPhoto={changePhoto} label='Загрузить план или фото' />
      <canvas
        ref={canvas}
        className='outline-canvas'
        onClick={onClick}
        aria-label='Поле ручной разметки углов комнаты'
      />
      <div className='row-title'>
        <span className='secondary'>Углов: {points.length}</span>
        <Button icon='rotate' disabled={!points.length} onClick={undoPoint}>
          Отменить точку
        </Button>
      </div>
      <div className='form-grid mt-3'>
        <Field label='Ширина по контуру, м'>
          <input
            type='number'
            name='width'
            min='.7'
            max='35'
            step='.01'
            required
            defaultValue={w.toFixed(2)}
          />
        </Field>
        <Field label='Глубина по контуру, м'>
          <input
            type='number'
            name='depth'
            min='.7'
            max='35'
            step='.01'
            required
            defaultValue={d.toFixed(2)}
          />
        </Field>
      </div>
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
      <Submit close={close} children='Сохранить контур' />
    </form>
  );
};
