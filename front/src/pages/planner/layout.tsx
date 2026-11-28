import { NavLink, Outlet, ScrollRestoration } from "react-router";

import { EstimateContent } from "@/pages/estimate/components/index.ts";
import { Icon } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";
import { decimal } from "@/shared/helpers/index.ts";

import { Header, Locked, PlannerDialog, Privacy, XRControls } from "./components/index.ts";
import { getItemPath } from "./helpers/index.ts";
import { usePlannerContext, usePlannerLayout } from "./hooks/index.ts";
import { checkLabel, modes, sourceLabel } from "./mock/index.ts";
import { variants } from "./planning/index.ts";

export const PlannerLayout = () => {
  const { content, isPlannerPage } = usePlannerLayout();
  const {
    project,
    locked,
    status,
    selected,
    positions,
    inspection,
    bought,
    isProtected,
    fileInput,
    importProject,
    toast,
    xrMode,
    xrState,
    xrItems,
    overlay,
    controlAR,
    printImage,
    unlock,
    protect,
    lock,
    pendingProtection,
    canCancelProtection,
    cancelPending,
    privacyError,
    unlocking,
    roomArea
  } = usePlannerContext();
  if (locked)
    return (
      <Locked
        unlock={unlock}
        error={privacyError}
        busy={unlocking}
        cancel={canCancelProtection ? cancelPending : undefined}
      />
    );
  if (pendingProtection)
    return (
      <main className='w-[min(420px,_calc(100%_-_32px))] my-16.25 mx-auto panel locked-card'>
        <h1>Задайте пароль служебного проекта</h1>
        <Privacy isProtected={false} protect={protect} lock={lock} error={privacyError} />
        {canCancelProtection && (
          <button className='btn' onClick={cancelPending}>
            Отмена
          </button>
        )}
      </main>
    );
  return (
    <>
      <a className='skip-link' href='#main-content'>
        К содержанию
      </a>
      <Header />
      <main className='shell' id='main-content' ref={content} tabIndex={-1}>
        <div role='status'>
          {status.includes("ошибка") && <p className='form-error'>{status}</p>}
        </div>
        <Outlet />
        <footer className='footer'>
          <span>
            метрика<span className='text-purple'>.</span>
          </span>
          <span>
            <Icon name='shield' size={15} />
            {isProtected
              ? "Проект зашифрован на этом устройстве"
              : "Проект хранится на этом устройстве"}
          </span>
        </footer>
      </main>
      <nav className='nav' aria-label='Основное меню' hidden={Boolean(xrMode)}>
        <div className='nav-inner'>
          <NavLink end to={getItemPath(PATHS.planner, selected)} className='nav-link'>
            <Icon name='layout' size={22} />
            План
          </NavLink>
          <NavLink to={PATHS.catalog} className='nav-link'>
            <Icon name='grid' size={22} />
            Каталог
          </NavLink>
          <NavLink to={PATHS.estimate} className='nav-link'>
            <Icon name='receipt' size={22} />
            Смета
          </NavLink>
        </div>
      </nav>
      <ScrollRestoration />
      <PlannerDialog />
      <input
        type='file'
        ref={fileInput}
        accept='.json,application/json'
        onChange={importProject}
        hidden
      />
      {toast && !isPlannerPage && (
        <div role='status' className='toast'>
          <Icon name='info' />
          {toast}
        </div>
      )}
      <XRControls mode={xrMode} state={xrState} items={xrItems} overlayRef={overlay} control={controlAR} />
      {printImage && (
        <section id='print-view' aria-hidden='true'>
          <h1>{project.room.name} — план и смета</h1>
          <p>
            {variants[project.variant].title} · {decimal(roomArea)} м² · {modes[project.mode]} ·{" "}
            {sourceLabel[project.room.source]} / {checkLabel[project.room.verified]}
          </p>
          <img src={printImage} alt='План расстановки мебели' />
          <EstimateContent
            project={project}
            items={bought}
            inspection={inspection}
            positions={positions}
            print
          />
        </section>
      )}
    </>
  );
};
