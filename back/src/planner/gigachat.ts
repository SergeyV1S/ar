import { randomUUID } from "node:crypto";

const model = "GigaChat-3-Ultra";
const api = "https://api.giga.chat/v1";
const oauth = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";

export class GigaChatError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(status: number, retryAfter: string | null) {
    super(`GigaChat API HTTP ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

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

  const complete = async (system: string, content: string, signal: AbortSignal) => {
    const bearer = await accessToken();
    const response = await send(`${api}/chat/completions`, {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json",
        "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.15, max_tokens: 2500,
        messages: [{ role: "system", content: system }, { role: "user", content }] }),
      signal
    });
    if (!response.ok) {
      if (response.status === 401 && token?.value === bearer) token = undefined;
      await response.body?.cancel();
      throw new GigaChatError(response.status, response.headers.get("retry-after"));
    }
    return readMessage(await response.json());
  };

  return { complete };
};
