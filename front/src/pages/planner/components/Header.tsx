import { NavLink } from "react-router";

import { Button, Icon } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";

import { getItemPath } from "../helpers/index.ts";
import { usePlannerContext } from "../hooks/index.ts";
import { Brand } from "./Brand.tsx";

export const Header = () => {
  const { selected, openProjects } = usePlannerContext();
  return (
    <header className='topbar'>
      <div className='top-inner'>
        <Brand />
        <nav className='nav' aria-label='Основное меню'>
          <NavLink end to={getItemPath(PATHS.planner, selected)} className='nav-link'>
            <Icon name='layout' />
            План
          </NavLink>
          <NavLink to={PATHS.catalog} className='nav-link'>
            <Icon name='grid' />
            Каталог
          </NavLink>
          <NavLink to={PATHS.estimate} className='nav-link'>
            <Icon name='receipt' />
            Смета
          </NavLink>
        </nav>
        <div className='top-actions'>
          <Button icon='folder' className='planner-project-button' onClick={openProjects}>
            Проект
          </Button>
        </div>
      </div>
    </header>
  );
};
