import { isRecord } from "../../../shared/helpers/index.ts";
import type { EncryptedRecord, Project, Protection } from "../types/index.ts";
import { initialProject } from "./project.ts";
import { validateImport } from "./validateImport.ts";

const storageKey = "metrika-project-v1";
const to64 = (data: Uint8Array<ArrayBuffer>) =>
  btoa(Array.from(data, (byte) => String.fromCharCode(byte)).join(""));
const from64 = (input: string) => Uint8Array.from(atob(input), (char) => char.charCodeAt(0));

const keyFor = async (password: string, salt: Uint8Array<ArrayBuffer>) => {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

type SavedProject =
  | { kind: "ready"; project: Project }
  | { kind: "locked"; record: EncryptedRecord }
  | { kind: "unreadable"; project: Project };

export const readEncryptedRecord = (raw: unknown): EncryptedRecord | null => {
  if (!isRecord(raw) || raw.encrypted !== true) return null;
  if (typeof raw.salt !== "string" || typeof raw.iv !== "string" || typeof raw.body !== "string")
    throw new Error("Повреждён зашифрованный проект.");
  return { encrypted: true, salt: raw.salt, iv: raw.iv, body: raw.body };
};

export const needsProtection = (project: Project) =>
  project.mode === "office" ||
  project.items.some((item) => !item.owned && item.mode === "office") ||
  Object.values(project.procurement).some((value) => value.trim());

export const readLocal = (): SavedProject => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    const encrypted = readEncryptedRecord(raw);
    if (encrypted) return { kind: "locked", record: encrypted };
    return { kind: "ready", project: raw === null ? initialProject() : validateImport(raw) };
  } catch {
    return { kind: "unreadable", project: initialProject() };
  }
};

export const newProtection = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt, key: await keyFor(password, salt) };
};

export const unlockLocal = async (record: EncryptedRecord, password: string) => {
  const salt = from64(record.salt),
    key = await keyFor(password, salt);
  const text = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: from64(record.iv) },
    key,
    from64(record.body)
  );
  return {
    protection: { key, salt },
    project: validateImport(JSON.parse(new TextDecoder().decode(text)))
  };
};

export const serializeProject = async (project: Project, protection: Protection | null) => {
  if (!protection) {
    if (needsProtection(project)) throw new Error("Задайте пароль служебного проекта.");
    return JSON.stringify(project);
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    protection.key,
    new TextEncoder().encode(JSON.stringify(project))
  );
  return JSON.stringify({
    encrypted: true,
    salt: to64(protection.salt),
    iv: to64(iv),
    body: to64(new Uint8Array(body))
  });
};

export const writeLocal = async (project: Project, protection: Protection | null) => {
  localStorage.setItem(storageKey, await serializeProject(project, protection));
};
