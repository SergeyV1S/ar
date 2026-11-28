import { materials, modes } from "@/pages/planner/mock/index.ts";
import { Field, Select } from "@/shared/components/index.ts";

import { usePurchaseConditions } from "../hooks/index.ts";

export const PurchaseConditions = () => {
  const { project, budgetValue, changeBudget, formatBudget, changeMaterial, changeMode } =
    usePurchaseConditions();
  return (
    <details className='panel editor-panel purchase-settings'>
      <summary>Условия подбора</summary>
      <div className='purchase-conditions'>
        <Field label='Способ покупки'>
          <Select name='purchase-mode' value={project.mode} onChange={changeMode}>
            {Object.entries(modes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label='Материал'>
          <Select name='material' value={project.material} onChange={changeMaterial}>
            {materials.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field label='Общий бюджет'>
          <span className='input-unit'>
            <input
              name='budget'
              type='text'
              inputMode='numeric'
              placeholder='Не задан'
              value={budgetValue}
              onChange={changeBudget}
              onBlur={formatBudget}
            />
            <span aria-hidden='true'>₽</span>
          </span>
        </Field>
      </div>
    </details>
  );
};
