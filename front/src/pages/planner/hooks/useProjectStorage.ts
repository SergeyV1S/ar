import type { SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  initialProject,
  needsProtection,
  newProtection,
  readLocal,
  serializeProject,
  unlockLocal,
  writeLocal
} from "../mock/index.ts";
import type { EncryptedRecord, Project, Protection } from "../types/index.ts";

export const useProjectStorage = (
  initial: ReturnType<typeof readLocal>,
  close: () => void,
  notify: (message: string) => void
) => {
  const [project, setProject] = useState<Project>(() =>
    initial.kind === "locked" ? initialProject() : initial.project
  );
  const [locked, setLocked] = useState(initial.kind === "locked" ? initial.record : null);
  const [pending, setPending] = useState<Project | null>(() =>
    initial.kind === "ready" && needsProtection(initial.project) ? initial.project : null
  );
  const [importRecord, setImportRecord] = useState<EncryptedRecord | null>(null);
  const [isProtected, setIsProtected] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [status, setStatus] = useState(
    initial.kind === "unreadable" ? "ошибка чтения" : "Локальный проект"
  );

  const writes = useRef(Promise.resolve());
  const latestProject = useRef(project);
  // Queued saves read the key in effect when each write starts.
  const activeProtection = useRef<Protection | null>(null);
  const updateMade = useRef(false);
  const protecting = useRef(false);
  const change = useCallback((updater: SetStateAction<Project>) => {
    updateMade.current = true;
    setProject(updater);
  }, []);
  const importPlain = (next: Project) => {
    if (needsProtection(next)) {
      setPrivacyError("");
      setPending(next);
      return;
    }
    change(next);
  };
  const update = (patch: Partial<Project>) => {
    if (patch.mode === "office" && !activeProtection.current) {
      importPlain({ ...project, ...patch });
      return;
    }
    change((current) => ({ ...current, ...patch }));
  };
  const backup = () => serializeProject(project, activeProtection.current);
  const importEncrypted = (record: EncryptedRecord) => {
    setPrivacyError("");
    setImportRecord(record);
  };
  const cancelPending = () => {
    if (protecting.current || unlocking) return;
    setImportRecord(null);
    setPending(null);
    setPrivacyError("");
  };

  useEffect(() => {
    latestProject.current = project;
    if (locked || !updateMade.current) return;
    const promise = writes.current
      .catch(() => {})
      .then(() => writeLocal(project, activeProtection.current));
    writes.current = promise;
    let active = true;
    promise.then(
      () => {
        if (active)
          setStatus(activeProtection.current ? "Защищённый проект" : "Сохранено локально");
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
  }, [project, locked, notify]);

  const protect = async (password: string) => {
    if (protecting.current) return;
    if (!globalThis.crypto?.subtle) {
      setPrivacyError("Для локального шифрования откройте сайт по HTTPS или с localhost.");
      return;
    }
    protecting.current = true;
    try {
      const key = await newProtection(password);
      const saved = writes.current
        .catch(() => {})
        .then(async () => {
          await writeLocal(pending ?? latestProject.current, key);
          activeProtection.current = key;
        });
      writes.current = saved;
      await saved;
      if (pending) {
        updateMade.current = false;
        setProject(pending);
        setPending(null);
      }
      setIsProtected(true);
      setStatus("Защищённый проект");
      close();
      notify("Локальная копия зашифрована.");
    } catch {
      setPrivacyError(
        "Не удалось сохранить защищённую копию. Проверьте настройки хранилища браузера."
      );
    } finally {
      protecting.current = false;
    }
  };

  const lock = async () => {
    try {
      await writes.current;
      const saved = readLocal();
      if (saved.kind !== "locked") throw new Error();
      updateMade.current = false;
      setLocked(saved.record);
      activeProtection.current = null;
      setIsProtected(false);
      setProject(initialProject());
      close();
    } catch {
      setPrivacyError("Не удалось проверить сохранённую копию. Проект остался открытым.");
    }
  };

  const unlock = async (password: FormDataEntryValue | null) => {
    const record = importRecord ?? locked;
    if (!record) return;
    if (unlocking) return;
    setUnlocking(true);
    setPrivacyError("");
    try {
      const result = await unlockLocal(record, String(password));
      if (importRecord) {
        await writes.current.catch(() => {});
        try {
          await writeLocal(result.project, result.protection);
        } catch {
          setPrivacyError("Не удалось сохранить импортированную копию.");
          return;
        }
        setImportRecord(null);
        close();
      }
      updateMade.current = false;
      setProject(result.project);
      activeProtection.current = result.protection;
      setIsProtected(true);
      setLocked(null);
      setStatus("Защищённый проект");
    } catch {
      setPrivacyError("Пароль не подошёл или сохранённый проект повреждён.");
    } finally {
      setUnlocking(false);
    }
  };

  const resetPrivacyError = () => setPrivacyError("");

  return {
    project,
    locked: importRecord ?? locked,
    pendingProtection: Boolean(pending),
    canCancelProtection: Boolean(importRecord || (pending && pending !== project)),
    cancelPending,
    importPlain,
    importEncrypted,
    backup,
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
  };
};
