import { NavLink } from "react-router";

import { Icon, IconButton } from "../../../shared/components/index.ts";
import { PATHS } from "../../../shared/constants/index.ts";
import { useHeader } from "../hooks/index.ts";
import type { Action } from "../types/index.ts";
import { Brand } from "./Brand.tsx";

export type HeaderProps = { action: Action; status: string };

export const Header = (props: HeaderProps) => {
  const { status } = props;
  const { navItems, openPlanner, openPrivacy } = useHeader(props);
  return (
    <header className='topbar'>
      <div className='top-inner'>
        <Brand onClick={openPlanner} />
        <nav className='nav' aria-label='Основное меню'>
          <NavLink end to={PATHS.planner} className='nav-link' onClick={openPlanner}>
            <Icon name='layout' />
            Планировка
          </NavLink>
          {navItems.map(({ key, icon, label, openNav }) => (
            <button key={key} className='nav-link' onClick={openNav}>
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <div className='top-actions'>
          <span className='save-state'>
            <i className={status.includes("ошибка") ? "warning" : ""} />
            {status}
          </span>
          <IconButton
            icon='shield'
            className='account'
            label='Хранение и защита проекта'
            onClick={openPrivacy}
          />
        </div>
      </div>
    </header>
  );
};
