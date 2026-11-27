import { Button, Icon } from "../../../shared/components/index.ts";
import { useProjectHeader } from "../hooks/index.ts";
import type { Action, Room } from "../types/index.ts";

export type ProjectHeaderProps = { room: Room; action: Action };

export const ProjectHeader = (props: ProjectHeaderProps) => {
  const { room } = props;
  const { openProjects, openExport, replan } = useProjectHeader(props);
  return (
    <section className='project-head'>
      <div>
        <div className='breadcrumb'>
          <Icon name='folder' size={16} />
          <button onClick={openProjects}>Мои проекты</button>
          <Icon name='chevron' size={12} />
          <span>{room.name}</span>
        </div>
        <h1>Планировка комнаты</h1>
        <p>Расставьте мебель, проверьте проходы и соберите смету.</p>
      </div>
      <div className='project-actions'>
        <Button icon='download' onClick={openExport}>
          Экспорт
        </Button>
        <Button icon='spark' className='primary' onClick={replan}>
          Подобрать варианты
        </Button>
      </div>
    </section>
  );
};
