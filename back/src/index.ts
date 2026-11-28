import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { Agent, ProxyAgent } from "undici";

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
const gigaChatKey = process.env.GIGACHAT_AUTH_KEY?.trim();
const gigaDispatcher = gigaChatKey
  ? new Agent({ connect: { ca: [...rootCertificates, readFileSync(new URL("../certs/gigachat.pem", import.meta.url), "utf8")] } })
  : undefined;

createApp({
  fetchFromDivan: process.env.DIVAN_CATALOG_ENABLED === "1" ? fetch : undefined,
  groqApiKey: process.env.GROQ_API_KEY?.trim(),
  gigaChatKey,
  fetchFromGiga: (input, config) => {
    const options = { ...config, dispatcher: gigaDispatcher } satisfies RequestInit & { dispatcher?: Agent };
    return fetch(input, options);
  },
  avitoMcpUrl: process.env.AVITO_MCP_URL?.trim(),
  fetchFromGroq: (input, config) => {
    const options = { ...config, dispatcher: groqProxy, redirect: "error" } satisfies RequestInit & {
      dispatcher?: ProxyAgent;
    };
    return fetch(input, options);
  }
}).listen(port, host, () => {
  console.log(`Metrika API listening on ${host}:${port}`);
});
