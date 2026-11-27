import { Icon } from "../../shared/components/index.ts";
import { decimal } from "../../shared/helpers/index.ts";
import {
  EstimateContent,
  Header,
  Locked,
  Planner,
  PlannerDialog,
  ProjectHeader,
  Settings,
  Shopping,
  XRControls
} from "./components/index.ts";
import { checkLabel, modes, sourceLabel } from "./data/index.ts";
import { usePlannerContext } from "./hooks/index.ts";
import { variants } from "./planning/index.ts";

export const PlannerPage = () => {
  const {
    project,
    locked,
    action,
    status,
    positions,
    inspection,
    bought,
    isProtected,
    fileInput,
    importProject,
    toast,
    xrMode,
    xrState,
    overlay,
    controlAR,
    printImage,
    unlock,
    privacyError,
    unlocking,
    roomArea
  } = usePlannerContext();
  if (locked) return <Locked unlock={unlock} error={privacyError} busy={unlocking} />;
  return (
    <>
      <Header action={action} status={status} />
      <main className='shell'>
        <ProjectHeader room={project.room} action={action} />
        <div className='workgrid'>
          <Settings />
          <Planner />
          <Shopping />
        </div>
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
      <PlannerDialog />
      <input
        type='file'
        ref={fileInput}
        accept='.json,application/json'
        onChange={importProject}
        hidden
      />
      {toast && (
        <div role='status' className='toast'>
          <Icon name='info' />
          {toast}
        </div>
      )}
      <XRControls mode={xrMode} state={xrState} overlayRef={overlay} control={controlAR} />
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
