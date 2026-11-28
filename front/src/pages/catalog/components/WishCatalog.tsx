import { use } from "react";
import { Link } from "react-router";

import { Thumbnail } from "@/pages/planner/components/index.ts";
import { getItemPath } from "@/pages/planner/helpers";
import type { ProjectWish } from "@/pages/planner/types";
import type { CatalogCity } from "@/shared/api/requests";
import { Button, Field } from "@/shared/components";
import { PATHS } from "@/shared/constants";
import { centimeters, money } from "@/shared/helpers";

import { useWishCatalog } from "../hooks";

const sizeLabel = ({ w, d, h }: { w: number; d: number; h: number }) =>
  `${[w, d, h].map(centimeters).join(" × ")} см`;
const listingSize = ({ w, d, h }: { w?: number; d?: number; h?: number }) =>
  w !== undefined && d !== undefined && h !== undefined ? sizeLabel({ w, d, h }) : undefined;

export const WishCatalog = ({
  wish, cities
}: { wish: ProjectWish; cities: Promise<CatalogCity[]> }) => {
  const model = useWishCatalog(wish, use(cities));
  const {
    city, cityId, chosen, search, maxPrice, divanAvailable, changeCity, replaced, divan, avito,
    allowsSearch, retry, selection, selectedListing, selectionError, status, clearSelection,
    selectPurchase, divanCards, avitoCards, confirmation
  } = model;

  return (
    <div className='grid gap-5'>
      {chosen.length > 0 && (
        <ul className='planner-furniture-list' aria-label='Выбранная мебель'>
          {chosen.map((item) => (
            <li key={item.id}>
              <Link className='plan-item' to={getItemPath(PATHS.planner, item.id)}>
                <span className='min-w-0'>
                  <strong>{item.name}</strong>
                  <small>{item.seller} · {money(item.price)}</small>
                </span>
                <small>На плане</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {status && <p className='notice' role='status'>{status}</p>}
      {search.quantity > 0 && (
        <div className='grid gap-3'>
          <Field label='Город поиска'>
            <select value={city ? cityId : ""} onChange={changeCity}>
              <option value=''>Выберите город</option>
              {model.cities.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </Field>
          <p className='support-text'>
            Осталось выбрать {search.quantity} шт.
            {maxPrice !== undefined && maxPrice > 0 && ` · до ${money(maxPrice)} за предмет`}
            {wish.material && ` · ${wish.material}`}
          </p>
          {city && maxPrice === 0 && <p className='notice'>В бюджете не осталось средств на эту позицию.</p>}
          {replaced && <p className='support-text'>На плане сейчас «{replaced.name}».</p>}
        </div>
      )}
      {selection && (
        <form className='notice grid gap-3' onSubmit={selectPurchase}>
          <h3 ref={confirmation} tabIndex={-1}>{selection.offer.name}</h3>
          {(selectedListing?.photo ?? selection.offer.photo) && (
            <Thumbnail className='catalog-selection-photo' item={{ photo: selectedListing?.photo ?? selection.offer.photo }} />
          )}
          {selection.source === "divan" && (
            <p>{sizeLabel(selection.offer)} · {money(selection.offer.price * search.quantity)}</p>
          )}
          {selection.source === "avito" && !selectedListing && !selectionError && (
            <p role='status'>Проверяем объявление на Авито…</p>
          )}
          {selectedListing && (
            <>
              <p>{selectedListing.price === undefined ? "Цена в объявлении не указана" : money(selectedListing.price)}</p>
              <div className='grid grid-cols-3 gap-2'>
                <Field label='Ширина, см'>
                  <input name='width' type='number' min='5' max='2000' step='any' required
                    defaultValue={selectedListing.w === undefined ? undefined : centimeters(selectedListing.w)} />
                </Field>
                <Field label='Длина, см'>
                  <input name='depth' type='number' min='5' max='2000' step='any' required
                    defaultValue={selectedListing.d === undefined ? undefined : centimeters(selectedListing.d)} />
                </Field>
                <Field label='Высота, см'>
                  <input name='height' type='number' min='5' max='2000' step='any' required
                    defaultValue={selectedListing.h === undefined ? undefined : centimeters(selectedListing.h)} />
                </Field>
              </div>
              {!listingSize(selectedListing) && <p className='support-text'>Уточните недостающие размеры у продавца.</p>}
              {wish.material && (
                <label className='check-field'>
                  <input name='material' type='checkbox' required />
                  Я проверил материал у продавца ({wish.material.toLowerCase()})
                </label>
              )}
              {selectedListing.condition === "unknown" && (
                <label className='check-field'>
                  <input name='used' type='checkbox' required />
                  Я уточнил у продавца, что мебель б/у
                </label>
              )}
            </>
          )}
          {replaced && (selection.source === "divan" || selectedListing) && (
            <label className='check-field'>
              <input name='replace' type='checkbox' required />
              Убрать «{replaced.name}» из проекта после выбора
            </label>
          )}
          {selectionError && <p className='form-error' role='alert'>{selectionError}</p>}
          <div className='inline-actions'>
            <Button onClick={clearSelection}>Отмена</Button>
            {(selection.source === "divan" || selectedListing?.price !== undefined) && (
              <Button type='submit' className='primary'>{replaced ? "Подтвердить замену" : "Выбрать для проекта"}</Button>
            )}
          </div>
        </form>
      )}
      {allowsSearch && (
        <>
          <section className='grid gap-3' aria-labelledby='wish-divan'>
            <h3 id='wish-divan'>Новая мебель · Divan.ru</h3>
            {wish.category === "other" && <p className='support-text'>Для этого типа мебели доступен поиск на Авито.</p>}
            {wish.category !== "other" && !divanAvailable && <p className='support-text'>Divan.ru недоступен для выбранного города.</p>}
            {divanAvailable && divan.busy && <p className='support-text' role='status'>Ищем варианты по габаритам и бюджету…</p>}
            {divan.message && <p className='support-text' role='status'>{divan.message}</p>}
            {divanAvailable && !divan.busy && !divan.message && !divanCards.length && (
              <p className='support-text'>Подходящих предложений Divan.ru нет.</p>
            )}
            <div className='catalog-grid'>
              {divanCards.map(({ offer, preview }) => (
                <article className='catalog-card' key={offer.sku}>
                  <Thumbnail item={{ photo: offer.photo, kind: wish.category }} />
                  <div className='catalog-card-body'>
                    <h3>{offer.name}</h3>
                    <p>{sizeLabel(offer)}{offer.materials.length > 0 && ` · ${offer.materials.join(", ")}`}</p>
                    <strong>{money(offer.price * search.quantity)}</strong>
                    <div className='inline-actions'>
                      <Button onClick={preview}>Выбрать</Button>
                      <a className='btn' href={offer.url} target='_blank' rel='noreferrer'>У продавца</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className='grid gap-3' aria-labelledby='wish-avito'>
            <h3 id='wish-avito'>Б/у аналоги · Авито</h3>
            {avito.busy && <p className='support-text' role='status'>Ищем в объявлениях…</p>}
            {avito.message && <p className='support-text' role='status'>{avito.message}</p>}
            {!avito.busy && !avito.message && !avitoCards.length && (
              <p className='support-text'>По этому запросу ничего не найдено.</p>
            )}
            <div className='catalog-grid'>
              {avitoCards.map(({ offer, preview }) => (
                <article className='catalog-card' key={offer.url}>
                  <Thumbnail item={{ photo: offer.photo, kind: wish.category }} />
                  <div className='catalog-card-body'>
                    <h3>{offer.name}</h3>
                    <p>{listingSize(offer) ?? "Размеры уточняются в объявлении"}{offer.location && ` · ${offer.location}`}</p>
                    <strong>{money(offer.price)}</strong>
                    <div className='inline-actions'>
                      <Button onClick={preview}>Проверить и выбрать</Button>
                      <a className='btn' href={offer.url} target='_blank' rel='noreferrer'>Объявление</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          {(divan.message || avito.message) && <Button onClick={retry}>Повторить поиск</Button>}
        </>
      )}
      <div className='editor-links'>
        <Link className='btn' to={`${PATHS.planner}?step=wishes`}>К списку покупок</Link>
        <Link className='btn primary' to={`${PATHS.planner}?step=layout`}>К расстановке</Link>
      </div>
    </div>
  );
};
