import { Link } from "react-router";

import { Thumbnail } from "@/pages/planner/components";
import { getItemPath } from "@/pages/planner/helpers/index.ts";
import {
  checkLabel,
  itemSize,
  lineTotal,
  procurementFields,
  sourceLabel
} from "@/pages/planner/mock/index.ts";
import type { Action, Inspection, Item, Positions, Project } from "@/pages/planner/types/index.ts";
import { Button, IconButton } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";
import { money, safeUrl } from "@/shared/helpers/index.ts";

import { useEstimateContent } from "../hooks/index.ts";

export type EstimateContentProps = {
  project: Project;
  items: Item[];
  inspection: Inspection;
  positions: Positions;
  action?: Action;
  print?: boolean;
};

export const EstimateContent = (props: EstimateContentProps) => {
  const { project, items, inspection, print = false } = props;
  const { total, difference, hasUnknownPrices, office, rows } = useEstimateContent(props);
  return (
    <>
      <div className='estimate-totals'>
        <div>
          <span>Бюджет</span>
          <strong>{project.budget === undefined ? "Не задан" : money(project.budget)}</strong>
        </div>
        <div>
          <span>{hasUnknownPrices ? "Сумма известных цен" : "Итого к покупке"}</span>
          <strong>{money(total)}</strong>
        </div>
        {difference !== undefined && <div>
          <span>{difference >= 0 ? "Остаток" : "Превышение"}</span>
          <strong className={difference < 0 ? "form-error" : ""}>
            {money(Math.abs(difference))}
          </strong>
        </div>}
      </div>
      {hasUnknownPrices && (
        <p className='notice estimate-price-note'>
          В итог включены только позиции с указанными ценами.
        </p>
      )}
      {!print && items.length > 0 && (
        <div className='estimate-cards'>
          {rows.map(({ item, issues, editItem, onPlan }) => (
            <article key={item.id}>
              <div className='estimate-card-head'>
                <Thumbnail item={item} />
                <div><h3>{item.name}</h3><p>{[item.seller, item.kind !== "service" && itemSize(item)].filter(Boolean).join(" · ")}</p>
                  <strong>{item.price === undefined ? "Цена не указана" : money(lineTotal(item))}</strong>
                  <small>{item.quantity ?? 1} шт.</small>
                </div>
                {editItem && <IconButton icon='pencil' label={`Редактировать позицию ${item.name}`} onClick={editItem} />}
              </div>
              {issues.length > 0 && <p className='form-error'>{issues.join(", ")}</p>}
              <details><summary>Подробности</summary>
                <p>{item.demo && "Демонстрационное предложение · "}{[item.material, item.sku, item.catalogCity, item.availability].filter(Boolean).join(" · ")}</p>
                <p>Цена за единицу · {item.price === undefined ? "Не указана" : money(item.price)}</p>
                {item.cap !== undefined && item.cap > 0 && <p>Лимит позиции · {money(item.cap)}</p>}
                <p>{sourceLabel[item.source]} · {checkLabel[item.verified]}</p>
                {item.offerReason && <p>{item.offerReason}</p>}
                {item.details && <p>{item.details}</p>}
                {item.url && <a href={item.url} rel='noreferrer' target='_blank'>Открыть у продавца</a>}
                {onPlan && <Link className='estimate-link' to={getItemPath(PATHS.planner, item.id)}>Показать на плане</Link>}
              </details>
            </article>
          ))}
        </div>
      )}
      <div className='estimate-rows'>
        <table role='table' aria-label='Позиции сметы'>
          <thead role='rowgroup'>
            <tr role='row'>
              <th scope='col' role='columnheader'>
                Позиция
              </th>
              <th scope='col' role='columnheader'>
                Продавец
              </th>
              <th scope='col' role='columnheader'>
                Размеры
              </th>
              <th scope='col' role='columnheader'>
                Цена за ед.
              </th>
              <th scope='col' role='columnheader'>
                Количество
              </th>
              <th scope='col' role='columnheader'>
                Сумма
              </th>
              <th scope='col' role='columnheader'>
                Проверка
              </th>
            </tr>
          </thead>
          <tbody role='rowgroup'>
            {rows.map(({ item, issues, editItem, onPlan }) => (
              <tr key={item.id} role='row'>
                <td role='cell' className='estimate-item'>
                  <strong>{item.name}</strong>
                  <small>
                    {item.demo && "Демонстрационное предложение · "}
                    {item.kind === "service" ? "Услуга" : item.material}
                    {item.sku && ` · ${item.sku}`}
                  </small>
                  {!print && onPlan && (
                    <Link className='estimate-link' to={getItemPath(PATHS.planner, item.id)}>
                      Показать на плане
                    </Link>
                  )}
                </td>
                <td role='cell' data-label='Продавец'>
                  {item.url ? (
                    <a href={item.url} target='_blank' rel='noreferrer'>
                      {item.seller || "Ссылка на товар"}
                    </a>
                  ) : (
                    item.seller || "—"
                  )}
                  {item.catalogCity && <small>{item.catalogCity} · {item.availability}</small>}
                  {item.offerReason && <small>{item.offerReason}</small>}
                  {item.details && <small>{item.details}</small>}
                </td>
                <td role='cell' data-label='Размеры'>
                  {item.kind === "service" ? "—" : itemSize(item)}
                </td>
                <td role='cell' data-label='Цена за ед.'>
                  {item.price === undefined ? "Не указана" : money(item.price)}
                  {item.cap !== undefined && item.cap > 0 && (
                    <small>Лимит позиции {money(item.cap)}</small>
                  )}
                  {editItem && (
                    <Button className='estimate-edit' icon='pencil' onClick={editItem}>
                      Редактировать позицию
                    </Button>
                  )}
                </td>
                <td role='cell' data-label='Количество'>
                  {item.quantity ?? 1}
                </td>
                <td role='cell' data-label='Сумма'>
                  {item.price === undefined ? "—" : money(lineTotal(item))}
                </td>
                <td role='cell' data-label='Проверка'>
                  <span className={issues.length ? "form-error" : ""}>
                    {issues.length ? issues.join(", ") : "В пределах лимитов"}
                  </span>
                  <small>
                    {sourceLabel[item.source]} · {checkLabel[item.verified]}
                    {item.availability && ` · ${item.availability}`}
                  </small>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr role='row'>
                <td colSpan={7} role='cell'>
                  Пока нет позиций к покупке.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {office && (
        <div className='procurement-summary'>
          <h3>Данные служебной закупки</h3>
          {Object.entries(procurementFields).map(([key, value]) => (
            <p key={key}>
              <strong>{value}</strong>{" "}
              {key === "offer" && safeUrl(project.procurement[key]) ? (
                <a href={project.procurement[key]} rel='noreferrer' target='_blank'>
                  {project.procurement[key]}
                </a>
              ) : (
                project.procurement[key] || "—"
              )}
            </p>
          ))}
        </div>
      )}
      {print &&
        inspection.warnings.map((warning) => (
          <p
            className='form-error'
            key={JSON.stringify([warning.id, warning.other, warning.message])}
          >
            {warning.message}
          </p>
        ))}
    </>
  );
};
