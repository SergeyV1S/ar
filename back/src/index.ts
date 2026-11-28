import { createApp } from "./app.ts";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);

createApp({ groqApiKey: process.env.GROQ_API_KEY?.trim() }).listen(port, host, () => {
  console.log(`Speech API listening on ${host}:${port}`);
});
