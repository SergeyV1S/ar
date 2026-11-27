import { Button, Icon } from "../../../shared/components/index.ts";
import { money } from "../../../shared/helpers/index.ts";
import { itemSize } from "../data/index.ts";
import { useCatalog } from "../hooks/index.ts";
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
  const { fitOnly, offers, external, addManually, openProcurement, filterOffers } =
    useCatalog(props);
  if (project.mode !== "retail")
    return (
      <>
        <p className='notice'>
          {external
            ? "Откройте поиск объявлений, затем добавьте ссылку, цену и габариты выбранной мебели."
            : "Добавьте предложения поставщиков и заполните поля закупки. Для автоматического получения КП и проверки поставщиков требуется интеграция."}
        </p>
        <div className='inline-actions'>
          {external && (
            <a
              className='btn'
              href='https://www.avito.ru/rossiya/mebel_i_interer'
              target='_blank'
              rel='noreferrer'
            >
              <Icon name='external' />
              Поиск на Авито
            </a>
          )}
          <Button icon='plus' className='primary' onClick={addManually}>
            {external ? "Добавить объявление" : "Добавить предложение"}
          </Button>
          {!external && (
            <Button icon='receipt' onClick={openProcurement}>
              Поля закупки
            </Button>
          )}
        </div>
      </>
    );
  return (
    <>
      <div className='catalog-tools'>
        <p className='support-text'>
          Подбор по материалу, габаритам и остаткам бюджета. Цена и доставка зависят от региона и
          даты проверки.
        </p>
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
              <p>{item.availability}</p>
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
                <a
                  className='icon-btn'
                  aria-label={`Открыть ${item.name} у продавца`}
                  href={item.url}
                  target='_blank'
                  rel='noreferrer'
                >
                  <Icon name='external' />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!offers.length && (
        <p className='text-[12.5px] text-muted py-2.25 px-0 font-[650]'>
          Подходящих товаров в наборе нет. Отключите фильтр или внесите товар вручную.
        </p>
      )}
      <div className='form-actions'>
        <Button icon='plus' onClick={addManually}>
          Внести товар вручную
        </Button>
      </div>
    </>
  );
};
