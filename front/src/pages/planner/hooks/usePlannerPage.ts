import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { applyVoicePatch, getARLayoutUpdate, getItemLayoutUpdate, upsertItem } from "../helpers/index.ts";
import type { readLocal } from "../mock/index.ts";
import { initialProject, planItems, positionsFor, visibleItems } from "../mock/index.ts";
import { area, arrange, clamp, dimensions, inspect, rect, variants } from "../planning/index.ts";
import type {
  ARMode,
  Action,
  Item,
  PlannerModal,
  Position,
  Project,
  Room,
  ScanResult,
  VoicePatch
} from "../types/index.ts";
import { usePlannerAR } from "./usePlannerAR.ts";
import { useProjectFiles } from "./useProjectFiles.ts";
import { useProjectStorage } from "./useProjectStorage.ts";

export const usePlannerPage = (initial: ReturnType<typeof readLocal>) => {
  const { pathname } = useLocation();
  const [dialog, setDialog] = useState<{ path: string; modal: PlannerModal | null }>({
    path: pathname,
    modal: null
  });
  if (dialog.path !== pathname) setDialog({ path: pathname, modal: null });
  const modal = dialog.modal;
  const setModal = (next: PlannerModal | null) => setDialog({ path: pathname, modal: next });
  const [search, setSearch] = useSearchParams();
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [zoom, setZoom] = useState(1);
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
    pendingProtection,
    canCancelProtection,
    cancelPending,
    importPlain,
    importEncrypted,
    backup,
    resetPrivacyError
  } = useProjectStorage(initial, close, notify);
  const { items, mode, room, layouts, variant, passage } = project;
  const allItems = useMemo(() => planItems({ items, mode }), [items, mode]);
  const queryItem = search.get("item");
  const selected = allItems.find((item) => item.id === queryItem)?.id ?? null;
  const setSelected = (id: string | null) => {
    if (id === queryItem) return;
    const next = new URLSearchParams(search);
    if (id === null) next.delete("item");
    else next.set("item", id);
    setSearch(next, { replace: true, preventScrollReset: true });
  };
  const bought = useMemo(
    () => visibleItems({ items, mode }).filter((item) => !item.owned),
    [items, mode]
  );
  const positions = useMemo(
    () => positionsFor({ items, mode, room, layouts, variant, passage }),
    [items, mode, room, layouts, variant, passage]
  );
  const inspection = useMemo(
    () => inspect(room, allItems, positions, passage),
    [room, allItems, positions, passage]
  );
  const action: Action = (name, id) => {
    if (name === "variant") {
      if (typeof id !== "number" || !variants[id]) return;
      update({ variant: id });
      setSelected(null);
      return;
    }
    if (name === "replan") {
      if (!allItems.length) {
        notify("Добавьте мебель, чтобы подобрать расстановку.");
        return;
      }
      const options = variants.map((_, i) => arrange(project.room, allItems, i, passage));
      const ranks = options.map(
        (option) => inspect(project.room, allItems, option, project.passage).warnings.length
      );
      update({
        variant: ranks.indexOf(Math.min(...ranks)),
        layouts: { ...project.layouts, [project.mode]: options }
      });
      setSelected(null);
      close();
      notify("Варианты обновлены. Выбран вариант с наименьшим числом замечаний.");
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
    update({
      room,
      passage,
      ...(geometryChanged || passage !== project.passage ? { layouts: {} } : {})
    });
    close();
    notify("Параметры комнаты сохранены.");
  };

  const saveARScan = (data: ScanResult, starterItems: Item[]) => {
    const room: Room = {
      ...project.room,
      points: data.points,
      openings: data.openings,
      source: "xr",
      verified: "review"
    };
    if (data.positions) {
      update({ room, ...getARLayoutUpdate(project, data.positions, starterItems) });
      setSelected(null);
    } else saveRoom(room, project.passage);
    const message = data.positions ? "Контур и расстановка сохранены." : "Контур измерен.";
    notify(
      data.skipped
        ? `${message} Проёмов вдали от измеренных стен пропущено: ${data.skipped}.`
        : message
    );
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
      ...(fromCatalog && item.mode === "office"
        ? {
            procurement: {
              ...project.procurement,
              reason: project.procurement.reason || item.offerReason || "",
              offer: project.procurement.offer || item.url || ""
            }
          }
        : {}),
      ...getItemLayoutUpdate(
        project,
        item,
        redraw && (item.kind !== "service" || Boolean(old && old.kind !== "service"))
      )
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
  const clearSelection = () => setSelected(null);

  const { arSupport, arError, xrMode, xrState, xrItems, overlay, launchAR, controlAR, resetARError } =
    usePlannerAR({
      project,
      items: allItems,
      positions,
      close,
      openHelp: openARHelp,
      saveScan: saveARScan,
      notify
    });
  const { printImage, fileInput, importProject, exportData, chooseImportFile, exportCopy } =
    useProjectFiles({
      project,
      readOnly: Boolean(locked) || pendingProtection,
      allItems,
      bought,
      positions,
      inspection,
      importPlain,
      importEncrypted,
      backup,
      clearSelection,
      close,
      notify
    });

  const openProcurement = () => action("procurement");
  const openProjects = () => action("projects");
  const openPrivacy = () => action("privacy");
  const openNewProject = () => action("new-project");
  const replan = () => action("replan");
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
    pendingProtection,
    canCancelProtection,
    cancelPending,
    isProtected,
    privacyError,
    unlocking,
    status,
    modal,
    selected,
    view,
    setView,
    zoom,
    setZoom,
    toast,
    printImage,
    arSupport,
    arError,
    xrMode,
    xrState,
    xrItems,
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
    openProjects,
    openPrivacy,
    openNewProject,
    replan,
    backFromARHelp,
    launchSelectedAR,
    dialogItem,
    roomArea,
    chooseImportFile,
    exportCopy
  };
};
