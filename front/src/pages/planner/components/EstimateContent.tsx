import { money, safeUrl } from "../../../shared/helpers/index.ts";
import { useEstimateContent } from "../hooks/index.ts";
import { checkLabel, itemSize, lineTotal, procurementFields, sourceLabel } from "../mock/index.ts";
import type { Inspection, Item, Positions, Project } from "../types/index.ts";

export type EstimateContentProps = {
  project: Project;
  items: Item[];
  inspection: Inspection;
  positions: Positions;
  print?: boolean;
};

export const EstimateContent = (props: EstimateContentProps) => {
  const { project, items, inspection, print = false } = props;
  const { total, difference, office, rows } = useEstimateContent(props);
  return (
    <>
      <div className='estimate-totals'>
        <div>
          <span>Бюджет</span>
          <strong>{money(project.budget)}</strong>
        </div>
        <div>
          <span>К покупке</span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>{difference >= 0 ? "Остаток" : "Превышение"}</span>
          <strong className={difference < 0 ? "form-error" : ""}>
            {money(Math.abs(difference))}
          </strong>
        </div>
      </div>
      <div className='overflow-auto'>
        <table>
          <thead>
            <tr>
              <th>Позиция</th>
              <th>Продавец</th>
              <th>Размеры</th>
              <th>Цена за ед.</th>
              <th>Количество</th>
              <th>Сумма</th>
              <th>Проверка</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, issues }) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <small>
                    {item.demo && "Демонстрационное предложение · "}
                    {item.kind === "service" ? "Услуга" : item.material}
                    {item.sku && ` · ${item.sku}`}
                  </small>
                </td>
                <td>
                  {item.url ? (
                    <a href={item.url} target='_blank' rel='noreferrer'>
                      {item.seller || "Ссылка на товар"}
                    </a>
                  ) : (
                    item.seller || "—"
                  )}
                  {item.offerReason && <small>{item.offerReason}</small>}
                  {item.details && <small>{item.details}</small>}
                </td>
                <td>{item.kind === "service" ? "—" : itemSize(item)}</td>
                <td>{money(item.price)}</td>
                <td>{item.quantity ?? 1}</td>
                <td>{money(lineTotal(item))}</td>
                <td>
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
              <tr>
                <td colSpan={7}>Пока нет позиций к покупке.</td>
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
