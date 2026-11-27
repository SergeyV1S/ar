import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { readLocal } from "../data/index.ts";
import { initialProject, positionsFor, visibleItems } from "../data/index.ts";
import { applyVoicePatch, getItemLayoutUpdate, upsertItem } from "../helpers/index.ts";
import { area, arrange, clamp, dimensions, inspect, rect, variants } from "../planning/index.ts";
import type {
  ARMode,
  Action,
  Item,
  PlannerModal,
  Position,
  Project,
  Room,
  VoicePatch
} from "../types/index.ts";
import { usePlannerAR } from "./usePlannerAR.ts";
import { useProjectFiles } from "./useProjectFiles.ts";
import { useProjectStorage } from "./useProjectStorage.ts";

export const usePlannerPage = (initial: ReturnType<typeof readLocal>) => {
  const [modal, setModal] = useState<PlannerModal | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = () => setModal(null);
  const {
    project,
    locked,
    isProtected,
    privacyError,
    unlocking,
    status,
    change,
    update,
    protect,
    lock,
    unlock,
    resetPrivacyError
  } = useProjectStorage(initial, close, notify);
  const { items, mode, room, layouts, variant, passage } = project;
  const allItems = useMemo(() => visibleItems({ items, mode }), [items, mode]);
  const bought = useMemo(() => allItems.filter((item) => !item.owned), [allItems]);
  const positions = useMemo(
    () => positionsFor({ items, mode, room, layouts, variant }),
    [items, mode, room, layouts, variant]
  );
  const inspection = useMemo(
    () => inspect(room, allItems, positions, passage),
    [room, allItems, positions, passage]
  );
  const action: Action = (name, id) => {
    if (name === "workspace") {
      close();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (name === "variant") {
      if (typeof id !== "number" || !variants[id]) return;
      update({ variant: id });
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
    if (name === "ar-scan" || name === "ar-view") resetARError();
    if (name === "privacy") resetPrivacyError();
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
      items: upsertItem(project.items, item),
      ...getItemLayoutUpdate(project, item, redraw)
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
    update(applyVoicePatch(project, patch));
    close();
    notify("Голосовой ввод применён. Проверьте размеры на плане.");
  };

  const openARHelp = (mode: ARMode) => setModal({ name: mode === "scan" ? "ar-scan" : "ar-view" });
  const openExport = () => action("export");
  const clearSelection = () => setSelected(null);

  const { arSupport, arError, xrMode, xrState, overlay, launchAR, controlAR, resetARError } =
    usePlannerAR({
      project,
      items: allItems,
      positions,
      close,
      openHelp: openARHelp,
      saveRoom,
      notify
    });
  const { printImage, fileInput, importProject, exportData, chooseImportFile, exportCopy } =
    useProjectFiles({
      project,
      readOnly: Boolean(locked),
      allItems,
      bought,
      positions,
      inspection,
      change,
      clearSelection,
      close,
      openExport,
      notify
    });

  const openProcurement = () => action("procurement");
  const openProjects = () => action("projects");
  const openNewProject = () => action("new-project");
  const backFromARHelp = () => {
    if (modal?.name === "ar-scan") action("outline");
    else close();
  };
  const launchSelectedAR = () => launchAR(modal?.name === "ar-scan" ? "scan" : "view");
  const dialogItem =
    modal?.name === "item"
      ? project.items.find((candidate) => candidate.id === modal.id)
      : undefined;
  const roomArea = area(project.room.points);

  const saveProcurement = (procurement: Project["procurement"]) => {
    update({ procurement });
    close();
    notify("Данные закупки сохранены.");
  };
  const addCatalogItem = (entry: Item) => storeItem(entry, true);
  const createProject = () => {
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
  };
  return {
    project,
    locked,
    isProtected,
    privacyError,
    unlocking,
    status,
    modal,
    selected,
    toast,
    printImage,
    arSupport,
    arError,
    xrMode,
    xrState,
    overlay,
    fileInput,
    allItems,
    bought,
    positions,
    inspection,
    action,
    close,
    setSelected,
    update,
    move,
    saveRoom,
    storeItem,
    removeItem,
    acceptVoice,
    protect,
    lock,
    unlock,
    importProject,
    exportData,
    saveProcurement,
    addCatalogItem,
    controlAR,
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
  };
};
