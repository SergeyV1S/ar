import { Button, Icon } from "../../../shared/components/index.ts";
import { decimal } from "../../../shared/helpers/index.ts";
import { usePlannerContext } from "../hooks/index.ts";
import type { PlannerModal } from "../types/index.ts";
import { ARHelp } from "./ARHelp.tsx";
import { CatalogSearchForm } from "./CatalogSearchForm.tsx";
import { CheckReport } from "./CheckReport.tsx";
import { Dialog } from "./Dialog.tsx";
import { ItemEditor } from "./ItemEditor.tsx";
import { Outline } from "./Outline.tsx";
import { Privacy } from "./Privacy.tsx";
import { Procurement } from "./Procurement.tsx";
import { RoomEditor } from "./RoomEditor.tsx";
import { Voice } from "./Voice.tsx";

const dialogTitles = {
  room: ["Комната", "ruler"],
  outline: ["Контур комнаты", "scan"],
  voice: ["Голосовой ввод", "mic"],
  "add-owned": ["Добавить свою мебель", "plus"],
  "add-buy": ["Добавить к покупке", "bag"],
  "catalog-search": ["Подбор на Divan.ru", "spark"],
  item: ["Редактировать мебель", "pencil"],
  procurement: ["Служебная закупка", "receipt"],
  checks: ["Проверка плана", "checkCircle"],
  projects: ["Проект на устройстве", "folder"],
  privacy: ["Хранение и защита проекта", "shield"],
  "ar-scan": ["AR-обмер комнаты", "scan"],
  "ar-view": ["Просмотр мебели в AR", "cube"],
  "new-project": ["Новый проект", "folder"],
  "replan-confirm": ["Подобрать варианты заново", "spark"]
} as const satisfies Record<PlannerModal["name"], readonly [string, string]>;
export const PlannerDialog = () => {
  const {
    project,
    modal,
    action,
    close,
    saveRoom,
    saveOutline,
    acceptVoice,
    storeItem,
    catalogDraft,
    confirmCatalogSearch,
    removeItem,
    inspection,
    saveProcurement,
    isProtected,
    protect,
    lock,
    privacyError,
    arSupport,
    arError,
    createProject,
    openProjects,
    openPrivacy,
    openNewProject,
    replan,
    backFromARHelp,
    launchSelectedAR,
    dialogItem,
    roomArea,
    chooseImportFile,
    exportCopy
  } = usePlannerContext();
  if (!modal) return null;
  const showContent = () => {
    switch (modal.name) {
      case "room":
        return <RoomEditor project={project} save={saveRoom} action={action} close={close} />;
      case "outline":
        return <Outline project={project} save={saveOutline} close={close} />;
      case "voice":
        return <Voice project={project} apply={acceptVoice} />;
      case "catalog-search":
        return <CatalogSearchForm initial={catalogDraft} projectMaterial={project.material} start={confirmCatalogSearch} />;
      case "add-owned":
      case "add-buy":
      case "item":
        return (
          <ItemEditor
            item={dialogItem}
            owned={dialogItem?.owned ?? modal.name === "add-owned"}
            project={project}
            save={storeItem}
            remove={removeItem}
            close={close}
          />
        );
      case "procurement":
        return <Procurement project={project} save={saveProcurement} close={close} />;
      case "checks":
        return <CheckReport project={project} inspection={inspection} action={action} />;
      case "privacy":
        return (
          <Privacy isProtected={isProtected} protect={protect} lock={lock} error={privacyError} />
        );
      case "ar-scan":
      case "ar-view": {
        const mode = modal.name === "ar-scan" ? "scan" : "view";
        return (
          <ARHelp
            mode={mode}
            support={arSupport}
            error={arError}
            back={backFromARHelp}
            launch={launchSelectedAR}
          />
        );
      }
      case "projects":
        return (
          <>
            <div className='notice'>
              <Icon name='folder' />
              {project.room.name} · {decimal(roomArea)} м² · {project.items.length} поз.
            </div>
            <p className='support-text'>
              Импорт JSON заменит открытый проект. Его можно заранее скачать как копию.
            </p>
            <div className='form-actions'>
              <Button icon='plus' className='mr-auto' onClick={openNewProject}>
                Новый проект
              </Button>
              <Button icon='download' onClick={exportCopy}>
                Скачать копию JSON
              </Button>
              <Button icon='upload' className='primary' onClick={chooseImportFile}>
                Импорт проекта
              </Button>
            </div>
            <Button icon='shield' onClick={openPrivacy}>
              Хранение и защита проекта
            </Button>
          </>
        );
      case "new-project":
        return (
          <>
            <p className='support-text'>
              Новый проект откроется поверх текущего. Сохраните JSON, чтобы позже вернуться к этому
              плану.
            </p>
            <div className='form-actions'>
              <Button icon='download' className='mr-auto' onClick={exportCopy}>
                Скачать копию JSON
              </Button>
              <Button onClick={openProjects}>Отмена</Button>
              <Button icon='plus' className='primary' onClick={createProject}>
                Создать проект
              </Button>
            </div>
          </>
        );
      case "replan-confirm":
        return (
          <>
            <p className='support-text'>
              Новый подбор заменит сохранённые положения мебели в текущем способе покупки.
            </p>
            <div className='form-actions'>
              <Button onClick={close}>Отмена</Button>
              <Button className='primary' onClick={replan}>
                Подобрать варианты
              </Button>
            </div>
          </>
        );
    }
  };
  const activeDialog = dialogTitles[modal.name];
  return (
    <Dialog
      key={`${modal.name}-${modal.id ?? ""}`}
      title={activeDialog[0]}
      icon={activeDialog[1]}
      close={close}
      wide={["room", "outline"].includes(modal.name)}
      fullScreenOnMobile={["room", "outline", "add-owned", "add-buy", "item"].includes(modal.name)}
    >
      {showContent()}
    </Dialog>
  );
};
