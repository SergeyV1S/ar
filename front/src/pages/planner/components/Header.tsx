import { Button } from "@/shared/components/index.ts";
import { usePlannerContext } from "../hooks/index.ts";
import { Brand } from "./Brand.tsx";

export const Header = () => {
  const { openProjects } = usePlannerContext();
  return (
    <header className='topbar'>
      <div className='top-inner'>
        <Brand />
        <div className='top-actions'>
          <Button icon='folder' className='planner-project-button' onClick={openProjects}>
            Проект
          </Button>
        </div>
      </div>
    </header>
  );
};
