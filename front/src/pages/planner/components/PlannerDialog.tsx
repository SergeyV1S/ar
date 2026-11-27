import { Button, Icon } from "../../../shared/components/index.ts";
import { decimal } from "../../../shared/helpers/index.ts";
import { usePlannerContext } from "../hooks/index.ts";
import type { PlannerModal } from "../types/index.ts";
import { ARHelp } from "./ARHelp.tsx";
import { Catalog } from "./Catalog.tsx";
import { CheckReport } from "./CheckReport.tsx";
import { Dialog } from "./Dialog.tsx";
import { EstimateContent } from "./EstimateContent.tsx";
import { ExportOptions } from "./ExportOptions.tsx";
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
  item: ["Редактировать мебель", "pencil"],
  catalog: ["Каталог мебели", "grid"],
  estimate: ["Смета закупки", "receipt"],
  export: ["Экспорт проекта", "download"],
  procurement: ["Служебная закупка", "receipt"],
  checks: ["Проверка плана", "checkCircle"],
  projects: ["Проект на устройстве", "folder"],
  privacy: ["Хранение и защита проекта", "shield"],
  "ar-scan": ["AR-обмер комнаты", "scan"],
  "ar-view": ["Просмотр мебели в AR", "cube"],
  "new-project": ["Новый проект", "folder"]
} as const satisfies Record<PlannerModal["name"], readonly [string, string]>;
export const PlannerDialog = () => {
  const {
    project,
    modal,
    action,
    close,
    saveRoom,
    acceptVoice,
    storeItem,
    removeItem,
    bought,
    positions,
    addCatalogItem,
    inspection,
    exportData,
    saveProcurement,
    isProtected,
    protect,
    lock,
    privacyError,
    arSupport,
    arError,
    createProject,
    openProcurement,
    openExport,
    openProjects,
    openNewProject,
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
        return <Outline project={project} save={saveRoom} close={close} />;
      case "voice":
        return <Voice project={project} apply={acceptVoice} />;
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
      case "catalog":
        return (
          <Catalog
            project={project}
            items={bought}
            positions={positions}
            add={addCatalogItem}
            action={action}
          />
        );
      case "estimate":
        return (
          <>
            <EstimateContent
              project={project}
              items={bought}
              inspection={inspection}
              positions={positions}
            />
            <div className='form-actions'>
              {project.mode === "office" && (
                <Button icon='pencil' onClick={openProcurement}>
                  Поля закупки
                </Button>
              )}
              <Button icon='download' className='primary' onClick={openExport}>
                Экспорт
              </Button>
            </div>
          </>
        );
      case "export":
        return <ExportOptions project={project} action={action} run={exportData} />;
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
              Импорт JSON заменит открытый проект. Сохраните копию через «Экспорт», если она
              понадобится.
            </p>
            <div className='form-actions'>
              <Button icon='plus' className='mr-auto' onClick={openNewProject}>
                Новый проект
              </Button>
              <Button icon='download' onClick={exportCopy}>
                Сохранить копию
              </Button>
              <Button icon='upload' className='primary' onClick={chooseImportFile}>
                Импорт проекта
              </Button>
            </div>
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
                Сохранить копию
              </Button>
              <Button onClick={openProjects}>Отмена</Button>
              <Button icon='plus' className='primary' onClick={createProject}>
                Создать проект
              </Button>
            </div>
          </>
        );
      default:
        return null;
    }
  };
  const activeDialog = dialogTitles[modal.name];
  return (
    <Dialog
      key={`${modal.name}-${modal.id ?? ""}`}
      title={activeDialog[0]}
      icon={activeDialog[1]}
      close={close}
      wide={["room", "catalog", "estimate", "outline"].includes(modal.name)}
    >
      {showContent()}
    </Dialog>
  );
};
