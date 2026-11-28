import type { CatalogCity } from "@/shared/api/requests";
import { Button, Field } from "@/shared/components";

import { PROJECT_ITEM_LIMIT } from "../helpers/catalogSelection.ts";
import { useCatalogSearchForm } from "../hooks/useCatalogSearchForm.ts";
import { materials } from "../mock/index.ts";
import { CATALOG_CATEGORIES } from "../types/index.ts";
import type { CatalogSearch } from "../types/index.ts";

type Props = {
  initial: Partial<CatalogSearch>;
  projectMaterial: string;
  start: (search: CatalogSearch, city: CatalogCity) => void;
};

export const CatalogSearchForm = ({ initial, projectMaterial, start }: Props) => {
  const { city, cityState, error, changeCity, retryCities, submit } = useCatalogSearchForm({
    initial,
    start
  });
  return (
    <form onSubmit={submit}>
      {cityState.status === "loading" && <p role='status'>Загружаем города Divan.ru…</p>}
      {cityState.status === "error" && (
        <div className='notice' role='alert'>
          <p>Не удалось загрузить города Divan.ru.</p>
          <Button onClick={retryCities}>Повторить загрузку</Button>
        </div>
      )}
      {cityState.status === "disabled" && (
        <p className='notice' role='status'>
          Каталог Divan.ru пока не подключён.
        </p>
      )}
      <div className='grid gap-3'>
        <Field label='Город'>
          <select
            required
            value={city}
            onChange={changeCity}
            disabled={cityState.status !== "ready"}
          >
            <option value=''>Выберите город</option>
            {cityState.cities.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Мебель'>
            <select name='category' defaultValue={initial.category ?? "chair"}>
              {Object.entries(CATALOG_CATEGORIES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label='Количество'>
            <input
              name='quantity'
              type='number'
              inputMode='numeric'
              min={1}
              max={PROJECT_ITEM_LIMIT}
              defaultValue={initial.quantity ?? 1}
              required
            />
          </Field>
          <Field label='Лимит за всё, ₽'>
            <input
              name='maxTotal'
              type='number'
              inputMode='numeric'
              min={0}
              max={1e9}
              defaultValue={initial.maxTotal}
            />
          </Field>
          <Field label='Лимит за штуку, ₽'>
            <input
              name='maxUnit'
              type='number'
              inputMode='numeric'
              min={0}
              max={1e9}
              defaultValue={initial.maxUnit}
            />
          </Field>
        </div>
        <Field label='Материал'>
          <select name='material' defaultValue={initial.material ?? ""}>
            <option value=''>Как в проекте · {projectMaterial}</option>
            {materials.map((material) => (
              <option key={material} value={material}>
                {material}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className='grid grid-cols-3 gap-2'>
          <legend className='mb-2'>Максимальные габариты, см</legend>
          <Field label='Ширина'>
            <input
              name='maxWidth'
              type='number'
              inputMode='decimal'
              min={5}
              max={2000}
              step='any'
              defaultValue={initial.maxWidth === undefined ? undefined : initial.maxWidth * 100}
            />
          </Field>
          <Field label='Длина'>
            <input
              name='maxDepth'
              type='number'
              inputMode='decimal'
              min={5}
              max={2000}
              step='any'
              defaultValue={initial.maxDepth === undefined ? undefined : initial.maxDepth * 100}
            />
          </Field>
          <Field label='Высота'>
            <input
              name='maxHeight'
              type='number'
              inputMode='decimal'
              min={5}
              max={2000}
              step='any'
              defaultValue={initial.maxHeight === undefined ? undefined : initial.maxHeight * 100}
            />
          </Field>
        </fieldset>
      </div>
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      <div className='form-actions'>
        <Button type='submit' icon='spark' className='primary' disabled={!city}>
          {initial.replaceId ? "Подобрать замену" : "Начать подбор"}
        </Button>
      </div>
    </form>
  );
};
