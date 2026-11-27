import { Button, Field, Icon, IconButton, Select } from "../../../shared/components/index.ts";
import { decimal } from "../../../shared/helpers/index.ts";
import { itemSize, materials, modes } from "../data/index.ts";
import { useSettings } from "../hooks/index.ts";
import { PanelTitle } from "./PanelTitle.tsx";

export const Settings = () => {
  const {
    project,
    w,
    d,
    ownedRows,
    budgetValue,
    roomArea,
    editRoom,
    scanRoom,
    dictate,
    changeBudget,
    formatBudget,
    changeMaterial,
    changeMode,
    openProcurement,
    addOwned
  } = useSettings();
  return (
    <aside className='panel settings' aria-label='Настройки'>
      <PanelTitle icon='sliders' title='Настройки' />
      <section className='settings-section room-section'>
        <div className='row-title'>
          <h3>Комната</h3>
          <IconButton
            icon='pencil'
            className='small'
            label='Редактировать комнату'
            onClick={editRoom}
          />
        </div>
        <button className='room-summary' onClick={editRoom}>
          <span className='room-icon'>
            <Icon name='ruler' size={20} />
          </span>
          <span>
            <strong>{project.room.name}</strong>
            <small>
              {decimal(w, 2)} × {decimal(d, 2)} м · {decimal(roomArea)} м²
            </small>
          </span>
        </button>
        <div className='capture-buttons'>
          <Button icon='scan' className='ar-soft' onClick={scanRoom}>
            AR-обмер
          </Button>
          <Button
            icon='mic'
            className='square'
            title='Голосовой ввод'
            aria-label='Голосовой ввод'
            onClick={dictate}
          />
        </div>
      </section>
      <section className='settings-section'>
        <h3>Условия закупки</h3>
        <Field label='Общий бюджет' className='settings-field'>
          <span className='input-unit'>
            <input
              type='text'
              inputMode='numeric'
              value={budgetValue}
              onChange={changeBudget}
              onBlur={formatBudget}
              aria-label='Общий бюджет'
            />
            <span>₽</span>
          </span>
        </Field>
        <Field label='Материал' className='settings-field'>
          <Select value={project.material} onChange={changeMaterial}>
            {materials.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field label='Способ покупки' className='settings-field'>
          <Select value={project.mode} onChange={changeMode}>
            {Object.entries(modes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {project.mode === "office" && (
          <button className='text-btn mt-2.5' onClick={openProcurement}>
            <Icon name='receipt' />
            Поля закупки
          </button>
        )}
      </section>
      <section className='settings-section inventory-section'>
        <div className='row-title'>
          <h3>
            Моя мебель <span className='count'>{ownedRows.length}</span>
          </h3>
          <IconButton
            className='small add-icon'
            icon='plus'
            label='Добавить свою мебель'
            onClick={addOwned}
          />
        </div>
        <div className='owned-list'>
          {ownedRows.length ? (
            ownedRows.map(({ item, editItem }) => (
              <button className='owned-item' key={item.id} onClick={editItem}>
                <span className={`owned-icon ${item.kind}`}>
                  <Icon name={item.kind ?? "other"} size={19} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{itemSize(item)}</small>
                </span>
                <Icon className='ml-auto mr-0.75 text-[#8f829d]' name='more' size={16} />
              </button>
            ))
          ) : (
            <p className='text-[12.5px] text-muted py-2.25 px-0 font-[650]'>
              Добавьте мебель с её размерами.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
};
