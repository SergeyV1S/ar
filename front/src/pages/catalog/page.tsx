import { Suspense } from "react";
import { Link } from "react-router";

import { getItemPath, getWishPath, getWishPurchases } from "@/pages/planner/helpers/index.ts";
import { RetailCatalog } from "@/pages/planner/components/index.ts";
import { usePlannerContext } from "@/pages/planner/hooks/index.ts";
import { itemSize } from "@/pages/planner/mock/index.ts";
import { Button } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";
import { money } from "@/shared/helpers/index.ts";

import { CatalogLoading, CatalogResults, PurchaseConditions, WishCatalog } from "./components/index.ts";
import { useCatalogPage } from "./hooks/index.ts";

export const CatalogPage = () => {
  const { project, openProcurement } = usePlannerContext();
  const { data, fitOnly, selectedItem, wish, difference, hasUnknownPrices, filterOffers, addManually } =
    useCatalogPage();
  const planPath = getItemPath(PATHS.planner, selectedItem?.id ?? null);
  return (
    <>
      <header className='project-head'>
        <div>
          <h1>Каталог</h1>
          <p>
            {project.room.name}
            {wish && ` · ${wish.name}`}
          </p>
        </div>
        <div className='editor-links'>
          <Link className='btn' to={PATHS.estimate}>
            Открыть смету
          </Link>
        </div>
      </header>
      {!wish && <PurchaseConditions />}
      <div className='catalog-layout'>
        <aside className='panel editor-panel catalog-context' aria-label='Контекст подбора'>
          {wish ? (
            <>
              <h2>{wish.name}</h2>
              {selectedItem && <p>На плане · {itemSize(selectedItem)}</p>}
              <p>{wish.quantity} шт.{wish.material && ` · ${wish.material}`}</p>
            </>
          ) : (
            <>
              <h2>{difference < 0 ? "Превышение бюджета" : "Остаток бюджета"}</h2>
              <p>
                <strong>{money(Math.abs(difference))}</strong>
              </p>
              {hasUnknownPrices && <p>Предварительно, по указанным ценам.</p>}
            </>
          )}
          {project.brief && project.brief.wishes.length > 0 && (
            <ul className='planner-furniture-list' aria-label='Позиции для подбора'>
              {project.brief.wishes.map((entry) => (
                <li key={entry.id}>
                  <Link className='plan-item' aria-current={entry.id === wish?.id ? "page" : undefined}
                    to={getWishPath(PATHS.catalog, entry.id)}>
                    <span className='min-w-0'><strong>{entry.name}</strong></span>
                    <small>{getWishPurchases(project, entry).length} из {entry.quantity}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className='btn' to={planPath}>
            Вернуться к плану
          </Link>
        </aside>
        <section className='panel editor-panel catalog-results' aria-labelledby='catalog-offers'>
          <div className='row-title'>
            <h2 id='catalog-offers'>Предложения</h2>
            {!wish && <Button icon='plus' onClick={addManually}>Внести позицию вручную</Button>}
          </div>
          {wish && data.cities && (
            <Suspense fallback={<CatalogLoading />}>
              <WishCatalog key={wish.id} wish={wish} cities={data.cities} />
            </Suspense>
          )}
          {!wish && project.mode === "retail" && (
            <RetailCatalog showHeading={false} />
          )}
          {!wish && project.mode === "office" && (
            <>
              <p className='support-text'>
                Демонстрационные предложения. Для фактического подбора требуется подключение источника.
              </p>
              <label className='check-field'>
                <input type='checkbox' checked={fitOnly} onChange={filterOffers} />
                Показывать подходящие и уже добавленные
              </label>
              <Suspense fallback={<CatalogLoading />}>
                <CatalogResults result={data.offers} fitOnly={fitOnly} planPath={planPath} />
              </Suspense>
            </>
          )}
          {!wish && project.mode === "used" && (
            <p className='support-text'>Выберите позицию в списке покупок, чтобы найти объявления Авито.</p>
          )}
          <div className='editor-links'>
            {!wish && project.mode === "used" && (
              <Link className='btn' to={`${PATHS.planner}?step=wishes`}>К списку покупок</Link>
            )}
            {project.mode === "office" && <Button onClick={openProcurement}>Поля закупки</Button>}
          </div>
        </section>
      </div>
    </>
  );
};
