import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/manrope";

import "../style.css";
import type { ARController } from "./ar.ts";
import { arHelp, startAR, supportsAR } from "./ar.ts";
import {
  checkLabel,
  decimal,
  initialProject,
  modes,
  newProtection,
  positionsFor,
  procurementFields,
  procurementMissing,
  purchaseIssues,
  readLocal,
  resizeRoom,
  sourceLabel,
  unlockLocal,
  validateImport,
  visibleItems,
  writeLocal
} from "./data.ts";
import {
  ARHelp,
  Catalog,
  CheckReport,
  Dialog,
  EstimateContent,
  ExportOptions,
  ItemEditor,
  Outline,
  Procurement,
  RoomEditor,
  Voice
} from "./dialogs.tsx";
import { area, arrange, clamp, dimensions, inspect, rect, variants } from "./geometry.ts";
import { drawPlan } from "./plan.ts";
import type {
  ARMode,
  Action,
  Item,
  Position,
  Positions,
  Project,
  Protection,
  Room,
  VoicePatch,
  XRState
} from "./types.ts";
import {
  Brand,
  Button,
  Field,
  Header,
  Icon,
  Planner,
  ProjectHeader,
  Select,
  Settings,
  Shopping
} from "./ui.tsx";

const label: Record<string, [string, string]> = {
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
};

const download = (name: string, content: string, type: string) => {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type }));
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const makeCsv = (project: Project, bought: Item[], positions: Positions) => {
  const items = visibleItems(project);
  const headers = [
    "Позиция",
    "Статус",
    "Ширина, м",
    "Глубина, м",
    "Высота, м",
    "Материал",
    "Цена, ₽",
    "Лимит позиции, ₽",
    "Поставщик",
    "Артикул",
    "Реквизиты",
    "Ссылка",
    "Наличие",
    "Источник",
    "Проверка",
    "Примечания"
  ];
  const rows = items.map((item) => [
    item.name,
    item.owned ? "Есть у пользователя" : "К покупке",
    decimal(item.w, 2),
    decimal(item.d, 2),
    decimal(item.h, 2),
    item.material,
    item.owned ? 0 : item.price,
    item.cap || "",
    item.seller ?? "",
    item.sku ?? "",
    item.details ?? "",
    item.url ?? "",
    item.availability ?? "",
    sourceLabel[item.source],
    checkLabel[item.verified],
    [
      ...(item.owned ? [] : purchaseIssues(project, item)),
      ...(positions[item.id] ? [] : ["Не размещено"])
    ].join(", ")
  ]);
  const total = bought.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const csvField = (value: unknown) => {
    const entry = String(value ?? "");
    const safe =
      typeof value === "string" && /^[\t\n\r ]*[=+\-@]/.test(entry) ? `'${entry}` : entry;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const lines = [
    headers,
    ...rows,
    [],
    ["Комната", project.room.name],
    ["Способ закупки", modes[project.mode]],
    ["Вариант", variants[project.variant].title],
    ["Бюджет", project.budget],
    ["Итого", total],
    ["Разница", project.budget - total]
  ];
  if (project.mode === "office")
    lines.push(
      ...Object.entries(procurementFields).map(([key, title]) => [
        title,
        project.procurement[key] ?? ""
      ])
    );
  return "\uFEFF" + lines.map((line) => line.map(csvField).join(";")).join("\r\n");
};

const Privacy = ({
  protection,
  protect,
  lock,
  error
}: {
  protection: Protection | null;
  protect: (password: string) => void;
  lock: () => void;
  error: string;
}) => {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [mismatch, setMismatch] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (password !== confirm) {
          setMismatch(true);
          return;
        }
        protect(password);
      }}
    >
      <p className='support-text'>
        Проект хранится в этом браузере. Для служебных помещений можно зашифровать локальную копию
        паролем.
      </p>
      {protection ? (
        <div className='notice'>
          <Icon name='lock' />
          Проект зашифрован. Для повторного открытия понадобится пароль.
        </div>
      ) : (
        <>
          <Field
            label='Пароль проекта'
            hint='Не менее 8 символов. Сохраните пароль: восстановить его через приложение нельзя.'
          >
            <input
              type='password'
              minLength={8}
              maxLength={250}
              autoComplete='new-password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label='Повторите пароль'>
            <input
              type='password'
              minLength={8}
              maxLength={250}
              autoComplete='new-password'
              required
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setMismatch(false);
              }}
            />
          </Field>
        </>
      )}
      {(error || mismatch) && (
        <p className='form-error' role='alert'>
          {error || "Пароли не совпадают."}
        </p>
      )}
      <div className='form-actions'>
        {protection ? (
          <Button icon='lock' className='primary' onClick={lock}>
            Заблокировать
          </Button>
        ) : (
          <button className='btn primary' type='submit'>
            <Icon name='lock' />
            Зашифровать
          </button>
        )}
      </div>
    </form>
  );
};

const Locked = ({
  unlock,
  error,
  busy
}: {
  unlock: (password: FormDataEntryValue | null) => void;
  error: string;
  busy: boolean;
}) => {
  return (
    <main className='locked-shell'>
      <Brand onClick={() => {}} />
      <section className='panel locked-card'>
        <span className='heading-icon'>
          <Icon name='lock' />
        </span>
        <h1>Проект защищён</h1>
        <p className='support-text'>Введите пароль, чтобы открыть план и смету.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            unlock(new FormData(event.currentTarget).get("password"));
          }}
        >
          <Field label='Пароль проекта'>
            <input
              name='password'
              type='password'
              autoComplete='current-password'
              required
              autoFocus
            />
          </Field>
          {error && (
            <p className='form-error' role='alert'>
              {error}
            </p>
          )}
          <button className='btn primary' type='submit' disabled={busy}>
            <Icon name='lock' />
            {busy ? "Открываем…" : "Открыть проект"}
          </button>
        </form>
      </section>
    </main>
  );
};

const XRControls = ({
  mode,
  state,
  overlayRef,
  control
}: {
  mode: ARMode | null;
  state: XRState;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  control: (method: keyof ARController, value?: string) => void;
}) => {
  const scan = mode === "scan";
  return (
    <div className='xr-overlay' ref={overlayRef} hidden={!mode}>
      <div className='xr-hud'>
        <div className='xr-head'>
          <span className='brand-mark'>
            <Icon name={scan ? "scan" : "cube"} />
          </span>
          <div>
            <strong>{scan ? "AR-обмер" : "Расстановка в AR"}</strong>
            <p aria-live='polite'>{state.text || "Подключаем камеру…"}</p>
          </div>
        </div>
        {scan && (state.count ?? 0) >= 3 && (
          <Field label='Что отметить'>
            <Select
              value={state.kind ?? "corner"}
              onChange={(event) => control("kind", event.target.value)}
            >
              <option value='corner'>Угол комнаты</option>
              <option value='door'>Края двери</option>
              <option value='window'>Края окна</option>
              <option value='socket'>Розетку</option>
            </Select>
          </Field>
        )}
        <div className='xr-actions'>
          <Button onClick={() => control("exit")}>Выйти</Button>
          <Button icon='rotate' onClick={() => control("undo")}>
            {scan ? "Отменить точку" : "Сбросить"}
          </Button>
          {scan && (state.count ?? 0) >= 3 && (
            <Button icon='check' onClick={() => control("save")}>
              Сохранить контур
            </Button>
          )}
          <Button
            icon={scan ? "plus" : "cube"}
            className='primary'
            disabled={!state.ready}
            onClick={() => control("collect")}
          >
            {scan ? "Поставить точку" : state.positioned ? "Разместить заново" : "Отметить точку"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [initial] = useState(readLocal);
  const [project, setProject] = useState<Project>(initial.project ?? initialProject);
  const [locked, setLocked] = useState(initial.locked ?? null);
  const [protection, setProtection] = useState<Protection | null>(null);
  const [privacyError, setPrivacyError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [status, setStatus] = useState(initial.unreadable ? "ошибка чтения" : "Локальный проект");
  const [modal, setModal] = useState<{ name: string; id?: string | number } | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState(""),
    [printImage, setPrintImage] = useState("");
  const [arSupport, setArSupport] = useState<boolean | null>(null),
    [arError, setArError] = useState("");
  const [xrMode, setXrMode] = useState<ARMode | null>(null),
    [xrState, setXrState] = useState<XRState>({});
  const overlay = useRef<HTMLDivElement>(null),
    controller = useRef<ARController | null>(null),
    writes = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null),
    updateMade = useRef(false);

  const allItems = useMemo(() => visibleItems(project), [project.items, project.mode]);
  const bought = useMemo(() => allItems.filter((item) => !item.owned), [allItems]);
  const positions = useMemo(
    () => positionsFor(project),
    [project.room, project.items, project.mode, project.variant, project.layouts]
  );
  const inspection = useMemo(
    () => inspect(project.room, allItems, positions, project.passage),
    [project.room, allItems, positions, project.passage]
  );
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4600);
  }, []);
  const change = useCallback((updater: React.SetStateAction<Project>) => {
    updateMade.current = true;
    setProject(updater);
  }, []);
  const update = (patch: Partial<Project>) => change((current) => ({ ...current, ...patch }));
  const close = () => setModal(null);

  useEffect(() => {
    if (locked || !updateMade.current) return;
    const promise = writes.current.catch(() => {}).then(() => writeLocal(project, protection));
    writes.current = promise;
    let active = true;
    promise.then(
      () => {
        if (active) setStatus(protection ? "Защищённый проект" : "Сохранено локально");
      },
      () => {
        if (active) {
          setStatus("ошибка сохранения");
          notify("Браузер не сохранил проект. Выгрузите резервную копию через экспорт.");
        }
      }
    );
    return () => {
      active = false;
    };
  }, [project, protection, locked, notify]);

  useEffect(() => {
    let active = true;
    supportsAR().then((supported) => {
      if (active) setArSupport(supported);
    });
    return () => {
      active = false;
      clearTimeout(timer.current);
    };
  }, []);

  const action: Action = (name, id) => {
    if (name === "workspace") {
      close();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (name === "variant") {
      update({ variant: Number(id) });
      setSelected(null);
      return;
    }
    if (name === "replan") {
      const options = variants.map((_, i) => arrange(project.room, allItems, i));
      const ranks = options.map(
        (option) => inspect(project.room, allItems, option, project.passage).warnings.length
      );
      update({
        variant: ranks.indexOf(Math.min(...ranks)),
        layouts: { ...project.layouts, [project.mode]: options }
      });
      setSelected(null);
      notify(
        allItems.length
          ? "Варианты обновлены. Выбран вариант с наименьшим числом замечаний."
          : "Добавьте мебель, чтобы подобрать расстановку."
      );
      return;
    }
    if (name === "ar-view" && !allItems.some((item) => positions[item.id])) {
      notify("Сначала добавьте и разместите мебель на плане.");
      return;
    }
    if (name.startsWith("ar-")) setArError("");
    if (name === "privacy") setPrivacyError("");
    setModal({ name, id });
  };

  const move = (id: string, pos: Position) => {
    const { w, d } = dimensions(project.room.points);
    const limit = { ...pos, x: clamp(pos.x, -5, w + 2), y: clamp(pos.y, -5, d + 2) };
    update({
      layouts: {
        ...project.layouts,
        [project.mode]: {
          ...project.layouts[project.mode],
          [project.variant]: { ...positions, [id]: limit }
        }
      }
    });
  };

  const saveRoom = (room: Room, passage: number) => {
    const geometryChanged =
      room.points.some(
        ([x, y], i) => x !== project.room.points[i]?.[0] || y !== project.room.points[i]?.[1]
      ) ||
      room.points.length !== project.room.points.length ||
      JSON.stringify(room.openings) !== JSON.stringify(project.room.openings);
    update({ room, passage, ...(geometryChanged ? { layouts: {} } : {}) });
    close();
    notify("Параметры комнаты сохранены.");
  };

  const storeItem = (item: Item, fromCatalog = false) => {
    const old = project.items.find((candidate) => candidate.id === item.id);
    if (!old && project.items.length >= 60) {
      notify("В одном проекте можно хранить до 60 предметов.");
      return;
    }
    if (!item.name.trim()) {
      notify("Введите название мебели.");
      return;
    }
    const redraw =
      !old || (["w", "d", "access", "kind"] as const).some((key) => old[key] !== item[key]);
    update({
      items: old
        ? project.items.map((candidate) => (candidate.id === item.id ? item : candidate))
        : [...project.items, item],
      ...(redraw ? { layouts: item.owned ? {} : { ...project.layouts, [project.mode]: {} } } : {})
    });
    if (!fromCatalog) close();
    notify(old ? "Изменения сохранены." : "Мебель добавлена в проект.");
  };

  const removeItem = (id: string) => {
    const layouts = Object.fromEntries(
      Object.entries(project.layouts).map(([mode, alternatives]) => [
        mode,
        Object.fromEntries(
          Object.entries(alternatives).map(([index, plan]) => [
            index,
            Object.fromEntries(Object.entries(plan).filter(([key]) => key !== id))
          ])
        )
      ])
    );
    update({ items: project.items.filter((item) => item.id !== id), layouts });
    setSelected(null);
    close();
    notify("Позиция удалена.");
  };

  const acceptVoice = (patch: VoicePatch) => {
    const { size, sofa, ...other } = patch;
    let room = project.room;
    if (size) {
      room = { ...resizeRoom(room, ...size), source: "voice", verified: "review" };
      room.openings = room.openings.filter((opening) => {
        const a = room.points[opening.wall],
          b = room.points[(opening.wall + 1) % room.points.length];
        return (
          a && b && opening.offset + opening.width <= Math.hypot(a[0] - b[0], a[1] - b[1]) + 0.005
        );
      });
    }
    const items = sofa
      ? project.items.some((item) => item.id === sofa.id)
        ? project.items.map((item) => (item.id === sofa.id ? sofa : item))
        : [...project.items, sofa]
      : project.items;
    update({ ...other, room, items, ...(size || sofa ? { layouts: {} } : {}) });
    close();
    notify("Голосовой ввод применён. Проверьте размеры на плане.");
  };

  const launchAR = async (mode: ARMode) => {
    flushSync(() => {
      setXrMode(mode);
      setXrState({});
      setArError("");
      close();
    });
    try {
      controller.current = await startAR({
        mode,
        overlay: overlay.current! /* The overlay is mounted before launchAR via flushSync. */,
        items: allItems,
        positions,
        onState: setXrState,
        onScan: (data) => {
          saveRoom(
            {
              ...project.room,
              points: data.points,
              openings: data.openings,
              source: "xr",
              verified: "review"
            },
            project.passage
          );
          notify(
            data.skipped
              ? `Контур сохранён. Проёмов вдали от измеренных стен пропущено: ${data.skipped}.`
              : "Контур измерен. Проверьте размеры и проёмы на плане."
          );
        },
        onEnd: () => {
          controller.current = null;
          setXrMode(null);
        }
      });
    } catch (failure) {
      controller.current = null;
      setXrMode(null);
      setArError(
        failure instanceof Error &&
          (failure.name === "NotAllowedError" || failure.name === "SecurityError")
          ? "Доступ к AR или камере не разрешён. Проверьте разрешения сайта."
          : `Не удалось запустить AR. ${arHelp}`
      );
      setModal({ name: mode === "scan" ? "ar-scan" : "ar-view" });
    }
  };

  const protect = async (password: string) => {
    if (!globalThis.crypto?.subtle) {
      setPrivacyError("Для локального шифрования откройте сайт по HTTPS или с localhost.");
      return;
    }
    try {
      const key = await newProtection(password);
      await writes.current.catch(() => {});
      await writeLocal(project, key);
      setProtection(key);
      setStatus("Защищённый проект");
      close();
      notify("Локальная копия зашифрована.");
    } catch {
      setPrivacyError(
        "Не удалось сохранить защищённую копию. Проверьте настройки хранилища браузера."
      );
    }
  };

  const lock = async () => {
    try {
      await writes.current;
      const record = readLocal().locked;
      if (!record) throw new Error();
      updateMade.current = false;
      setLocked(record);
      setProtection(null);
      setProject(initialProject());
      close();
    } catch {
      setPrivacyError("Не удалось проверить сохранённую копию. Проект остался открытым.");
    }
  };

  const unlock = async (password: FormDataEntryValue | null) => {
    setUnlocking(true);
    setPrivacyError("");
    try {
      const result = await unlockLocal(
        locked! /* Unlock is only rendered for a locked record. */,
        String(password)
      );
      updateMade.current = false;
      setProject(result.project);
      setProtection(result.protection);
      setLocked(null);
      setStatus("Защищённый проект");
    } catch {
      setPrivacyError("Пароль не подошёл или сохранённый проект повреждён.");
    } finally {
      setUnlocking(false);
    }
  };

  const importProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error("Файл проекта превышает 12 МБ.");
      const parsed = validateImport(JSON.parse(await file.text()));
      change(() => parsed);
      setSelected(null);
      close();
      notify("Проект загружен из файла.");
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? "Не удалось прочитать JSON проекта."
          : error instanceof Error
            ? error.message
            : String(error)
      );
    }
  };

  const exportData = (format: string) => {
    if (format !== "json" && project.mode === "office" && procurementMissing(project).length) {
      action("export");
      return;
    }
    const filename = project.room.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "Комната";
    if (format === "csv") {
      download(
        `Смета — ${filename}.csv`,
        makeCsv(project, bought, positions),
        "text/csv;charset=utf-8"
      );
      close();
      notify("Смета выгружена в CSV.");
    } else if (format === "json") {
      download(
        `Метрика — ${filename}.json`,
        JSON.stringify(project, null, 2),
        "application/json;charset=utf-8"
      );
      close();
      notify("Файл проекта выгружен.");
    } else {
      const canvas = document.createElement("canvas");
      drawPlan(canvas, project, allItems, positions, inspection, { width: 1000, height: 590 });
      const image = canvas.toDataURL();
      flushSync(() => {
        close();
        setPrintImage(image);
      });
      const ready =
        document.querySelector<HTMLImageElement>("#print-view img")?.decode?.() ??
        Promise.resolve();
      ready.catch(() => {}).finally(() => window.print());
    }
  };

  if (locked) return <Locked unlock={unlock} error={privacyError} busy={unlocking} />;
  const item =
    modal?.name === "item" ? project.items.find((candidate) => candidate.id === modal.id) : null;
  const activeDialog = modal && label[modal.name];
  const dialogContent = () => {
    if (!modal) return null;
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
            item={item}
            owned={item?.owned ?? modal.name === "add-owned"}
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
            add={(entry) => storeItem(entry, true)}
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
                <Button icon='pencil' onClick={() => action("procurement")}>
                  Поля закупки
                </Button>
              )}
              <Button icon='download' className='primary' onClick={() => action("export")}>
                Экспорт
              </Button>
            </div>
          </>
        );
      case "export":
        return <ExportOptions project={project} action={action} run={exportData} />;
      case "procurement":
        return (
          <Procurement
            project={project}
            save={(procurement) => {
              update({ procurement });
              close();
              notify("Данные закупки сохранены.");
            }}
            close={close}
          />
        );
      case "checks":
        return <CheckReport project={project} inspection={inspection} action={action} />;
      case "privacy":
        return (
          <Privacy protection={protection} protect={protect} lock={lock} error={privacyError} />
        );
      case "ar-scan":
      case "ar-view": {
        const mode = modal.name === "ar-scan" ? "scan" : "view";
        return (
          <ARHelp
            mode={mode}
            support={arSupport}
            error={arError}
            back={() => (mode === "scan" ? action("outline") : close())}
            launch={() => launchAR(mode)}
          />
        );
      }
      case "projects":
        return (
          <>
            <div className='notice'>
              <Icon name='folder' />
              {project.room.name} · {decimal(area(project.room.points))} м² · {project.items.length}{" "}
              поз.
            </div>
            <p className='support-text'>
              Импорт JSON заменит открытый проект. Сохраните копию через «Экспорт», если она
              понадобится.
            </p>
            <div className='form-actions'>
              <Button icon='plus' className='push-left' onClick={() => action("new-project")}>
                Новый проект
              </Button>
              <Button icon='download' onClick={() => exportData("json")}>
                Сохранить копию
              </Button>
              <Button icon='upload' className='primary' onClick={() => fileInput.current?.click()}>
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
              <Button icon='download' className='push-left' onClick={() => exportData("json")}>
                Сохранить копию
              </Button>
              <Button onClick={() => action("projects")}>Отмена</Button>
              <Button
                icon='plus'
                className='primary'
                onClick={() => {
                  change(() => ({
                    ...initialProject(),
                    room: {
                      name: "Новая комната",
                      points: rect(4, 3),
                      openings: [],
                      source: "manual",
                      verified: "review"
                    },
                    items: []
                  }));
                  setSelected(null);
                  action("room");
                  notify("Новый проект создан.");
                }}
              >
                Создать проект
              </Button>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Header action={action} status={status} />
      <main className='shell'>
        <ProjectHeader room={project.room} action={action} />
        <div className='workgrid'>
          <Settings project={project} update={update} action={action} />
          <Planner
            project={project}
            items={allItems}
            positions={positions}
            inspection={inspection}
            chosen={selected}
            setChosen={setSelected}
            move={move}
            action={action}
          />
          <Shopping project={project} items={bought} action={action} />
        </div>
        <footer className='footer'>
          <span>
            метрика<span className='brand-period'>.</span>
          </span>
          <span>
            <Icon name='shield' size={15} />
            {protection
              ? "Проект зашифрован на этом устройстве"
              : "Проект хранится на этом устройстве"}
          </span>
        </footer>
      </main>
      {activeDialog && (
        <Dialog
          key={`${modal?.name}-${modal?.id ?? ""}`}
          title={activeDialog[0]}
          icon={activeDialog[1]}
          close={close}
          wide={["room", "catalog", "estimate", "outline"].includes(modal?.name ?? "")}
        >
          {dialogContent()}
        </Dialog>
      )}
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
      <XRControls
        mode={xrMode}
        state={xrState}
        overlayRef={overlay}
        control={(method, value) => {
          Promise.resolve(controller.current?.[method]?.(value)).catch(() =>
            notify("Не удалось выполнить действие в AR.")
          );
        }}
      />
      {printImage && (
        <section id='print-view' aria-hidden='true'>
          <h1>{project.room.name} — план и смета</h1>
          <p>
            {variants[project.variant].title} · {decimal(area(project.room.points))} м² ·{" "}
            {modes[project.mode]} · {sourceLabel[project.room.source]} /{" "}
            {checkLabel[project.room.verified]}
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

createRoot(document.getElementById("root")! /* index.html declares the root element. */).render(
  <App />
);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => navigator.serviceWorker.register("./sw.ts").catch(() => {}),
    { once: true }
  );
}
