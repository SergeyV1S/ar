import { Button, Icon } from "@/shared/components";

import { useCatalogPanel } from "../hooks/useCatalogPanel.ts";
import { Thumbnail } from "./Thumbnail.tsx";

export const RetailCatalog = ({ showHeading = true }: { showHeading?: boolean }) => {
  const {
    results,
    offerCards,
    legacyItems,
    conditions,
    quantity,
    hasIncompleteResult,
    openCatalogSearch,
    retry
  } = useCatalogPanel();
  return (
    <div className='grid gap-4'>
      <div className='row-title'>
        {showHeading && <h2>Подбор на Divan.ru</h2>}
        <Button icon='spark' onClick={openCatalogSearch}>
          {conditions ? "Изменить условия" : "Подобрать мебель"}
        </Button>
      </div>
      {conditions && <p className='support-text'>{conditions}</p>}
      {results.status === "loading" && (
        <div role='status' className='grid gap-2'>
          <p>Подбираем мебель и проверяем места на плане…</p>
          {offerCards.length === 0 && (
            <div className='h-24 rounded-xl bg-purple-soft' aria-hidden='true' />
          )}
        </div>
      )}
      {results.status === "error" && (
        <div className='notice' role='alert'>
          <p>
            {results.disabled
              ? "Каталог Divan.ru пока не подключён."
              : "Не удалось загрузить выдачу Divan.ru."}
          </p>
          <Button onClick={retry}>Повторить подбор</Button>
        </div>
      )}
      {hasIncompleteResult && (
        <div className='notice' role='status'>
          <p>Часть предложений не удалось проверить. Можно повторить подбор.</p>
          <Button onClick={retry}>Повторить подбор</Button>
        </div>
      )}
      {results.status === "done" && !results.incomplete && !offerCards.length && (
        <div className='notice' role='status'>
          <p>Подходящих вариантов нет. Измените условия подбора.</p>
          {results.problems.length > 0 && (
            <ul>
              {results.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {offerCards.length > 0 && (
        <div className='catalog-grid'>
          {offerCards.map(
            ({ offer, unitPrice, placedPrice, dates, size, availability, addOffer }) => (
              <article className='catalog-card' key={offer.sku}>
                <Thumbnail item={{ photo: offer.photo }} />
                <div className='catalog-card-body'>
                  <h3>{offer.name}</h3>
                  <p>
                    {size} см · {availability}
                  </p>
                  {offer.materials.length > 0 && <p>{offer.materials.join(", ")}</p>}
                  <strong>{placedPrice}</strong>
                  {quantity > 1 && (
                    <p>
                      {quantity} шт. по {unitPrice}
                    </p>
                  )}
                  <p className='support-text'>Проверено {dates}</p>
                  <div className='inline-actions'>
                    <Button icon='plus' className='primary' onClick={addOffer}>
                      Добавить на план
                    </Button>
                    <a className='btn' href={offer.url} target='_blank' rel='noreferrer'>
                      <Icon name='external' /> У продавца
                    </a>
                  </div>
                </div>
              </article>
            )
          )}
        </div>
      )}
      {legacyItems.map(({ item, replace }) => (
        <div key={item.id} className='notice'>
          <p>{item.name} · демопозиция Hoff</p>
          <Button onClick={replace}>Подобрать замену</Button>
        </div>
      ))}
    </div>
  );
};
