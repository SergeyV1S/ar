import { Link } from "react-router";

import { Button, IconButton } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";

import { getItemPath } from "../helpers/index.ts";
import type { usePlanner } from "../hooks/index.ts";
import { checkLabel, itemSize, sourceLabel } from "../mock/index.ts";

type PlanSidebarProps = Pick<
  ReturnType<typeof usePlanner>,
  | "project"
  | "positions"
  | "current"
  | "itemChoices"
  | "movementControls"
  | "editRoom"
  | "scanRoom"
  | "dictate"
  | "addOwned"
  | "openChecks"
  | "editItem"
  | "rotateItem"
  | "clearSelection"
>;

export const PlanSidebar = ({
  project,
  positions,
  current,
  itemChoices,
  movementControls,
  editRoom,
  scanRoom,
  dictate,
  addOwned,
  openChecks,
  editItem,
  rotateItem,
  clearSelection
}: PlanSidebarProps) => (
  <aside className='panel plan-side' aria-label='Инструменты плана'>
    {current && (
      <section className='settings-section selected-details'>
        <div className='row-title'>
          <h2>{current.name}</h2>
          <IconButton icon='close' label='Снять выделение' onClick={clearSelection} />
        </div>
        <p>
          {itemSize(current)} · {current.owned ? "Своя мебель" : "К покупке"}
        </p>
        <div className='inline-actions'>
          <Button icon='pencil' onClick={editItem}>
            Редактировать
          </Button>
          {positions[current.id] && (
            <Button icon='rotate' onClick={rotateItem}>
              Повернуть на 90°
            </Button>
          )}
        </div>
        {positions[current.id] && (
          <div className='move-tools' role='group' aria-label='Переместить предмет на 3 см'>
            <span>Переместить на 3 см</span>
            {movementControls.map(({ key, label, symbol, nudge }) => (
              <Button key={key} aria-label={label} onClick={nudge}>
                {symbol}
              </Button>
            ))}
          </div>
        )}
        <Link className='btn mt-3' to={getItemPath(PATHS.catalog, current.id)}>
          Открыть каталог для предмета
        </Link>
      </section>
    )}
    <section className='settings-section room-tools'>
      <h2>Комната</h2>
      <p>
        {sourceLabel[project.room.source]} · {checkLabel[project.room.verified]}
      </p>
      <div className='inline-actions'>
        <Button icon='ruler' onClick={editRoom}>
          Задать размеры комнаты
        </Button>
        <Button icon='scan' onClick={scanRoom}>
          AR-обмер
        </Button>
        <Button icon='mic' onClick={dictate}>
          Голосовой ввод
        </Button>
      </div>
    </section>
    <section className='settings-section'>
      <h2>Своя мебель</h2>
      <Button className='mt-2' icon='plus' onClick={addOwned}>
        Добавить свою мебель
      </Button>
      {itemChoices.length > 0 && (
        <details className='furniture-list'>
          <summary>Выбрать предмет на плане</summary>
          <ul>
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
        </details>
      )}
    </section>
    <section className='settings-section'>
      <Button icon='checkCircle' onClick={openChecks}>
        Проверка плана
      </Button>
    </section>
  </aside>
);
