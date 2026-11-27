import { Button } from "@/shared/components/index.ts";

import { useProjectHeader } from "../hooks/index.ts";
import type { Action, Room } from "../types/index.ts";

export type ProjectHeaderProps = { room: Room; action: Action };

export const ProjectHeader = (props: ProjectHeaderProps) => {
  const { openProjects } = useProjectHeader(props);
  return (
    <header className='project-head'>
      <div>
        <h1>План</h1>
        <p>{props.room.name}</p>
      </div>
      <Button icon='folder' onClick={openProjects}>
        Проект
      </Button>
    </header>
  );
};
