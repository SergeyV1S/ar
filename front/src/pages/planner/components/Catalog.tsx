import { Button, Icon } from "@/shared/components/index.ts";
import { money } from "@/shared/helpers/index.ts";

import { useCatalog } from "../hooks/index.ts";
import { itemSize } from "../mock/index.ts";
import type { Action, Item, Positions, Project } from "../types/index.ts";
import { Thumbnail } from "./Thumbnail.tsx";

export type CatalogProps = {
  project: Project;
  items: Item[];
  positions: Positions;
  add: (item: Item) => void;
  action: Action;
};

export const Catalog = (props: CatalogProps) => {
  const { project } = props;
  const { fitOnly, offers, error, retry, loading, addManually, openProcurement, filterOffers } =
    useCatalog(props);
  return (
    <>
      <p className='notice'>
        {project.mode === "retail"
          ? "Демонстрационный каталог Hoff. Цены и наличие тестовые."
          : "Демонстрационные предложения. Для фактического подбора требуется подключение источника."}
      </p>
      {error && (
        <div role='alert'>
          Каталог недоступен. {error} <Button onClick={retry}>Повторить загрузку</Button>
        </div>
      )}
      {loading && <p role='status'>Загружаем предложения…</p>}
      <div className='catalog-tools'>
        <p className='support-text'>Подбор по материалу, габаритам и остатку бюджета.</p>
        <label className='check-field'>
          <input type='checkbox' checked={fitOnly} onChange={filterOffers} />
          Показывать подходящие и уже добавленные
        </label>
      </div>
      <div className='catalog-grid'>
        {offers.map(({ item, included, problems, selectOffer }) => (
          <article className='catalog-card' key={item.id}>
            <Thumbnail item={item} />
            <div className='catalog-card-body'>
              <h3>{item.name}</h3>
              <p>
                {item.seller} · {itemSize(item)} · {item.material}
              </p>
              <p>Демонстрационное предложение · {item.availability}</p>
              {item.details && <p>{item.details}</p>}
              {item.offerReason && <p>{item.offerReason}</p>}
              <strong>{money(item.price)}</strong>
              {problems.length > 0 && <p className='form-error'>{problems.join(" · ")}</p>}
              <div className='inline-actions'>
                <Button
                  icon={included ? "pencil" : "plus"}
                  className={included ? "" : "primary"}
                  onClick={selectOffer}
                >
                  {included ? "На плане" : "Добавить"}
                </Button>
                {item.url && (
                  <a
                    className='icon-btn'
                    aria-label={`Открыть ${item.name} у продавца`}
                    href={item.url}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <Icon name='external' />
                    {project.mode === "office" && "КП"}
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!loading && !error && !offers.length && (
        <p className='text-[12.5px] text-muted py-2.25 px-0 font-[650]'>
          Подходящих товаров в наборе нет. Отключите фильтр или внесите товар вручную.
        </p>
      )}
      <div className='form-actions'>
        {project.mode === "used" && (
          <a
            className='btn'
            href='https://www.avito.ru/rossiya/mebel_i_interer'
            target='_blank'
            rel='noreferrer'
          >
            Поиск на Авито
          </a>
        )}
        {project.mode === "office" && <Button onClick={openProcurement}>Поля закупки</Button>}
        <Button icon='plus' onClick={addManually}>
          Внести товар вручную
        </Button>
      </div>
    </>
  );
};
