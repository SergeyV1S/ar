import { Button, Field, Select } from "../../../shared/components/index.ts";
import { useItemEditor } from "../hooks/index.ts";
import { checkLabel, materials, sourceLabel, types } from "../mock/index.ts";
import type { Item, Project } from "../types/index.ts";
import { ImagePicker } from "./ImagePicker.tsx";
import { Submit } from "./Submit.tsx";
import { Thumbnail } from "./Thumbnail.tsx";

export type ItemEditorProps = {
  item?: Item | null;
  owned: boolean;
  project: Project;
  save: (item: Item) => void;
  remove: (id: string) => void;
  close: () => void;
};

export const ItemEditor = (props: ItemEditorProps) => {
  const { item, owned, project, close } = props;
  const {
    photo,
    name,
    kind,
    source,
    verified,
    error,
    removing,
    detection,
    setImage,
    scanImage,
    submit,
    markEdited,
    matchOptions,
    clearImage,
    changeName,
    changeKind,
    changeSource,
    changeVerification,
    confirmRemove
  } = useItemEditor(props);
  return (
    <form onSubmit={submit}>
      {item?.illustration && !photo && (
        <div className='item-preview'>
          <Thumbnail item={item} />
          <p className='support-text'>
            Иллюстрация типа мебели. Фото конкретной модели доступно на сайте продавца.
          </p>
        </div>
      )}
      {photo && (
        <div className='item-preview'>
          <Thumbnail item={{ photo }} />
          <Button icon='trash' onClick={clearImage}>
            Убрать фото
          </Button>
        </div>
      )}
      {kind !== "service" && (
        <ImagePicker label={photo ? "Заменить фото" : "Прикрепить фото"} onPhoto={setImage} />
      )}
      {owned && photo && (
        <section className='mb-2.75'>
          <Button
            icon='spark'
            className='ar-soft'
            disabled={detection.status === "loading"}
            onClick={scanImage}
          >
            {detection.status === "loading" ? "Анализируем фото…" : "Распознать мебель"}
          </Button>
          {detection.status === "error" && (
            <p className='form-error' role='alert'>
              Не удалось загрузить модель. Проверьте сеть или заполните тип мебели вручную.
            </p>
          )}
          {detection.status === "ready" &&
            (detection.matches.length ? (
              <>
                <p className='support-text'>
                  Выберите предмет и проверьте предложенный тип. Фактические размеры понадобятся для
                  расстановки.
                </p>
                <figure className='detection-image'>
                  <img src={photo} alt='Загруженная мебель и отмеченные области' />
                  {matchOptions.map(({ key, box }, i) => (
                    <span
                      key={key}
                      style={{
                        left: `${box[0]}%`,
                        top: `${box[1]}%`,
                        width: `${box[2]}%`,
                        height: `${box[3]}%`
                      }}
                    >
                      <b>{i + 1}</b>
                    </span>
                  ))}
                </figure>
                <div className='inline-actions'>
                  {matchOptions.map(({ key, title, score, chooseMatch }, i) => (
                    <Button key={key} onClick={chooseMatch}>
                      {i + 1}. {title} · {Math.round(score * 100)}%
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className='support-text'>
                Подходящая мебель на фото не обнаружена. Выберите тип вручную.
              </p>
            ))}
        </section>
      )}
      <Field label='Название'>
        <input name='name' value={name} onChange={changeName} maxLength={100} required />
      </Field>
      <div className='form-grid'>
        <Field label='Тип позиции'>
          <Select name='kind' value={kind} onChange={changeKind}>
            {!owned && <option value='service'>Услуга</option>}
            {Object.entries(types).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {kind !== "service" && (
          <Field label='Материал'>
            <Select name='material' defaultValue={item?.material ?? "Другое"} onChange={markEdited}>
              {materials.slice(1).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {kind !== "service" && (
        <>
          <div className='form-grid three'>
            {[
              ["w", "Ширина, см"] as const,
              ["d", "Глубина, см"] as const,
              ["h", "Высота, см"] as const
            ].map(([key, label]) => (
              <Field label={label} key={key}>
                <input
                  name={key}
                  type='number'
                  inputMode='decimal'
                  min='5'
                  max='2000'
                  step='.1'
                  defaultValue={item ? Math.round(item[key] * 1000) / 10 : ""}
                  onChange={markEdited}
                  required
                />
              </Field>
            ))}
          </div>
          <Field
            label='Запас перед фасадом, см'
            hint='Место для выдвижения ящиков и открывания дверец. Оставьте 0, если запас не нужен.'
          >
            <input
              name='access'
              type='number'
              min='0'
              max='400'
              defaultValue={Math.round((item?.access ?? 0) * 100)}
              onChange={markEdited}
            />
          </Field>
        </>
      )}
      {!owned && (
        <>
          <div className='form-grid'>
            <Field label='Количество в смете'>
              <input
                name='quantity'
                type='number'
                min='1'
                max={Number.MAX_SAFE_INTEGER}
                step='1'
                defaultValue={item?.quantity ?? 1}
                required
              />
            </Field>
            <Field label='Цена за единицу, ₽'>
              <input
                name='price'
                type='number'
                min='0'
                max='1000000000'
                defaultValue={item?.price}
                required
                onChange={markEdited}
              />
            </Field>
            <Field label='Лимит позиции, ₽'>
              <input
                name='cap'
                type='number'
                min='0'
                max='1000000000'
                defaultValue={item?.cap || ""}
                placeholder='Без лимита'
              />
            </Field>
          </div>
          <div className='form-grid'>
            <Field label={project.mode === "office" ? "Поставщик" : "Магазин или продавец"}>
              <input name='seller' defaultValue={item?.seller} maxLength={120} />
            </Field>
            <Field label='Артикул'>
              <input name='sku' defaultValue={item?.sku} maxLength={120} />
            </Field>
          </div>
          <Field label='Ссылка на товар, объявление или КП'>
            <input name='url' type='url' defaultValue={item?.url} />
          </Field>
          <Field label='Наличие'>
            <input
              name='availability'
              defaultValue={item?.availability}
              placeholder='Уточнить у продавца'
              maxLength={200}
            />
          </Field>
          {project.mode === "office" && (
            <Field
              label='Реквизиты поставщика'
              hint='Наименование юрлица, ИНН и другие данные для вашей сметы.'
            >
              <textarea name='details' defaultValue={item?.details} maxLength={500} />
            </Field>
          )}
        </>
      )}
      <div className='form-grid'>
        <Field label='Источник'>
          <Select value={source} onChange={changeSource}>
            {Object.entries(sourceLabel)
              .filter(([key]) => ["manual", "photo", "catalog", "voice", "import"].includes(key))
              .map(([key, value]) => (
                <option value={key} key={key}>
                  {value}
                </option>
              ))}
          </Select>
        </Field>
        <Field label='Статус проверки'>
          <Select value={verified} onChange={changeVerification}>
            {Object.entries(checkLabel).map(([key, value]) => (
              <option value={key} key={key}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      <Submit
        close={close}
        extra={
          item && (
            <Button icon='trash' className='danger mr-auto' onClick={confirmRemove}>
              {removing ? "Подтвердить удаление" : "Удалить"}
            </Button>
          )
        }
      />
    </form>
  );
};
