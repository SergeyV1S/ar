import { Link } from "react-router";

import { Button, Icon, IconButton } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";

import { PLANNER_STEP, getItemPath, getWishPath, getWishPurchases } from "../helpers/index.ts";
import { usePlannerContext } from "../hooks/index.ts";
import type { usePlanner, usePlannerSteps } from "../hooks/index.ts";
import { itemSize } from "../mock/index.ts";
import { AngleInput } from "./AngleInput.tsx";
import { LayoutThumbnail } from "./LayoutThumbnail.tsx";
import { RoomEditor } from "./RoomEditor.tsx";

type PlannerModel = ReturnType<typeof usePlanner>;
type PlanSidebarProps = { planner: PlannerModel; workflow: ReturnType<typeof usePlannerSteps> };

export const PlanSidebar = ({ planner, workflow }: PlanSidebarProps) => {
  const { action, saveRoom, close, toast } = usePlannerContext();
  const { project, current, itemChoices, positions, addOwned, variantOptions, replan, openChecks } =
    planner;
  const { step, heading, onRoomSaved, goToRoom, goToFurniture, goToWishes, goToLayout } = workflow;
  const { openWishes, items, proposingLayouts } = planner;

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
          <p className='planner-step-intro'>Добавьте имеющуюся мебель и перетащите её на нужное место на плане.</p>
          <div className='editor-links'>
            <Button icon='plus' onClick={addOwned}>
              Добавить свою мебель
            </Button>
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
            <Button className='primary' onClick={goToWishes}>
              К подбору мебели
            </Button>
          </div>
        </>
      )}
      {step === PLANNER_STEP.wishes && (
        <>
          <h2 id='planner-step-title' ref={heading} tabIndex={-1}>Подбор мебели</h2>
          <p className='planner-step-intro'>
            Опишите голосом или текстом, какую мебель добавить, заменить или переставить.
          </p>
          <div className='editor-links'>
            <Button icon='mic' className='primary' onClick={openWishes}>
              {project.brief ? "Изменить пожелания" : "Ввести пожелания"}
            </Button>
            <Link className='btn' to={PATHS.catalog}>
              <Icon name='grid' /> Каталог
            </Link>
          </div>
          {project.brief && (
            <>
              <p className='support-text'>{project.brief.summary}</p>
              <ul className='planner-furniture-list' aria-label='Список покупок'>
                {project.brief.wishes.map((wish) => (
                  <li key={wish.id}>
                    <Link className='plan-item' to={getWishPath(PATHS.catalog, wish.id)}>
                      <span className='min-w-0'>
                        <strong>{wish.name}</strong>
                        <small>{wish.material ? `${wish.material} · ` : ""}{wish.quantity} шт.</small>
                      </span>
                      <small>{`Выбрано ${getWishPurchases(project, wish).length} из ${wish.quantity}`}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className='editor-links planner-step-actions'>
            <Button onClick={goToFurniture}>К своей мебели</Button>
            <Button className='primary' onClick={goToLayout}>К расстановке</Button>
          </div>
        </>
      )}
      {step === PLANNER_STEP.layout && (
        <>
          <h2 id='planner-step-title' ref={heading} tabIndex={-1}>
            Варианты расстановки
          </h2>
          <p className='planner-step-intro'>
            Подберите расстановки по размерам комнаты, мебели и пожеланиям.
          </p>
          <Button icon='spark' onClick={replan} disabled={proposingLayouts || !items.length}>
            {proposingLayouts ? "Подбираем расстановки…" : "Подобрать расстановки с ИИ"}
          </Button>
          <div className='variant-list' role='group' aria-label='Выбор расстановки'>
            {variantOptions.map(({ title, note, index, chooseVariant, check }) => (
              <button
                key={index}
                type='button'
                className={project.variant === index ? "variant selected" : "variant"}
                aria-pressed={project.variant === index}
                onClick={chooseVariant}
              >
                <LayoutThumbnail room={project.room} items={items} positions={check.layout} />
                <span>
                  <strong>{title}</strong>
                  {note && <small>{note}</small>}
                  {check && check.unplaced > 0 && <small>Без места: {check.unplaced}</small>}
                  {check && check.warnings > 0 && <small>Замечаний: {check.warnings}</small>}
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
      {!position && <p role='status'>Коснитесь нужного места на 2D-плане, чтобы разместить предмет.</p>}
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
