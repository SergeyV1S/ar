import { use } from "react";
import { Link } from "react-router";

import { Thumbnail } from "@/pages/planner/components/index.ts";
import { itemSize } from "@/pages/planner/mock/index.ts";
import { Button, Icon } from "@/shared/components/index.ts";
import { money } from "@/shared/helpers/index.ts";

import { useCatalogResults } from "../hooks/index.ts";
import type { CatalogData } from "../loader.ts";

export const CatalogLoading = () => (
  <div className='catalog-loading' role='status'>
    <p>Загружаем предложения…</p>
    <div className='catalog-grid' aria-hidden='true'>
      <span />
      <span />
      <span />
    </div>
  </div>
);

export const CatalogResults = ({
  result,
  fitOnly,
  planPath
}: {
  result: Promise<CatalogData>;
  fitOnly: boolean;
  planPath: string;
}) => {
  const data = use(result);
  const { offers, retry, retrying } = useCatalogResults(
    data.status === "ready" ? data.offers : [],
    fitOnly
  );
  if (data.status === "error") {
    return (
      <div className='notice'>
        <p role='alert'>Каталог недоступен. {data.message}</p>
        <Button onClick={retry} disabled={retrying}>
          {retrying ? "Загружаем предложения…" : "Повторить загрузку"}
        </Button>
      </div>
    );
  }
  if (!offers.length) {
    return (
      <p className='notice'>
        Подходящих товаров нет. Измените фильтры или добавьте позицию вручную.
      </p>
    );
  }
  return (
    <div className='catalog-grid'>
      {offers.map(({ item, included, justAdded, problems, selectOffer }) => (
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
            <strong>{item.price === undefined ? "Цена не указана" : money(item.price)}</strong>
            {problems.length > 0 && <p className='form-error'>{problems.join(" · ")}</p>}
            <div className='inline-actions'>
              <Button
                icon={included ? "pencil" : "plus"}
                className={included ? "" : "primary"}
                onClick={selectOffer}
              >
                {included ? "В смете · Редактировать" : "Добавить в смету"}
              </Button>
              {justAdded && (
                <Link className='btn' to={planPath}>
                  Вернуться к плану
                </Link>
              )}
              {item.url && (
                <a className='btn' href={item.url} target='_blank' rel='noreferrer'>
                  <Icon name='external' /> {item.mode === "office" ? "Открыть КП" : "У продавца"}
                </a>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};
