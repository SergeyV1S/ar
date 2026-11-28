import { Link } from "react-router";

import { Button, Icon, IconButton } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";

import { PLANNER_STEP, getItemPath } from "../helpers/index.ts";
import { usePlannerContext } from "../hooks/index.ts";
import type { usePlanner, usePlannerSteps } from "../hooks/index.ts";
import { itemSize } from "../mock/index.ts";
import { AngleInput } from "./AngleInput.tsx";
import { RoomEditor } from "./RoomEditor.tsx";

type PlannerModel = ReturnType<typeof usePlanner>;
type PlanSidebarProps = { planner: PlannerModel; workflow: ReturnType<typeof usePlannerSteps> };

export const PlanSidebar = ({ planner, workflow }: PlanSidebarProps) => {
  const { action, saveRoom, close, toast } = usePlannerContext();
  const { project, current, itemChoices, positions, addOwned, variantOptions, replan, openChecks } =
    planner;
  const { step, heading, onRoomSaved, goToRoom, goToLayout } = workflow;

  return (
    <section
      className='panel planner-step-panel'
      id='planner-step-panel'
      aria-labelledby='planner-step-title'
    >
      {step === PLANNER_STEP.room && (
        <>
          <h2 id='planner-step-title' ref={heading} tabIndex={-1}>
            Размеры комнаты
          </h2>
          <p className='planner-step-intro'>Сохраните размеры, чтобы обновить план.</p>
          <RoomEditor
            key={JSON.stringify([project.room, project.passage])}
            project={project}
            action={action}
            save={saveRoom}
            close={close}
            guided={{ onSaved: onRoomSaved }}
          />
        </>
      )}
      {step === PLANNER_STEP.furniture && (
        <>
          <h2 id='planner-step-title' ref={heading} tabIndex={-1}>
            Мебель на плане
          </h2>
          <p className='planner-step-intro'>Добавьте свою мебель или подберите новую в каталоге.</p>
          <div className='editor-links'>
            <Button icon='plus' onClick={addOwned}>
              Добавить свою мебель
            </Button>
            <Link className='btn' to={getItemPath(PATHS.catalog, current?.id ?? null)}>
              <Icon name='grid' />
              Открыть каталог
            </Link>
          </div>
          {itemChoices.length > 0 ? (
            <ul className='planner-furniture-list' aria-label='Предметы в проекте'>
              {itemChoices.map(({ item, select }) => (
                <li key={item.id}>
                  <button
                    className='plan-item'
                    type='button'
                    aria-pressed={item.id === current?.id}
                    onClick={select}
                  >
                    <span className='min-w-0'>
                      <strong>{item.name}</strong>
                      <small>{positions[item.id] ? itemSize(item) : "Не размещён"}</small>
                    </span>
                    <small>{item.owned ? "Своя" : "К покупке"}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className='planner-step-intro'>Добавленные предметы появятся здесь и на плане.</p>
          )}
          <div className='editor-links planner-step-actions'>
            <Button onClick={goToRoom}>Назад к комнате</Button>
            <Button className='primary' onClick={goToLayout}>
              К расстановке
            </Button>
          </div>
        </>
      )}
      {step === PLANNER_STEP.layout && (
        <>
          <h2 id='planner-step-title' ref={heading} tabIndex={-1}>
            Варианты расстановки
          </h2>
          <p className='planner-step-intro'>
            Сравните варианты и проверьте проход от двери к центру комнаты.
          </p>
          <div className='variant-list' role='group' aria-label='Выбор расстановки'>
            {variantOptions.map(({ title, note, style, index, chooseVariant }) => (
              <button
                key={style}
                type='button'
                className={project.variant === index ? "variant selected" : "variant"}
                aria-pressed={project.variant === index}
                onClick={chooseVariant}
              >
                <span aria-hidden='true' className={`mini-plan ${style}`}>
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </span>
              </button>
            ))}
          </div>
          <div className='editor-links planner-step-actions'>
            <Button icon='checkCircle' onClick={openChecks}>
              Проверить план
            </Button>
            <Link className='btn primary' to={PATHS.estimate}>
              <Icon name='receipt' />
              Открыть смету
            </Link>
          </div>
          <Button icon='spark' onClick={replan}>
            Подобрать варианты заново
          </Button>
        </>
      )}
      <p className='planner-feedback' role='status'>
        {toast}
      </p>
    </section>
  );
};

export const PlanSelection = ({
  current,
  positions,
  movementControls,
  editItem,
  rotateItem,
  changeItemAngle,
  clearSelection
}: Pick<
  PlannerModel,
  | "current"
  | "positions"
  | "movementControls"
  | "editItem"
  | "rotateItem"
  | "changeItemAngle"
  | "clearSelection"
>) => {
  if (!current) return null;

  const position = positions[current.id];
  return (
    <section className='planner-selection' aria-labelledby='planner-selection-title'>
      <div className='row-title'>
        <div className='min-w-0'>
          <h3 id='planner-selection-title'>{current.name}</h3>
          <p>
            {itemSize(current)} · {current.owned ? "Своя мебель" : "К покупке"}
          </p>
        </div>
        <IconButton icon='close' label='Снять выделение' onClick={clearSelection} />
      </div>
      <div className='editor-links'>
        <Button icon='pencil' onClick={editItem}>
          Редактировать
        </Button>
        {position && (
          <Button icon='rotate' onClick={rotateItem}>
            Повернуть на 90°
          </Button>
        )}
        <Link className='btn' to={getItemPath(PATHS.catalog, current.id)}>
          Подобрать замену
        </Link>
      </div>
      {position && <AngleInput value={position.r} onChange={changeItemAngle} />}
      {position && (
        <div className='move-tools' role='group' aria-label='Переместить предмет на 3 сантиметра'>
          <span>Переместить на 3 см</span>
          {movementControls.map(({ key, label, symbol, nudge }) => (
            <Button key={key} aria-label={label} onClick={nudge}>
              {symbol}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
};
