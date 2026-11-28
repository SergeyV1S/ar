import express from "express";
import type { RequestHandler } from "express";
import multer from "multer";

import { createCatalogRouter } from "./catalog/index.ts";
import { createAvitoRouter } from "./catalog/avito.ts";
import { createGigaChat } from "./planner/gigachat.ts";
import { createPlannerRouter } from "./planner/index.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const AUDIO_EXTENSIONS = new Map([
  ["audio/webm", "webm"],
  ["audio/mp4", "mp4"],
  ["audio/ogg", "ogg"],
  ["audio/wav", "wav"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"]
]);

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 }
}).single("file");

const receiveAudio: RequestHandler = (request, response, next) => {
  uploadAudio(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({ code: "FILE_TOO_LARGE" });
      return;
    }
    if (error) {
      response.status(400).json({ code: "INVALID_UPLOAD" });
      return;
    }
    next();
  });
};

type AppOptions = {
  fetchFromDivan?: typeof fetch;
  groqApiKey?: string;
  fetchFromGroq?: typeof fetch;
  groqTimeoutMs?: number;
  gigaChatKey?: string;
  fetchFromGiga?: typeof fetch;
  fetchCatalogPhoto?: typeof fetch;
  avitoMcpUrl?: string;
};

export const createApp = ({
  fetchFromDivan,
  groqApiKey,
  fetchFromGroq = fetch,
  groqTimeoutMs = 30_000,
  gigaChatKey,
  fetchFromGiga,
  fetchCatalogPhoto,
  avitoMcpUrl
}: AppOptions = {}) => {
  const app = express();
  const giga = gigaChatKey && createGigaChat(gigaChatKey, fetchFromGiga);
  app.disable("x-powered-by");
  app.use("/api/planner", createPlannerRouter(giga || undefined, fetchCatalogPhoto));
  app.use("/api/catalog/avito", createAvitoRouter(avitoMcpUrl));
  app.use("/api/catalog", createCatalogRouter(fetchFromDivan));

  app.post("/api/speech/transcriptions", receiveAudio, async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ code: "MISSING_FILE" });
      return;
    }
    const extension = AUDIO_EXTENSIONS.get(file.mimetype);
    if (!extension) {
      response.status(415).json({ code: "UNSUPPORTED_FORMAT" });
      return;
    }
    if (file.size === 0) {
      response.status(422).json({ code: "UNREADABLE_AUDIO" });
      return;
    }
    if (!groqApiKey) {
      response.status(503).json({ code: "SPEECH_UNAVAILABLE" });
      return;
    }

    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      `recording.${extension}`
    );
    form.set("model", "whisper-large-v3-turbo");
    form.set("language", "ru");
    form.set("temperature", "0");
    form.set("response_format", "json");

    const client = new AbortController();
    const timeout = AbortSignal.timeout(groqTimeoutMs);
    const cancel = () => client.abort();
    if (response.destroyed) return;
    response.once("close", cancel);

    try {
      const result = await fetchFromGroq(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: form,
        signal: AbortSignal.any([client.signal, timeout])
      });

      if (!result.ok) {
        await result.body?.cancel();
        if (result.status === 429) {
          const retryAfter = result.headers.get("retry-after");
          if (retryAfter) response.set("Retry-After", retryAfter);
          response.status(429).json({ code: "RATE_LIMITED" });
          return;
        }
        if (result.status === 400 || result.status === 422) {
          response.status(422).json({ code: "UNREADABLE_AUDIO" });
          return;
        }
        response.status(502).json({ code: "GROQ_ERROR" });
        return;
      }

      const payload: unknown = await result.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("text" in payload) ||
        typeof payload.text !== "string"
      ) {
        response.status(502).json({ code: "GROQ_ERROR" });
        return;
      }
      const text = payload.text.trim();
      if (!text) {
        response.status(422).json({ code: "NO_SPEECH" });
        return;
      }
      response.json({ text });
    } catch {
      if (client.signal.aborted) return;
      if (timeout.aborted) {
        response.status(504).json({ code: "GROQ_TIMEOUT" });
        return;
      }
      response.status(502).json({ code: "GROQ_ERROR" });
    } finally {
      response.off("close", cancel);
    }
  });

  return app;
};
