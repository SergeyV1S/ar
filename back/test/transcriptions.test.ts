import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { TestContext } from "node:test";

import { createApp } from "../src/app.ts";

const openTranscriptions = async (t: TestContext, options: Parameters<typeof createApp>[0]) => {
  const server = createApp(options).listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return (body: FormData) =>
    fetch(`http://127.0.0.1:${address.port}/api/speech/transcriptions`, { method: "POST", body });
};

const audioBytes = (size = 8) => new Uint8Array(size).fill(42);

const audio = (type = "audio/webm", data = audioBytes()) => {
  const form = new FormData();
  form.set("file", new Blob([data], { type }), "voice");
  return form;
};

test("transcribes a recording through Groq and returns the text", async (t) => {
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    fetchFromGroq: async (input, init) => {
      const request = new Request(input, init);
      assert.equal(request.url, "https://api.groq.com/openai/v1/audio/transcriptions");
      assert.equal(request.headers.get("authorization"), "Bearer test-key");
      const form = await request.formData();
      assert.equal(form.get("model"), "whisper-large-v3-turbo");
      assert.equal(form.get("language"), "ru");
      assert.equal(form.get("temperature"), "0");
      assert.equal(form.get("response_format"), "json");
      const file = form.get("file");
      assert.ok(file instanceof File);
      assert.equal(file.name, "recording.webm");
      assert.equal(file.type, "audio/webm");
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), audioBytes());
      return Response.json({ text: " Комната 4 на 3. " });
    }
  });

  const response = await upload(audio());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: "Комната 4 на 3." });
});

test("forwards a WAV upload to Groq with a WAV filename", async (t) => {
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    fetchFromGroq: async (input, init) => {
      const form = await new Request(input, init).formData();
      const file = form.get("file");
      assert.ok(file instanceof File);
      assert.equal(file.name, "recording.wav");
      assert.equal(file.type, "audio/wav");
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), audioBytes());
      return Response.json({ text: "Бюджет 80 тысяч." });
    }
  });

  const response = await upload(audio("audio/wav"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: "Бюджет 80 тысяч." });
});

test("rejects invalid uploads without contacting Groq", async (t) => {
  let contactedGroq = false;
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    fetchFromGroq: async () => {
      contactedGroq = true;
      return Response.json({ text: "Unexpected transcription" });
    }
  });

  const missing = await upload(new FormData());
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { code: "MISSING_FILE" });

  const empty = await upload(audio("audio/webm", audioBytes(0)));
  assert.equal(empty.status, 422);
  assert.deepEqual(await empty.json(), { code: "UNREADABLE_AUDIO" });

  const unsupported = await upload(audio("text/plain"));
  assert.equal(unsupported.status, 415);
  assert.deepEqual(await unsupported.json(), { code: "UNSUPPORTED_FORMAT" });

  const oversized = await upload(audio("audio/webm", audioBytes(10 * 1024 * 1024 + 1)));
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { code: "FILE_TOO_LARGE" });
  assert.equal(contactedGroq, false);
});

test("accepts a recording at the 10 MiB size limit", async (t) => {
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    fetchFromGroq: async () => Response.json({ text: "Комната 4 на 3." })
  });

  const response = await upload(audio("audio/webm", audioBytes(10 * 1024 * 1024)));
  assert.equal(response.status, 200);
});

test("reports unavailable speech recognition when configured without a key", async (t) => {
  const upload = await openTranscriptions(t, {});
  const response = await upload(audio());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: "SPEECH_UNAVAILABLE" });
});

test("passes along the Groq quota status and retry time", async (t) => {
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    fetchFromGroq: async () => new Response(null, { status: 429, headers: { "Retry-After": "60" } })
  });
  const response = await upload(audio());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.deepEqual(await response.json(), { code: "RATE_LIMITED" });
});

test("reports empty transcriptions and unreadable audio", async (t) => {
  const results = [Response.json({ text: "  " }), new Response(null, { status: 422 })];
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    fetchFromGroq: async () => {
      const result = results.shift();
      assert.ok(result);
      return result;
    }
  });
  const empty = await upload(audio("audio/mp4"));
  assert.equal(empty.status, 422);
  assert.deepEqual(await empty.json(), { code: "NO_SPEECH" });

  const unreadable = await upload(audio("audio/ogg"));
  assert.equal(unreadable.status, 422);
  assert.deepEqual(await unreadable.json(), { code: "UNREADABLE_AUDIO" });
});

test("reports an invalid response from Groq as an upstream error", async (t) => {
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    fetchFromGroq: async () => Response.json({ text: 123 })
  });
  const response = await upload(audio());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { code: "GROQ_ERROR" });
});

test("cancels a slow Groq request and reports a timeout", async (t) => {
  const upload = await openTranscriptions(t, {
    groqApiKey: "test-key",
    groqTimeoutMs: 10,
    fetchFromGroq: (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        assert.ok(signal);
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
  });
  const response = await upload(audio());
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { code: "GROQ_TIMEOUT" });
});
