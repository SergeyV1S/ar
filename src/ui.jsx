import React, { useLayoutEffect, useRef, useState } from "react";

import { decimal, itemSize, materials, modes, money, purchaseIssues, sourceLabel } from "./data.js";
import { area, dimensions, pointIn, round, variants } from "./geometry.js";
import { drawPlan } from "./plan.js";

const icons = {
  brand: "M4 16V5h10M9 16v-6h8v6m3-7v7h-3M4 20h8M20 5h.01",
  layout: "M3.5 4h17v16h-17zM3.5 9h17m-10 0v11",
  grid: "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z",
  receipt: "M6 3l3 2 3-2 3 2 3-2v18l-3-2-3 2-3-2-3 2zM9 9h6m-6 4h6",
  shield: "M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10zm-3-10 2 2 4-4",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  chevron: "m9 6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  download: "M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4",
  spark: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2zm7 13v6m-3-3h6M5 3v4M3 5h4",
  sliders: "M4 6h8m4 0h4M4 12h3m4 0h9M4 18h10m4 0h2M12 3v6m-5 0v6m7 0v6",
  pencil: "m4 15 11-11 4 4L8 19l-5 1zM13 6l4 4",
  ruler: "M3 20v-7L15 2l6 6L9 20zM8 11l3 3m0-6 3 3m0-6 3 3",
  scan: "M8 4H5a1 1 0 0 0-1 1v3m12-4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3M3 12h18m-14-2v4m10-4v4",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zm-3 6v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  cube: "m12 3 9 5v8l-9 5-9-5V8zm-9 5 9 5 9-5m-9 5v8",
  layers: "m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5m-18 4 9 5 9-5",
  expand: "M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5",
  bag: "M5 8h14l1 13H4zm4 2V6a3 3 0 0 1 6 0v4",
  check: "m5 12 4 4L19 6",
  checkCircle: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM7.5 12l3 3 6-6",
  alert:
    "M10.5 4.2a1.7 1.7 0 0 1 3 0l7.2 13a1.7 1.7 0 0 1-1.5 2.5H4.8a1.7 1.7 0 0 1-1.5-2.5zM12 9v4m0 3h.01",
  sofa: "M6 12v-2a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2m-12 6v2m12-2v2M4 12a2 2 0 0 1 2 2v1h12v-1a2 2 0 1 1 4 0v4H2v-4a2 2 0 0 1 2-2z",
  chair: "M7 13V8a5 5 0 0 1 10 0v5m-10 6-1 2m11-2 1 2M5 16a2 2 0 1 1 4 0h6a2 2 0 1 1 4 0v3H5z",
  external: "M13 5h6v6m0-6-8 8m6 1v5H5V7h5",
  more: "M5 12h.01m7 0h.01m7 0h.01",
  close: "m6 6 12 12M18 6 6 18",
  rotate: "M4 10a8 8 0 1 1 1 8m-1-8V4m0 6h6",
  door: "M4 21h16m-3 0V3H7v18m7-9h.01",
  window: "M4 4h16v16H4zM12 4v16m-8-8h16",
  socket: "M6 7h12v10H6zm4 4v2m4-2v2",
  camera: "M4 7h4l2-3h4l2 3h4v13H4zm12 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  upload: "M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4",
  trash: "M4 6h16m-14 0 1 14h10l1-14M9 6V3h6v3m-5 3v7m4-7v7",
  lock: "M6 10h12v11H6zm2 0V7a4 4 0 0 1 8 0v3m-4 5v2",
  printer: "M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7zm9-3h.01",
  info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zm-10-1v6m0-10h.01"
};

export function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={name === "more" ? 3.2 : 1.65}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d={icons[name] ?? icons.cube} />
    </svg>
  );
}

export function Button({ icon, children, className = "", ...props }) {
  return (
    <button type='button' className={`btn ${className}`} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className = "", ...props }) {
  return (
    <button
      type='button'
      className={`icon-btn ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Field({ label, children, hint, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Select({ children, ...props }) {
  return (
    <span className='select'>
      <select {...props}>{children}</select>
      <Icon name='down' size={15} />
    </span>
  );
}

export function Brand({ onClick }) {
  return (
    <button type='button' className='brand' onClick={onClick} aria-label='Метрика, планировка'>
      <span className='brand-mark'>
        <Icon name='brand' size={23} />
      </span>
      <span>
        метрика<span className='brand-period'>.</span>
      </span>
    </button>
  );
}

export function PanelTitle({ icon, title, count }) {
  return (
    <div className='panel-heading'>
      <span className='heading-icon'>
        <Icon name={icon} size={18} />
      </span>
      <h2>{title}</h2>
      {count !== undefined && <span className='count'>{count}</span>}
    </div>
  );
}

export function Header({ action, status }) {
  return (
    <header className='topbar'>
      <div className='top-inner'>
        <Brand onClick={() => action("workspace")} />
        <nav className='nav' aria-label='Основное меню'>
          {[
            ["workspace", "layout", "Планировка"],
            ["catalog", "grid", "Каталог"],
            ["estimate", "receipt", "Смета"]
          ].map(([key, icon, label]) => (
            <button
              key={key}
              className={`nav-link ${key === "workspace" ? "active" : ""}`}
              aria-current={key === "workspace" ? "page" : undefined}
              onClick={() => action(key)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <div className='top-actions'>
          <span className='save-state'>
            <i className={status.includes("ошибка") ? "warning" : ""} />
            {status}
          </span>
          <IconButton
            icon='shield'
            className='account'
            label='Хранение и защита проекта'
            onClick={() => action("privacy")}
          />
        </div>
      </div>
    </header>
  );
}

export function ProjectHeader({ room, action }) {
  return (
    <section className='project-head'>
      <div>
        <div className='breadcrumb'>
          <Icon name='folder' size={16} />
          <button onClick={() => action("projects")}>Мои проекты</button>
          <Icon name='chevron' size={12} />
          <span>{room.name}</span>
        </div>
        <h1>Планировка комнаты</h1>
        <p>Расставьте мебель, проверьте проходы и соберите смету.</p>
      </div>
      <div className='project-actions'>
        <Button icon='download' onClick={() => action("export")}>
          Экспорт
        </Button>
        <Button icon='spark' className='primary' onClick={() => action("replan")}>
          Подобрать варианты
        </Button>
      </div>
    </section>
  );
}

export function Settings({ project, update, action }) {
  const { w, d } = dimensions(project.room.points);
  const owned = project.items.filter((item) => item.owned);
  const [budgetEntry, setBudgetEntry] = useState(null);
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
            onClick={() => action("room")}
          />
        </div>
        <button className='room-summary' onClick={() => action("room")}>
          <span className='room-icon'>
            <Icon name='ruler' size={20} />
          </span>
          <span>
            <strong>{project.room.name}</strong>
            <small>
              {decimal(w, 2)} × {decimal(d, 2)} м · {decimal(area(project.room.points))} м²
            </small>
          </span>
        </button>
        <div className='capture-buttons'>
          <Button icon='scan' className='ar-soft' onClick={() => action("ar-scan")}>
            AR-обмер
          </Button>
          <Button
            icon='mic'
            className='square'
            title='Голосовой ввод'
            aria-label='Голосовой ввод'
            onClick={() => action("voice")}
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
              value={budgetEntry ?? project.budget.toLocaleString("ru-RU")}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                const budget = Math.min(1e9, Number(raw));
                setBudgetEntry(Number(raw) > 1e9 ? String(budget) : raw);
                update({ budget });
              }}
              onBlur={() => setBudgetEntry(null)}
              aria-label='Общий бюджет'
            />
            <span>₽</span>
          </span>
        </Field>
        <Field label='Материал' className='settings-field'>
          <Select value={project.material} onChange={(e) => update({ material: e.target.value })}>
            {materials.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field label='Способ покупки' className='settings-field'>
          <Select value={project.mode} onChange={(e) => update({ mode: e.target.value })}>
            {Object.entries(modes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {project.mode === "office" && (
          <button className='text-btn procurement-btn' onClick={() => action("procurement")}>
            <Icon name='receipt' />
            Поля закупки
          </button>
        )}
      </section>
      <section className='settings-section inventory-section'>
        <div className='row-title'>
          <h3>
            Моя мебель <span className='count'>{owned.length}</span>
          </h3>
          <IconButton
            className='small add-icon'
            icon='plus'
            label='Добавить свою мебель'
            onClick={() => action("add-owned")}
          />
        </div>
        <div className='owned-list'>
          {owned.length ? (
            owned.map((item) => (
              <button className='owned-item' key={item.id} onClick={() => action("item", item.id)}>
                <span className={`owned-icon ${item.kind}`}>
                  <Icon name={item.kind} size={19} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{itemSize(item)}</small>
                </span>
                <Icon className='push-right more-icon' name='more' size={16} />
              </button>
            ))
          ) : (
            <p className='empty-small'>Добавьте мебель с её размерами.</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function MiniPlan({ style }) {
  return (
    <span aria-hidden='true' className={`mini-plan ${style}`}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function Planner({
  project,
  items,
  positions,
  inspection,
  chosen,
  setChosen,
  move,
  action
}) {
  const canvas = useRef(null),
    drawing = useRef(null),
    drag = useRef(null);
  const [view, setView] = useState("2d"),
    [zoom, setZoom] = useState(1),
    [live, setLive] = useState(null);
  useLayoutEffect(() => {
    const node = canvas.current;
    const paint = () => {
      const all = live ? { ...positions, [live.id]: live.pos } : positions;
      drawing.current = drawPlan(node, project, items, all, inspection, {
        view,
        zoom,
        selected: chosen
      });
      if (drawing.current)
        node.parentElement.style.setProperty("--scale-line", `${drawing.current.scale}px`);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(node);
    document.fonts?.ready.then(() => {
      if (node.isConnected) paint();
    });
    return () => observer.disconnect();
  }, [project, items, positions, inspection, view, zoom, chosen, live]);
  const eventPoint = (event) => {
    const { left, top } = event.currentTarget.getBoundingClientRect();
    return [event.clientX - left, event.clientY - top];
  };
  const start = (event) => {
    if (event.button !== 0 || !drawing.current) return;
    const [x, y] = eventPoint(event);
    const found = [...drawing.current.targets]
      .reverse()
      .find((target) =>
        target.polygon
          ? pointIn([x, y], target.polygon) || pointIn([x, y], target.front)
          : x >= target.x && x <= target.x + target.w && y >= target.y && y <= target.y + target.h
      );
    setChosen(found?.item.id ?? null);
    if (!found || view !== "2d") return;
    drag.current = {
      id: found.item.id,
      x,
      y,
      pos: positions[found.item.id],
      scale: drawing.current.scale,
      latest: null
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const track = (event) => {
    if (!drag.current) return;
    const [x, y] = eventPoint(event),
      origin = drag.current;
    if (Math.hypot(x - origin.x, y - origin.y) < 3 && !origin.latest) return;
    origin.latest = {
      ...origin.pos,
      x: round(origin.pos.x + (x - origin.x) / origin.scale),
      y: round(origin.pos.y + (y - origin.y) / origin.scale)
    };
    setLive({ id: origin.id, pos: origin.latest });
  };
  const stop = (event) => {
    const pointer = drag.current;
    drag.current = null;
    setLive(null);
    if (pointer?.latest && event.type !== "pointercancel") move(pointer.id, pointer.latest);
  };
  const key = (event) => {
    const offset = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[
      event.key
    ];
    if (!offset || !chosen || !positions[chosen] || view !== "2d") return;
    event.preventDefault();
    const pos = positions[chosen],
      step = event.shiftKey ? 0.15 : 0.03;
    move(chosen, {
      ...pos,
      x: round(pos.x + offset[0] * step),
      y: round(pos.y + offset[1] * step)
    });
  };
  const current = items.find((item) => item.id === chosen);
  const warnings = inspection.warnings.length;
  return (
    <section className='panel planner' aria-label='План комнаты'>
      <div className='planner-heading'>
        <div>
          <h2>План комнаты</h2>
          <p>
            {project.room.name} <b>·</b> {decimal(area(project.room.points))} м²
          </p>
        </div>
        <div className='view-controls'>
          <div className='segmented' aria-label='Режим плана'>
            {["2d", "3d"].map((mode) => (
              <button
                key={mode}
                className={view === mode ? "selected" : ""}
                aria-pressed={view === mode}
                onClick={() => {
                  setView(mode);
                  setZoom(1);
                }}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
          <Button icon='cube' className='ar-view' onClick={() => action("ar-view")}>
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
          <IconButton
            icon='plus'
            label='Увеличить'
            onClick={() => setZoom(Math.min(2.3, zoom + 0.2))}
          />
          <IconButton
            icon='minus'
            label='Уменьшить'
            onClick={() => setZoom(Math.max(0.55, zoom - 0.2))}
          />
          <IconButton
            className='fit'
            icon='expand'
            label='Вписать план'
            onClick={() => setZoom(1)}
          />
        </div>
        {current && positions[current.id] && (
          <div className='selected-bar'>
            <button className='selected-item-name' onClick={() => action("item", current.id)}>
              {current.name}
            </button>
            <IconButton
              icon='rotate'
              label='Повернуть на 90 градусов'
              onClick={() =>
                move(current.id, {
                  ...positions[current.id],
                  r: (positions[current.id].r + 90) % 360
                })
              }
            />
            <IconButton icon='close' label='Снять выделение' onClick={() => setChosen(null)} />
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
            <i className='owned-dot' />
            Есть у вас
          </span>
          <span>
            <i className='buy-dot' />К покупке
          </span>
          <span>
            <i className='pass-dot' />
            Проход
          </span>
        </div>
        <button
          className={`plan-status ${warnings ? "warning" : inspection.state === "no-door" ? "neutral" : ""}`}
          onClick={() => action("checks")}
        >
          <Icon
            name={warnings ? "alert" : inspection.state === "ok" ? "checkCircle" : "info"}
            size={15}
          />
          {warnings
            ? `Замечаний: ${warnings}`
            : inspection.state === "ok"
              ? `Проход ≥ ${Math.round(project.passage * 100)} см`
              : "Укажите дверь"}
        </button>
      </div>
      <div className='variants'>
        <div className='row-title'>
          <h3>Варианты расстановки</h3>
          <span className='secondary'>3 варианта</span>
        </div>
        <div className='variant-list'>
          {variants.map(({ title, note, style }, i) => (
            <button
              key={style}
              className={`variant ${project.variant === i ? "selected" : ""}`}
              aria-pressed={project.variant === i}
              onClick={() => action("variant", i)}
            >
              <MiniPlan style={style} />
              <span>
                <strong>{title}</strong>
                <small>{note}</small>
              </span>
              {project.variant === i && <Icon className='variant-check' name='check' size={14} />}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Thumbnail({ item, className = "" }) {
  if (item.photo)
    return (
      <span className={`product-image ${className}`}>
        <img src={item.photo} alt='' />
      </span>
    );
  return (
    <span
      className={`product-image ${item.illustration ? `image-${item.illustration}` : "image-placeholder"} ${className}`}
      aria-hidden='true'
    >
      {!item.illustration && <Icon name={item.kind} size={24} />}
    </span>
  );
}

export function Shopping({ project, items, action }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const difference = project.budget - total;
  const fraction = project.budget ? Math.min(total / project.budget, 1) : Number(total > 0);
  return (
    <aside className='panel shopping' aria-label='К покупке'>
      <PanelTitle icon='bag' title='К покупке' count={items.length} />
      <div className={`budget-summary ${difference < 0 ? "over-budget" : ""}`}>
        <div className='budget-top'>
          <span>Итого по смете</span>
          <span className='budget-badge'>
            <Icon name={difference >= 0 ? "check" : "alert"} size={13} />
            {difference >= 0 ? "В бюджете" : "Сверх бюджета"}
          </span>
        </div>
        <strong className='total'>{money(total)}</strong>
        <div
          className='budget-track'
          role='progressbar'
          aria-label='Использовано бюджета'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
        >
          <i style={{ width: `${fraction * 100}%` }} />
        </div>
        <div className='budget-bottom'>
          <span>из {money(project.budget)}</span>
          <strong>
            {difference >= 0 ? "Остаток" : "Не хватает"} {money(Math.abs(difference))}
          </strong>
        </div>
      </div>
      <div className='shopping-list'>
        <div className='shopping-label'>
          <h3>Список покупок</h3>
          <button className='small-link' onClick={() => action("add-buy")}>
            <Icon name='plus' size={15} />
            Добавить
          </button>
        </div>
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className='product-row'>
              <button className='product-main' onClick={() => action("item", item.id)}>
                <Thumbnail item={item} />
                <span className='product-meta'>
                  <strong>{item.name}</strong>
                  <small>
                    {item.seller || sourceLabel[item.source]} <b>·</b> {itemSize(item)}
                  </small>
                  <span className='product-price'>
                    {money(item.price)}
                    {purchaseIssues(project, item).length > 0 && (
                      <span
                        className='product-warning'
                        title={purchaseIssues(project, item).join(", ")}
                      >
                        <Icon name='alert' size={15} />
                      </span>
                    )}
                  </span>
                </span>
              </button>
              {item.url && (
                <a
                  className='product-link'
                  href={item.url}
                  target='_blank'
                  rel='noreferrer'
                  aria-label={`Открыть страницу товара ${item.name}`}
                  title='Страница товара'
                >
                  <Icon name='external' size={16} />
                </a>
              )}
            </div>
          ))
        ) : (
          <p className='empty-small'>Добавьте товары, объявления или предложения поставщиков.</p>
        )}
      </div>
      <Button icon='grid' className='catalog-btn' onClick={() => action("catalog")}>
        Открыть каталог
      </Button>
      <button className='text-btn estimate-btn' onClick={() => action("estimate")}>
        <Icon name='receipt' size={17} />
        Подробная смета
        <Icon className='push-right' name='chevron' size={14} />
      </button>
    </aside>
  );
}
