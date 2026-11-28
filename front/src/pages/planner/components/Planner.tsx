import { Button, Icon, IconButton } from "@/shared/components/index.ts";
import { decimal } from "@/shared/helpers/index.ts";

import { PLANNER_STEP, ROOM_FORM_ID } from "../helpers/index.ts";
import { usePlanner, usePlannerSteps } from "../hooks/index.ts";
import { PlanSelection, PlanSidebar } from "./PlanSidebar.tsx";

export const Planner = () => {
  const workflow = usePlannerSteps();
  const planner = usePlanner(workflow.step === PLANNER_STEP.layout);
  const {
    canvas,
    scaleLabel,
    view,
    start,
    track,
    stop,
    handleCanvasKey,
    planStatus,
    viewOptions,
    roomArea,
    roomSize,
    openAR,
    zoomIn,
    zoomOut,
    resetZoom,
    openChecks,
    itemChoices,
    addOwned
  } = planner;

  return (
    <>
      <nav className='planner-steps' aria-label='Шаги планирования'>
        {workflow.stepOptions.map(({ id, title, number, selectStep, submitRoom }) => (
          <button
            key={id}
            className='planner-step'
            type={submitRoom ? "submit" : "button"}
            form={submitRoom ? ROOM_FORM_ID : undefined}
            value={id}
            aria-controls='planner-step-panel'
            aria-current={workflow.step === id ? "step" : undefined}
            onClick={submitRoom ? undefined : selectStep}
          >
            <span aria-hidden='true'>{number}</span>
            {title}
          </button>
        ))}
      </nav>
      <div className='workgrid'>
        <PlanSidebar planner={planner} workflow={workflow} />
        {planner.project.room.source === "draft" && (
          <section className='panel editor-panel plan-draft' aria-labelledby='empty-plan-title'>
            <h2 id='empty-plan-title'>План комнаты</h2>
            <p className='support-text'>План появится после обмера или ввода размеров.</p>
          </section>
        )}
        {planner.project.room.source !== "draft" && <section className='panel planner' aria-labelledby='room-plan-title'>
          <div className='planner-heading'>
            <div>
              <h2 id='room-plan-title'>План комнаты</h2>
              <p>
                {decimal(roomSize.w, 2)} × {decimal(roomSize.d, 2)} м · {decimal(roomArea, 2)} м²
              </p>
            </div>
            <div className='view-controls'>
              <div className='segmented' role='group' aria-label='Режим плана'>
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
              <Button
                icon='cube'
                className='ar-view'
                aria-label='Смотреть в AR'
                title='Смотреть в AR'
                onClick={openAR}
              >
                <span>Смотреть в AR</span>
              </Button>
            </div>
          </div>
          <div className='planner-toolbar'>
            <span className='board-label'>
              <Icon name='layers' size={15} />
              {view === "2d" ? "Вид сверху" : "Объёмный вид"}
            </span>
            <div className='canvas-actions' role='group' aria-label='Масштаб плана'>
              <IconButton icon='minus' label='Уменьшить' onClick={zoomOut} />
              <IconButton icon='plus' label='Увеличить' onClick={zoomIn} />
              <IconButton icon='expand' label='Вписать план' onClick={resetZoom} />
            </div>
          </div>
          <div className='board'>
            <canvas
              ref={canvas}
              className='plan-canvas'
              tabIndex={0}
              aria-label='Интерактивный план комнаты. Выберите предмет на плане или в списке. В режиме 2D стрелки перемещают выбранный предмет.'
              onPointerDown={start}
              onPointerMove={track}
              onPointerUp={stop}
              onPointerCancel={stop}
              onKeyDown={handleCanvasKey}
            />
            {view === "2d" && (
              <div className='scale-label' aria-hidden='true'>
                <i />
                <span ref={scaleLabel} />
              </div>
            )}
          </div>
          <div className='plan-footer'>
            <div className='legend' aria-label='Обозначения на плане'>
              <span>
                <i className='legend-owned' />
                Своя мебель
              </span>
              <span>
                <i className='legend-purchase' />К покупке
              </span>
              {view === "2d" && (
                <span>
                  <i className='legend-passage' />
                  Проход
                </span>
              )}
            </div>
            <button className={`plan-status ${planStatus.className}`} onClick={openChecks}>
              <Icon name={planStatus.icon} size={15} />
              {planStatus.label}
            </button>
          </div>
          <PlanSelection {...planner} />
          {itemChoices.length === 0 && (
            <div className='empty-plan notice'>
              <p>На плане пока нет мебели.</p>
              <Button onClick={addOwned}>Добавить мебель</Button>
            </div>
          )}
        </section>}
      </div>
    </>
  );
};
