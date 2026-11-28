import { Suspense } from "react";
import { Link } from "react-router";

import { getItemPath } from "@/pages/planner/helpers/index.ts";
import { RetailCatalog } from "@/pages/planner/components/index.ts";
import { usePlannerContext } from "@/pages/planner/hooks/index.ts";
import { itemSize } from "@/pages/planner/mock/index.ts";
import { Button } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";
import { money } from "@/shared/helpers/index.ts";

import { CatalogLoading, CatalogResults, PurchaseConditions } from "./components/index.ts";
import { useCatalogPage } from "./hooks/index.ts";

export const CatalogPage = () => {
  const { project, openProcurement } = usePlannerContext();
  const { data, fitOnly, selectedItem, difference, hasUnknownPrices, filterOffers, addManually } =
    useCatalogPage();
  const planPath = getItemPath(PATHS.planner, selectedItem?.id ?? null);
  return (
    <>
      <header className='project-head'>
        <div>
          <h1>Каталог</h1>
          <p>
            {project.room.name}
            {selectedItem && ` · ${selectedItem.name}, ${itemSize(selectedItem)}`}
          </p>
        </div>
        <div className='editor-links'>
          <Link className='btn' to={PATHS.estimate}>
            Открыть смету
          </Link>
        </div>
      </header>
      <PurchaseConditions />
      <div className='catalog-layout'>
        <aside className='panel editor-panel catalog-context' aria-label='Контекст подбора'>
          {selectedItem ? (
            <>
              <h2>Предмет на плане</h2>
              <p>
                <strong>{selectedItem.name}</strong> · {itemSize(selectedItem)}
              </p>
              <p>Добавленная мебель появится в смете отдельной позицией.</p>
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
          <Link className='btn' to={planPath}>
            Вернуться к плану
          </Link>
        </aside>
        <section className='panel editor-panel catalog-results' aria-labelledby='catalog-offers'>
          <div className='row-title'>
            <h2 id='catalog-offers'>Предложения</h2>
            <Button icon='plus' onClick={addManually}>
              Внести позицию вручную
            </Button>
          </div>
          {project.mode === "retail" ? (
            <RetailCatalog showHeading={false} />
          ) : (
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
          <div className='editor-links'>
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
          </div>
        </section>
      </div>
    </>
  );
};
