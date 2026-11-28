import { ProxyAgent } from "undici";

import { createApp } from "./app.ts";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);

const createGroqProxy = (proxyUrl?: string) => {
  if (!proxyUrl) return;
  try {
    return new ProxyAgent(proxyUrl);
  } catch {
    throw new Error("Invalid GROQ_PROXY_URL");
  }
};

const groqProxy = createGroqProxy(process.env.GROQ_PROXY_URL?.trim());

createApp({
  groqApiKey: process.env.GROQ_API_KEY?.trim(),
  fetchFromGroq: (input, config) => {
    const options = { ...config, dispatcher: groqProxy, redirect: "error" } satisfies RequestInit & {
      dispatcher?: ProxyAgent;
    };
    return fetch(input, options);
  }
}).listen(port, host, () => {
  console.log(`Speech API listening on ${host}:${port}`);
});
