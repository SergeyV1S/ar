import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { test } from "node:test";
import sharp from "sharp";

import { createApp } from "../src/app.ts";

const origin = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
};

test("retries individual Ultra stages and deletes temporary visuals", async (t) => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(24)]);
  const avif = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#39c" }
  }).avif().toBuffer();
  const roomPhoto = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const ids = [1, 2, 3].map((value) => `10000000-0000-4000-8000-00000000000${value}`);
  const catalogPhoto = "https://cdn.servicecdn.ru/chair.jpg";
  const position = { x: 1, y: 0.4, r: 37 };
  const deleted = new Set<string>();
  let uploads = 0;
  let downloads = 0;
  let requests = 0;
  let uploadInterrupted = false;
  let descriptionThrottled = false;
  let missingImage = false;
  const server = createServer(createApp({
    gigaChatKey: "fixture",
    fetchCatalogPhoto: async (url) => {
      downloads++;
      assert.equal(url, catalogPhoto);
      return new Response(Uint8Array.from(avif), { headers: { "Content-Type": "image/avif" } });
    },
    fetchFromGiga: async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/oauth"))
        return Response.json({ access_token: "token", expires_at: Date.now() + 300_000 });
      if (path === "/v1/files") {
        if (!uploadInterrupted) {
          uploadInterrupted = true;
          throw new TypeError("fetch failed", { cause: { code: "EAI_AGAIN" } });
        }
        assert(init?.body instanceof FormData);
        assert.equal(init.body.get("purpose"), "general");
        const photo = init.body.get("file");
        assert(photo instanceof Blob);
        assert.equal(photo.type, "image/jpeg");
        return Response.json({ id: ids[uploads++] });
      }
      if (path.endsWith("/delete")) {
        deleted.add(path.split("/")[3]);
        return Response.json({});
      }
      if (path.endsWith("/content")) {
        assert.equal(path, `/v1/files/${ids[2]}/content`);
        return new Response(jpeg);
      }
      assert.equal(path, "/v1/chat/completions");
      const request = JSON.parse(String(init?.body));
      assert.equal(request.model, "GigaChat-3-Ultra");
      requests++;
      if (request.function_call === undefined) {
        if (!descriptionThrottled) {
          descriptionThrottled = true;
          return Response.json({}, { status: 429, headers: { "Retry-After": "0" } });
        }
        const attachments = request.messages.flatMap((message: { attachments?: string[] }) => message.attachments ?? []);
        assert.deepEqual(new Set(attachments), new Set(ids.slice(0, 2)));
        const sceneText = request.messages.at(-1).content;
        assert(!sceneText.includes(roomPhoto) && !sceneText.includes(catalogPhoto));
        const scene = JSON.parse(sceneText.slice(sceneText.indexOf("{")));
        assert.equal(scene.items.length, 1);
        assert.deepEqual(scene.items[0].position, position);
        return Response.json({ choices: [{ message: { content: "Синий стул у окна" } }] });
      }
      assert.equal(request.function_call, "auto");
      assert.equal(request.messages.length, 1);
      assert.match(request.messages[0].content, /Синий стул у окна/);
      if (!missingImage) {
        missingImage = true;
        return Response.json({ choices: [{ message: { content: "Не удалось создать изображение" } }] });
      }
      return Response.json({ choices: [{ message: { content: `<img src="${ids[2]}" fuse="true"/>` } }] });
    }
  }));
  t.after(() => server.close());
  const url = `${await origin(server)}/api/planner/visualizations`;
  const plan = {
    room: { points: [[0, 0], [5, 0], [5, 4], [0, 4]], openings: [] },
    items: [{ id: "chair", name: "Стул", position }, { id: "unplaced", name: "Стол" }]
  };
  const send = (body: object) => fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const invalid = await send({ plan, roomPhoto: "https://example.com/room.jpg" });
  assert.equal(invalid.status, 400);
  await invalid.body?.cancel();
  assert.equal(uploads, 0);
  const response = await send({ plan, roomPhoto, references: [
    { itemIds: ["chair"], photo: catalogPhoto },
    { itemIds: ["chair"], photo: "https://example.com/invalid.jpg" },
    { itemIds: ["unplaced"], photo: "https://c90.img.avito.st/example.jpg" }
  ] });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
  assert.equal(requests, 4);
  assert.equal(uploads, 2);
  assert.equal(downloads, 1);
  assert.deepEqual(deleted, new Set(ids));
});

test("sends the current plan to Ultra and keeps only evidenced budget, size and replacement", async (t) => {
  const phrase = "Замени мой диван тканевым шириной до 2 м. Нужен стол 50 на 50.";
  const input = {
    phrase, budget: 80000, passage: 0.8,
    room: { points: [[0, 0], [5, 0], [5, 4], [0, 4]], openings: [] },
    items: [{ id: "old", name: "Диван", kind: "sofa", owned: true,
      position: { x: 1, y: 0.2, r: 37 }, w: 2.1, h: 0.9, d: 0.8 }]
  };
  const server = createApp({
    gigaChatKey: "fixture",
    fetchFromGiga: async (url, init) => {
      if (String(url).includes("/oauth")) {
        assert.equal(new Headers(init?.headers).get("Authorization"), "Basic fixture");
        return Response.json({ access_token: "token", expires_at: Date.now() + 300_000 });
      }
      const request = JSON.parse(String(init?.body));
      assert.equal(request.model, "GigaChat-3-Ultra");
      const context = JSON.parse(request.messages[1].content);
      assert.deepEqual(context.items[0].position, input.items[0].position);
      assert.equal(context.budget, undefined);
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        summary: "Подобрать диван. Бюджет 80 000 ₽.", budget: 50000, budgetQuote: "общий бюджет 50000",
        layout: { variant: 1, reason: "Больше свободного места" },
        wishes: [
          { name: "Диван", query: "диван", category: "sofa", quantity: 1,
            replaceId: "old", replaceQuote: "Замени мой диван", maxWidth: 2, sizeQuote: "шириной до 2 м" },
          { name: "Стул", query: "стул", category: "chair", quantity: 1,
            replaceId: "unexpected", maxWidth: 5, material: "Массив", maxUnit: 8000 },
          { name: "Стол", query: "стол", category: "table", quantity: 1,
            sizeQuote: "50 на 50", maxWidth: 0.5, maxDepth: 0.5, maxHeight: 0.8 }
        ]
      }) } }] });
    }
  }).listen(0, "127.0.0.1");
  t.after(() => server.close());
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/planner/analysis`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.budget, undefined);
  assert.doesNotMatch(result.summary, /80 000|₽/);
  assert.equal(result.wishes[1].material, undefined);
  assert.equal(result.wishes[1].maxUnit, undefined);
  assert.equal(result.wishes[0].maxWidth, 2);
  assert.equal(result.wishes[0].replaceId, "old");
  assert.equal(result.wishes[1].maxWidth, undefined);
  assert.equal(result.wishes[1].replaceId, undefined);
  assert.equal(result.wishes[2].maxWidth, 0.5);
  assert.equal(result.wishes[2].maxDepth, 0.5);
  assert.equal(result.wishes[2].maxHeight, undefined);
  assert.equal(result.layout.variant, 1);
});

test("finds matching secondhand furniture through the MCP search tool", async (t) => {
  const mcp = createServer(async (request, response) => {
    if (request.method === "DELETE") {
      response.writeHead(204).end();
      return;
    }
    const chunks: string[] = [];
    for await (const chunk of request) chunks.push(String(chunk));
    const message = JSON.parse(chunks.join(""));
    if (message.method === "initialize") {
      response.writeHead(200, { "Content-Type": "application/json", "Mcp-Session-Id": "fixture" });
      response.end(JSON.stringify({ id: message.id, result: { protocolVersion: "2025-03-26" } }));
      return;
    }
    assert.equal(request.headers["mcp-session-id"], "fixture");
    if (message.method === "notifications/initialized") {
      response.writeHead(202).end();
      return;
    }
    assert.equal(message.params.name, "avito_search");
    assert.equal(message.params.arguments.price_max, 7000);
    const listing = { id: "1234567", url: "https://www.avito.ru/moskva/stul_1234567",
      title: "Стул", price: "5 500 ₽", description: "Ширина: 45 см; Длина: 60 см", location: "Москва",
      photo: "https://img.avito.st/example.jpg" };
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.end(`event: message\ndata: ${JSON.stringify({ id: message.id, result: { structuredContent: {
      items: [
        listing,
        { ...listing, url: "https://www.avito.ru/moskva/divan_1234568", title: "Диван" },
        { ...listing, url: "https://www.avito.ru/moskva/arenda_1234569", title: "Аренда стульев" }
      ]
    } } })}\n\n`);
  });
  const mcpUrl = await origin(mcp);
  t.after(() => mcp.close());
  const app = createServer(createApp({ avitoMcpUrl: mcpUrl }));
  const appUrl = await origin(app);
  t.after(() => app.close());
  const result = await fetch(`${appUrl}/api/catalog/avito/offers?q=stul&city=moskva&category=chair&maxPrice=7000`);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { offers: [{
    url: "https://www.avito.ru/moskva/stul_1234567", name: "Стул", price: 5500, location: "Москва", w: 0.45,
    d: 0.6, photo: "https://img.avito.st/example.jpg"
  }] });
});
