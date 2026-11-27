import type { SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  initialProject,
  newProtection,
  readLocal,
  unlockLocal,
  writeLocal
} from "../data/index.ts";
import type { Project, Protection } from "../types/index.ts";

export const useProjectStorage = (
  initial: ReturnType<typeof readLocal>,
  close: () => void,
  notify: (message: string) => void
) => {
  const [project, setProject] = useState<Project>(() =>
    initial.kind === "locked" ? initialProject() : initial.project
  );
  const [locked, setLocked] = useState(initial.kind === "locked" ? initial.record : null);
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
  const update = (patch: Partial<Project>) => change((current) => ({ ...current, ...patch }));

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
          await writeLocal(latestProject.current, key);
          activeProtection.current = key;
        });
      writes.current = saved;
      await saved;
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
    if (!locked) return;
    if (unlocking) return;
    setUnlocking(true);
    setPrivacyError("");
    try {
      const result = await unlockLocal(locked, String(password));
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
  };
};
