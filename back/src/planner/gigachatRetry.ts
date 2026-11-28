import { setTimeout } from "node:timers/promises";

import { GigaChatError, GigaChatImageMissingError, record } from "./gigachat.ts";

const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const retryableConnections = new Set(["EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);
const maxRetries = 2;

const retryDelay = (error: unknown, retry: number) => {
  const backoff = 1500 * 2 ** retry + Math.floor(Math.random() * 300);
  if (error instanceof GigaChatImageMissingError) return backoff;
  if (error instanceof GigaChatError) {
    if (!retryableStatuses.has(error.status)) return;
    const header = error.retryAfter?.trim();
    if (!header) return backoff;
    const seconds = Number(header);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (!Number.isFinite(delay)) return backoff;
    if (delay <= 20_000) return Math.max(0, delay);
    return;
  }
  if (error instanceof TypeError) {
    const { code } = record(error.cause);
    if (typeof code === "string" && retryableConnections.has(code)) return backoff;
  }
};

export const retryGiga = async <T>(run: () => Promise<T>, signal: AbortSignal) => {
  for (let retry = 0; ; retry++) {
    signal.throwIfAborted();
    try {
      return await run();
    } catch (error: unknown) {
      signal.throwIfAborted();
      const delay = retryDelay(error, retry);
      if (retry >= maxRetries || delay === undefined) throw error;
      await setTimeout(delay, undefined, { signal });
    }
  }
};
