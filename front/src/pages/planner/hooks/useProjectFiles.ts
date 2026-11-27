import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { download } from "../../../shared/helpers/index.ts";
import { getImportError, makeCsv } from "../helpers/index.ts";
import { procurementMissing, readEncryptedRecord, validateImport } from "../mock/index.ts";
import { drawPlan } from "../planning/index.ts";
import type {
  EncryptedRecord,
  ExportFormat,
  Inspection,
  Item,
  Positions,
  Project
} from "../types/index.ts";

type Options = {
  project: Project;
  readOnly: boolean;
  allItems: Item[];
  bought: Item[];
  positions: Positions;
  inspection: Inspection;
  importPlain: (project: Project) => void;
  importEncrypted: (record: EncryptedRecord) => void;
  backup: () => Promise<string>;
  clearSelection: () => void;
  close: () => void;
  notify: (message: string) => void;
};

export const useProjectFiles = ({
  project,
  readOnly,
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
}: Options) => {
  const [printImage, setPrintImage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const importAttempt = useRef<AbortController | null>(null);
  const cancelImport = useCallback(() => importAttempt.current?.abort(), []);

  useEffect(() => cancelImport, [readOnly, cancelImport]);

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || readOnly) return;
    cancelImport();
    const attempt = new AbortController();
    importAttempt.current = attempt;
    try {
      if (file.size > 24 * 1024 * 1024) throw new Error("Файл проекта превышает 24 МБ.");
      const text = await file.text();
      if (attempt.signal.aborted) return;
      const input: unknown = JSON.parse(text);
      const record = readEncryptedRecord(input);
      if (record) {
        clearSelection();
        close();
        importEncrypted(record);
        return;
      }
      importPlain(validateImport(input));
      clearSelection();
      close();
      notify("Проект загружен из файла.");
    } catch (error) {
      if (!attempt.signal.aborted) notify(getImportError(error));
    }
  };

  const exportData = async (format: ExportFormat) => {
    if (format !== "json" && project.mode === "office" && procurementMissing(project).length) {
      notify("Заполните поля и реквизиты служебной закупки перед выгрузкой.");
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
      let contents: string;
      try {
        contents = await backup();
      } catch {
        notify("Не удалось подготовить защищённую копию проекта.");
        return;
      }
      download(`Метрика — ${filename}.json`, contents, "application/json;charset=utf-8");
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

  const chooseImportFile = () => fileInput.current?.click();
  const exportCopy = () => exportData("json");

  return { printImage, fileInput, importProject, exportData, chooseImportFile, exportCopy };
};
