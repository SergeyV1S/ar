import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { createApp } from "../src/app.ts";

const schema = (value: object) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

test("uses regional prices and stock in store order, with dimensions from the exact variant", async (t) => {
  const listPath = "/ekaterinburg/category/stulya";
  const itemPath = "/product/stul-test";
  const discountedPath = "/product/stul-skidka";
  const dimensionsData = {
    id: 1002,
    link: discountedPath,
    parameters: [
      { id: 1, title: "Длина" },
      { id: 2, title: "Ширина" },
      { id: 3, title: "Высота" },
    ],
    parameterValues: [54, 52, 81].map((value, index) => ({
      parameterId: index + 1,
      unitId: 1,
      value: [value],
    })),
    units: [{ id: 1, title: "см" }],
  };
  const publicDimensions = `<script>self.__next_f.push([1,${JSON.stringify(`a:${JSON.stringify(dimensionsData)}\n`)}])</script>`;
  const cityMarkup = `<a href="${listPath}">Екатеринбург</a>`;
  const requests: string[] = [];
  const app = createApp({
    fetchFromDivan: async (input) => {
      const { pathname } = new URL(String(input));
      requests.push(pathname);
      if (pathname === "/category/stulya") return new Response(cityMarkup);
      if (pathname === listPath)
        return new Response(`
        <link rel="canonical" href="https://www.divan.ru${listPath}">
        <span>Самые популярные</span>
        ${schema({
          "@type": "ItemList",
          itemListElement: [
            {
              position: 3,
              item: {
                "@type": "Product",
                url: `https://www.divan.ru${discountedPath}`,
                offers: {
                  price: "7490",
                  priceCurrency: "RUB",
                  availability: "https://schema.org/PreOrder",
                },
              },
            },
            {
              position: 2,
              item: {
                "@type": "Product",
                url: "https://www.divan.ru/product/stul-nepolnyi",
                offers: {
                  price: "8990",
                  priceCurrency: "RUB",
                  availability: "https://schema.org/InStock",
                },
              },
            },
            {
              position: 1,
              item: {
                "@type": "Product",
                url: `https://www.divan.ru${itemPath}`,
                offers: {
                  price: "9291",
                  priceCurrency: "RUB",
                  availability: "https://schema.org/InStock",
                },
              },
            },
          ],
        })}
        <article data-testid="product-card"><a href="${itemPath}">Стул Тест</a>
          <div class="test_prices">9 291 руб.9 990 руб.–7%</div>
          <div>В наличии: 3 шт.</div>
        </article>
        <article data-testid="product-card"><a href="${discountedPath}">Стул со скидкой</a>
          <div class="test_prices">7 490 руб.8 490 руб.–12%</div>
          <div>В наличии в других цветах</div>
        </article>
        <a href="${listPath}/page-2"><button data-testid="show-more-button">Показать еще</button></a>
      `);
      const dimensions =
        pathname === itemPath
          ? "<span>Ширина 52 см</span><span>Глубина 54 см</span><span>Высота 81 см</span>"
          : "<span>Ширина 52 см</span><span>Высота 81 см</span>";
      return new Response(`
        ${schema({ "@type": "Product", name: pathname === discountedPath ? "Стул Велюр" : "Стул Тест", sku: pathname === discountedPath ? "1002" : "1001", image: ["https://cdn.servicecdn.ru/example.jpg"], offers: { url: `https://www.divan.ru${pathname}`, price: "7990" } })}
        ${pathname === discountedPath ? publicDimensions : "<div><span>Без промокода</span></div>"}
        <div><span>Размеры: </span>${dimensions}</div>
        <div><span>Высота сиденья: </span><span>46 см</span></div>
        <div><span>Материал ножек (опор): </span><span>Массив дуба</span></div>
      `);
    },
  });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/api/catalog`;
  const cities = await (await fetch(`${endpoint}/cities`)).json();
  assert.ok(
    cities.cities.some((city: { id: string }) => city.id === "ekaterinburg"),
  );

  const url = `${endpoint}/offers?city=ekaterinburg&category=chair`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const { offers, nextCursor, incomplete } = await response.json();
  assert.equal(offers.length, 2);
  assert.equal(offers[0].photo, "https://cdn.servicecdn.ru/example.jpg");
  assert.deepEqual(
    {
      sku: offers[0].sku,
      price: offers[0].price,
      stock: offers[0].stock,
      dimensions: [offers[0].w, offers[0].d, offers[0].h],
      materials: offers[0].materials,
    },
    {
      sku: "1001",
      price: 9990,
      stock: 3,
      dimensions: [0.52, 0.54, 0.81],
      materials: ["Массив"],
    },
  );
  assert.deepEqual(
    {
      sku: offers[1].sku,
      price: offers[1].price,
      availability: offers[1].availability,
      depth: offers[1].d,
    },
    { sku: "1002", price: 7490, availability: "made-to-order", depth: 0.54 },
  );
  assert.equal(nextCursor, "2.0");
  assert.equal(incomplete, false);
  const numberOfReads = requests.length;
  assert.equal((await fetch(url)).status, 200);
  const filtered = await (await fetch(`${url}&maxPrice=8000&maxWidth=0.52&material=${encodeURIComponent("Ткань")}`)).json();
  assert.deepEqual(filtered.offers.map((offer: { sku: string }) => offer.sku), ["1002"]);
  assert.equal(requests.length, numberOfReads);
});

test("keeps the external source disabled when it is not configured", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/catalog/cities`,
  );
  assert.equal(response.status, 503);
});
