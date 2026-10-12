import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { getRendererBrowserLaunchOptions } from "../src/cli/browserLaunch.js";
import { readFile } from "node:fs/promises";
import http from "node:http";

// An input takes focus on its hidden DOM control from Pixi's pointerdown.
// After a touch, the browser also sends compatibility mouse events to the
// canvas; their mousedown would move focus to the page and close the
// on-screen keyboard as soon as it opened. A tap and a click must leave the
// field focused and typable, and a tap or click outside must still blur it.

const bundle = await readFile(
  new URL("../dist/RouteGraphics.js", import.meta.url),
);
const server = http.createServer((req, res) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;",
  );
  res.setHeader(
    "Content-Type",
    req.url.endsWith(".js") ? "text/javascript" : "text/html",
  );
  res.end(
    req.url.endsWith(".js")
      ? bundle
      : "<!doctype html><body style='margin:0'></body>",
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const RENDERER = { width: 400, height: 300 };
const INPUT = { x: 20, y: 20, width: 200, height: 40 };

const setUpInput = async (page) => {
  await page.goto(url);
  await page.evaluate(
    async ({ renderer, input }) => {
      const m = await import("/bundle.js");
      const app = m.default();
      window.inputEvents = [];
      await app.init({
        ...renderer,
        rendererPreference: "webgl",
        rendererFallback: true,
        plugins: {
          elements: [m.rectPlugin, m.textPlugin, m.inputPlugin],
          audio: [],
        },
        eventHandler: (name) => {
          if (["focus", "blur", "change"].includes(name)) {
            window.inputEvents.push(name);
          }
        },
      });
      document.body.append(app.canvas);
      app.render({
        elements: [
          {
            id: "name",
            type: "input",
            ...input,
            focusEvent: { payload: {} },
            blurEvent: { payload: {} },
            change: { payload: {} },
          },
        ],
      });
    },
    { renderer: RENDERER, input: INPUT },
  );
};

// A renderer point as a point on the page.
const toPagePoint = async (page, x, y) =>
  page.evaluate(
    ({ x, y, renderer }) => {
      const rect = document.querySelector("canvas").getBoundingClientRect();
      return {
        x: rect.left + (x * rect.width) / renderer.width,
        y: rect.top + (y * rect.height) / renderer.height,
      };
    },
    { x, y, renderer: RENDERER },
  );

const readInput = (page) =>
  page.evaluate(() => ({
    focused: document.activeElement?.dataset?.routeGraphicsInputId ?? null,
    value: document.querySelector('[data-route-graphics-input-id="name"]')
      ?.value,
    events: [...window.inputEvents],
  }));

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

const checkInput = async ({ page, press, label }) => {
  await setUpInput(page);
  const inside = await toPagePoint(
    page,
    INPUT.x + INPUT.width / 2,
    INPUT.y + INPUT.height / 2,
  );
  const outside = await toPagePoint(page, 300, 250);

  await press(inside);
  await settle();
  const afterPress = await readInput(page);
  assert.equal(afterPress.focused, "name", `${label}: the field takes focus`);
  assert.deepEqual(
    afterPress.events,
    ["focus"],
    `${label}: the field is not blurred after it takes focus`,
  );

  await page.keyboard.type("Hi");
  await settle();
  const afterTyping = await readInput(page);
  assert.equal(afterTyping.value, "Hi", `${label}: typing reaches the field`);
  assert.equal(afterTyping.focused, "name", `${label}: typing keeps focus`);

  await press(outside);
  await settle();
  const afterOutside = await readInput(page);
  assert.equal(afterOutside.focused, null, `${label}: outside blurs the field`);
  assert.equal(
    afterOutside.events.at(-1),
    "blur",
    `${label}: outside emits blur`,
  );
};

const browsers = [
  {
    name: "chromium",
    launch: () =>
      chromium.launch(
        getRendererBrowserLaunchOptions(
          process.env.ROUTE_GRAPHICS_TEST_BROWSER,
        ),
      ),
  },
  { name: "webkit", launch: () => webkit.launch() },
];

try {
  for (const { name, launch } of browsers) {
    const browser = await launch();
    try {
      const touchContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        // WebKit's emulation takes no isMobile.
        isMobile: name === "chromium",
        hasTouch: true,
      });
      const touchPage = await touchContext.newPage();
      await checkInput({
        page: touchPage,
        press: ({ x, y }) => touchPage.touchscreen.tap(x, y),
        label: `${name} touch`,
      });
      await touchContext.close();

      const mouseContext = await browser.newContext({
        viewport: { width: 800, height: 600 },
      });
      const mousePage = await mouseContext.newPage();
      await checkInput({
        page: mousePage,
        press: ({ x, y }) => mousePage.mouse.click(x, y),
        label: `${name} mouse`,
      });
      await mouseContext.close();
    } finally {
      await browser.close();
    }
  }
  console.log("Input touch focus checks passed");
} finally {
  server.close();
}
