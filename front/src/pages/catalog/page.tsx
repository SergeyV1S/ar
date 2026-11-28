import { Suspense } from "react";
import { Link } from "react-router";

import { getItemPath, getWishPath, getWishPurchases } from "@/pages/planner/helpers/index.ts";
import { ProjectHeader, RetailCatalog } from "@/pages/planner/components/index.ts";
import { usePlannerContext } from "@/pages/planner/hooks/index.ts";
import { itemSize } from "@/pages/planner/mock/index.ts";
import { Button } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";
import { money } from "@/shared/helpers/index.ts";

import { CatalogLoading, PurchaseConditions, WishCatalog } from "./components/index.ts";
import { useCatalogPage } from "./hooks/index.ts";

export const CatalogPage = () => {
  const { project, openProcurement } = usePlannerContext();
  const { data, selectedItem, wish, difference, hasUnknownPrices, addManually } =
    useCatalogPage();
  const planPath = getItemPath(PATHS.planner, selectedItem?.id ?? null);
  return (
    <div className='planner-flow'>
      <ProjectHeader title='Каталог' description={wish ? `${project.room.name} · ${wish.name}` : project.room.name} illustrated={false}>
        <Link className='btn' to={PATHS.estimate}>Открыть смету</Link>
      </ProjectHeader>
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
              {difference === undefined ? <h2>Бюджет не задан</h2> : (
                <>
                  <h2>{difference < 0 ? "Превышение бюджета" : "Остаток бюджета"}</h2>
                  <p><strong>{money(Math.abs(difference))}</strong></p>
                  {hasUnknownPrices && <p>Предварительно, по указанным ценам.</p>}
                </>
              )}
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
          {!wish && project.mode !== "retail" && (
            <p className='support-text'>Выберите позицию в списке покупок или внесите предложение вручную.</p>
          )}
          <div className='editor-links'>
            {!wish && project.mode !== "retail" && (
              <Link className='btn' to={`${PATHS.planner}?step=wishes`}>К списку покупок</Link>
            )}
            {project.mode === "office" && <Button onClick={openProcurement}>Поля закупки</Button>}
          </div>
        </section>
      </div>
    </div>
  );
};
