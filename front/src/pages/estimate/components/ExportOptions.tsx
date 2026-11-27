import type { Action, ExportFormat, Project } from "@/pages/planner/types/index.ts";
import { Button, Icon } from "@/shared/components/index.ts";

import { useExportOptions } from "../hooks/index.ts";

export type ExportOptionsProps = {
  project: Project;
  action: Action;
  run: (format: ExportFormat) => void;
};

export const ExportOptions = (props: ExportOptionsProps) => {
  const { missing, openProcurement, exportPdf, exportCsv } = useExportOptions(props);
  return (
    <>
      {missing.length > 0 && (
        <div className='notice'>
          <p>Для служебной сметы заполните поля проекта и реквизиты поставщиков.</p>
          <ul>
            {missing.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </div>
      )}
      {props.project.mode === "office" && (
        <Button icon='receipt' onClick={openProcurement}>
          Редактировать поля закупки
        </Button>
      )}
      <div className='option-list'>
        <button disabled={missing.length > 0} onClick={exportPdf}>
          <Icon name='printer' />
          <span>
            <strong>План и смета в PDF</strong>
            <small>Печать или сохранение в PDF через браузер</small>
          </span>
        </button>
        <button disabled={missing.length > 0} onClick={exportCsv}>
          <Icon name='receipt' />
          <span>
            <strong>Таблица закупки в CSV</strong>
            <small>Позиции, цены, габариты и поставщики</small>
          </span>
        </button>
      </div>
    </>
  );
};
