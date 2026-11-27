import { Button, Icon } from "../../../shared/components/index.ts";
import { useCheckReport } from "../hooks/index.ts";
import { variants } from "../planning/index.ts";
import type { Action, Inspection, Project } from "../types/index.ts";

export type CheckReportProps = {
  project: Project;
  inspection: Inspection;
  action: Action;
};

export const CheckReport = (props: CheckReportProps) => {
  const { project, inspection } = props;
  const { editRoom, passageMessage } = useCheckReport(props);
  return (
    <>
      <div className='check-list'>
        <div>
          <Icon name={inspection.state === "ok" ? "checkCircle" : "info"} />
          {passageMessage}
        </div>
        {inspection.warnings.map(({ id, other, message }) => (
          <div className='warning-text' key={JSON.stringify([id, other, message])}>
            <Icon name='alert' />
            {message}
          </div>
        ))}
        {inspection.warnings.length === 0 && (
          <div>
            <Icon name='checkCircle' />
            Пересечений мебели, стен и зон открывания нет.
          </div>
        )}
      </div>
      <p className='support-text'>
        Вариант «{variants[project.variant].title}». Проверка основана на размерах и проёмах в
        проекте.
      </p>
      <div className='form-actions'>
        <Button icon='pencil' onClick={editRoom}>
          Настроить комнату
        </Button>
      </div>
    </>
  );
};
