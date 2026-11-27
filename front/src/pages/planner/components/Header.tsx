import { NavLink } from "react-router";

import { Icon } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";

import { getItemPath } from "../helpers/index.ts";
import { usePlannerContext } from "../hooks/index.ts";
import { Brand } from "./Brand.tsx";

export const Header = ({ status }: { status: string }) => {
  const { selected } = usePlannerContext();
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
          <span className='save-state' role='status'>
            <i className={status.includes("ошибка") ? "warning" : ""} aria-hidden='true' />
            {status}
          </span>
        </div>
      </div>
    </header>
  );
};
