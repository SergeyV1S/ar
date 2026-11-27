import { Button, Icon, IconButton } from "../../../shared/components/index.ts";
import { decimal } from "../../../shared/helpers/index.ts";
import { usePlanner } from "../hooks/index.ts";

const MiniPlan = ({ style }: { style: string }) => {
  return (
    <span aria-hidden='true' className={`mini-plan ${style}`}>
      <i />
      <i />
      <i />
    </span>
  );
};

export const Planner = () => {
  const {
    project,
    positions,
    canvas,
    view,
    start,
    track,
    stop,
    key,
    current,
    planStatus,
    viewOptions,
    variantOptions,
    roomArea,
    openAR,
    zoomIn,
    zoomOut,
    resetZoom,
    editItem,
    rotateItem,
    clearSelection,
    openChecks
  } = usePlanner();
  return (
    <section className='panel planner' aria-label='План комнаты'>
      <div className='planner-heading'>
        <div>
          <h2>План комнаты</h2>
          <p>
            {project.room.name} <b>·</b> {decimal(roomArea)} м²
          </p>
        </div>
        <div className='view-controls'>
          <div className='segmented' aria-label='Режим плана'>
            {viewOptions.map(({ mode, changeView }) => (
              <button
                key={mode}
                className={view === mode ? "selected" : ""}
                aria-pressed={view === mode}
                onClick={changeView}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
          <Button icon='cube' className='ar-view' onClick={openAR}>
            Смотреть в AR
          </Button>
        </div>
      </div>
      <div className='board'>
        <div className='board-label'>
          <Icon name='layers' size={14} />
          {view === "2d" ? "Вид сверху" : "Объёмный вид"}
        </div>
        <canvas
          ref={canvas}
          className='plan-canvas'
          tabIndex={0}
          aria-label='Интерактивный план комнаты. Выберите мебель на плане, затем используйте стрелки для перемещения.'
          onPointerDown={start}
          onPointerMove={track}
          onPointerUp={stop}
          onPointerCancel={stop}
          onKeyDown={key}
        />
        <div className='canvas-actions'>
          <IconButton icon='plus' label='Увеличить' onClick={zoomIn} />
          <IconButton icon='minus' label='Уменьшить' onClick={zoomOut} />
          <IconButton className='fit' icon='expand' label='Вписать план' onClick={resetZoom} />
        </div>
        {current && positions[current.id] && (
          <div className='selected-bar'>
            <button className='selected-item-name' onClick={editItem}>
              {current.name}
            </button>
            <IconButton icon='rotate' label='Повернуть на 90 градусов' onClick={rotateItem} />
            <IconButton icon='close' label='Снять выделение' onClick={clearSelection} />
          </div>
        )}
        {view === "2d" && (
          <div className='scale-label'>
            <i />
            <span>1 м</span>
          </div>
        )}
      </div>
      <div className='plan-footer'>
        <div className='legend'>
          <span>
            <i className='bg-[#baab9a]' />
            Есть у вас
          </span>
          <span>
            <i className='bg-[#b399dd]' />К покупке
          </span>
          <span>
            <i className='bg-[#9ac5a9]' />
            Проход
          </span>
        </div>
        <button className={`plan-status ${planStatus.className}`} onClick={openChecks}>
          <Icon name={planStatus.icon} size={15} />
          {planStatus.label}
        </button>
      </div>
      <div className='variants'>
        <div className='row-title'>
          <h3>Варианты расстановки</h3>
          <span className='secondary'>3 варианта</span>
        </div>
        <div className='variant-list'>
          {variantOptions.map(({ title, note, style, index, chooseVariant }) => (
            <button
              key={style}
              className={`variant ${project.variant === index ? "selected" : ""}`}
              aria-pressed={project.variant === index}
              onClick={chooseVariant}
            >
              <MiniPlan style={style} />
              <span>
                <strong>{title}</strong>
                <small>{note}</small>
              </span>
              {project.variant === index && (
                <Icon className='variant-check' name='check' size={14} />
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
