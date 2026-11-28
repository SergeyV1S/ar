import { randomUUID } from "node:crypto";

const model = "GigaChat-3-Ultra";
const api = "https://api.giga.chat/v1";
const oauth = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const fileIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

type Message = { role: "system" | "user"; content: string; attachments?: string[] };

export class GigaChatError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(status: number, retryAfter: string | null) {
    super(`GigaChat API HTTP ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export class GigaChatImageMissingError extends Error {}

export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};

const readMessage = (payload: unknown) => {
  const choices = record(payload).choices;
  const content = Array.isArray(choices) && record(record(choices[0]).message).content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty GigaChat answer");
  return content.trim();
};

export const createGigaChat = (key: string, send: typeof fetch = fetch) => {
  let token: { value: string; expiresAt: number } | undefined;
  let pending: Promise<NonNullable<typeof token>> | undefined;

  const authorize = async () => {
    const response = await send(oauth, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Basic ${key}`,
        RqUID: randomUUID(),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams({ scope: "GIGACHAT_API_PERS" }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new GigaChatError(response.status, response.headers.get("retry-after"));
    }
    const { access_token, expires_at } = record(await response.json());
    if (typeof access_token !== "string" || typeof expires_at !== "number")
      throw new Error("Malformed GigaChat token");
    return {
      value: access_token,
      expiresAt: expires_at < 1e12 ? expires_at * 1000 : expires_at
    };
  };

  const accessToken = async () => {
    if (token && Date.now() < token.expiresAt - 30_000) return token.value;
    pending ??= authorize().finally(() => { pending = undefined; });
    token = await pending;
    return token.value;
  };

  const request = async (path: string, init: RequestInit) => {
    const bearer = await accessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${bearer}`);
    const response = await send(`${api}${path}`, {
      ...init,
      redirect: "error",
      headers
    });
    if (!response.ok) {
      if (response.status === 401 && token?.value === bearer) token = undefined;
      await response.body?.cancel();
      throw new GigaChatError(response.status, response.headers.get("retry-after"));
    }
    return response;
  };

  const completeMessages = async (
    messages: Message[], signal: AbortSignal, options: { max_tokens: number; temperature: number } |
      { function_call: "auto" }
  ) => {
    const response = await request("/chat/completions", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ model, ...options, messages }),
      signal
    });
    return readMessage(await response.json());
  };

  const complete = (system: string, content: string, signal: AbortSignal, maxTokens = 2500) =>
    completeMessages([{ role: "system", content: system }, { role: "user", content }], signal,
      { temperature: 0.15, max_tokens: maxTokens });

  const describe = (instruction: string, scene: string, photos: { label: string; id: string }[],
    signal: AbortSignal) => completeMessages([
    { role: "system", content: instruction },
    ...photos.map(({ label, id }): Message => ({
      role: "user", content: label, attachments: [id]
    })),
    { role: "user", content: scene }
  ], signal, { temperature: 0.15, max_tokens: 2200 });

  const generate = async (content: string, signal: AbortSignal) => {
    const answer = await completeMessages([{ role: "user", content }], signal, { function_call: "auto" });
    const id = answer.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    if (!id || !fileIdPattern.test(id)) throw new GigaChatImageMissingError("GigaChat did not generate an image");
    return id;
  };

  const uploadImage = async (image: Blob, signal: AbortSignal) => {
    const form = new FormData();
    form.set("purpose", "general");
    form.set("file", image, image.type === "image/png" ? "reference.png" : "reference.jpg");
    const response = await request("/files", { method: "POST", body: form, signal });
    const { id } = record(await response.json());
    if (typeof id !== "string" || !fileIdPattern.test(id)) throw new Error("Invalid GigaChat file ID");
    return id;
  };

  const downloadImage = (id: string, signal: AbortSignal) =>
    request(`/files/${id}/content`, { headers: { Accept: "image/jpeg, image/png" }, signal });

  const deleteFile = async (id: string, signal: AbortSignal) => {
    const response = await request(`/files/${id}/delete`, {
      method: "POST", signal
    });
    await response.body?.cancel();
  };

  return { complete, describe, generate, uploadImage, downloadImage, deleteFile };
};
