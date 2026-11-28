import { ImagePicker } from "@/pages/planner/components";
import { Button, Icon } from "@/shared/components";

import { useRoomVisualization } from "../hooks";

export const RoomVisualization = () => {
  const { photo, changePhoto, removePhoto, canGenerate, generate, busy, error, preview } =
    useRoomVisualization();

  return (
    <section className='mt-5 min-w-0 pt-4' aria-labelledby='room-visualization'>
      <h3 id='room-visualization'>Визуализация комнаты</h3>
      <p className='support-text my-2'>
        Примерный вид текущей расстановки. GigaChat получает фото и данные плана при запуске.
      </p>
      {photo && (
        <figure className='my-2 grid gap-1'>
          <img
            className='aspect-video w-full rounded-lg object-cover'
            src={photo}
            alt='Исходное фото комнаты'
          />
          <figcaption className='support-text'>Исходное фото</figcaption>
        </figure>
      )}
      <ImagePicker onPhoto={changePhoto} label={photo ? "Заменить фото" : "Добавить фото комнаты"} />
      {photo && (
        <Button className='mb-3 min-h-11' icon='trash' onClick={removePhoto}>
          Удалить фото
        </Button>
      )}
      <div className='option-list'>
        <button type='button' disabled={!canGenerate || busy} onClick={generate}>
          <Icon name='spark' />
          <span>
            <strong>{busy ? "Готовим визуализацию…" : "Показать будущий интерьер"}</strong>
            <small>По выбранному варианту плана</small>
          </span>
        </button>
      </div>
      {!canGenerate && <p className='support-text mt-2'>Добавьте фото комнаты или разместите мебель.</p>}
      <div role='status' className='support-text' aria-live='polite'>
        {busy && <p className='mt-2'>Генерация может занять до двух минут.</p>}
        {preview && !busy && <p className='sr-only'>Визуализация готова.</p>}
      </div>
      {error && <p className='form-error mt-2' role='alert'>{error}</p>}
      {preview && (
        <figure className='mt-3 grid gap-2'>
          <a href={preview.url} target='_blank' rel='noreferrer' aria-label='Открыть визуализацию в полном размере'>
            <img className='block w-full rounded-lg' src={preview.url} alt='Примерный вид комнаты с мебелью' />
          </a>
          <a className='btn min-h-11' href={preview.url} download={`metrika-visualization.${preview.extension}`}>
            <Icon name='download' />
            Скачать изображение
          </a>
        </figure>
      )}
    </section>
  );
};
