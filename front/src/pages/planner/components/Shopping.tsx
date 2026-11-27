import { Button, Icon } from "../../../shared/components/index.ts";
import { money } from "../../../shared/helpers/index.ts";
import { itemSize, sourceLabel } from "../data/index.ts";
import { useShopping } from "../hooks/index.ts";
import { PanelTitle } from "./PanelTitle.tsx";
import { Thumbnail } from "./Thumbnail.tsx";

export const Shopping = () => {
  const {
    project,
    items,
    total,
    difference,
    fraction,
    entries,
    addPurchase,
    openCatalog,
    openEstimate
  } = useShopping();
  return (
    <aside className='panel shopping' aria-label='К покупке'>
      <PanelTitle icon='bag' title='К покупке' count={items.length} />
      <div className={`budget-summary ${difference < 0 ? "over-budget" : ""}`}>
        <div className='budget-top'>
          <span>Итого по смете</span>
          <span className='budget-badge'>
            <Icon name={difference >= 0 ? "check" : "alert"} size={13} />
            {difference >= 0 ? "В бюджете" : "Сверх бюджета"}
          </span>
        </div>
        <strong className='total'>{money(total)}</strong>
        <div
          className='budget-track'
          role='progressbar'
          aria-label='Использовано бюджета'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
        >
          <i style={{ width: `${fraction * 100}%` }} />
        </div>
        <div className='budget-bottom'>
          <span>из {money(project.budget)}</span>
          <strong>
            {difference >= 0 ? "Остаток" : "Не хватает"} {money(Math.abs(difference))}
          </strong>
        </div>
      </div>
      <div className='shopping-list'>
        <div className='shopping-label'>
          <h3>Список покупок</h3>
          <button className='small-link' onClick={addPurchase}>
            <Icon name='plus' size={15} />
            Добавить
          </button>
        </div>
        {items.length ? (
          entries.map(({ item, editItem, issues }) => (
            <div key={item.id} className='product-row'>
              <button className='product-main' onClick={editItem}>
                <Thumbnail item={item} />
                <span className='product-meta'>
                  <strong>{item.name}</strong>
                  <small>
                    {item.seller || sourceLabel[item.source]} <b>·</b> {itemSize(item)}
                  </small>
                  <span className='text-[#332742] text-[13px] font-[830] flex gap-1.25 items-center'>
                    {money(item.price)}
                    {issues.length > 0 && (
                      <span className='text-[#ae6153]' title={issues.join(", ")}>
                        <Icon name='alert' size={15} />
                      </span>
                    )}
                  </span>
                </span>
              </button>
              {item.url && (
                <a
                  className='product-link'
                  href={item.url}
                  target='_blank'
                  rel='noreferrer'
                  aria-label={`Открыть страницу товара ${item.name}`}
                  title='Страница товара'
                >
                  <Icon name='external' size={16} />
                </a>
              )}
            </div>
          ))
        ) : (
          <p className='text-[12.5px] text-muted py-2.25 px-0 font-[650]'>
            Добавьте товары, объявления или предложения поставщиков.
          </p>
        )}
      </div>
      <Button icon='grid' className='catalog-btn' onClick={openCatalog}>
        Открыть каталог
      </Button>
      <button className='text-btn estimate-btn' onClick={openEstimate}>
        <Icon name='receipt' size={17} />
        Подробная смета
        <Icon className='ml-auto' name='chevron' size={14} />
      </button>
    </aside>
  );
};
