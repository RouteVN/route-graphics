import { chromium } from "playwright";
import assert from "node:assert/strict";
import { getRendererBrowserLaunchOptions } from "../src/cli/browserLaunch.js";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { PNG } from "pngjs";

// Pixi watches wheel on the canvas with a passive listener, so a
// preventDefault() from a Pixi wheel handler is ignored and the browser logs
// "Unable to preventDefault inside passive event listener invocation".
// Wheel input over a scrolling element must run without that error, an
// element that takes the wheel must still keep the page from scrolling, and
// wheel input over empty canvas must still scroll the page.

const bundle = await readFile(
  new URL("../dist/RouteGraphics.js", import.meta.url),
);
const box = new PNG({ width: 16, height: 16 });
for (let i = 0; i < box.data.length; i += 4) {
  box.data.set([40, 120, 200, 255], i);
}
const boxPng = PNG.sync.write(box);

const server = http.createServer((req, res) => {
  if (req.url.endsWith(".png")) {
    res.setHeader("Content-Type", "image/png");
    res.end(boxPng);
    return;
  }
  res.setHeader(
    "Content-Type",
    req.url.endsWith(".js") ? "text/javascript" : "text/html",
  );
  // A page taller than the viewport, so a wheel that is not prevented scrolls it.
  res.end(
    req.url.endsWith(".js")
      ? bundle
      : "<!doctype html><body style='margin:0'><div style='height:3000px'></div></body>",
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const RENDERER = { width: 400, height: 300 };
const OVER_ELEMENT = { x: 200, y: 70 };
const OVER_EMPTY_CANVAS = { x: 350, y: 250 };

const scrollEvents = {
  scrollUp: { payload: { direction: "up" } },
  scrollDown: { payload: { direction: "down" } },
};

const eventCases = [
  {
    name: "rect",
    element: {
      id: "rect-target",
      type: "rect",
      x: 100,
      y: 50,
      width: 200,
      height: 100,
      fill: "#336699",
      ...scrollEvents,
    },
  },
  {
    name: "text",
    element: {
      id: "text-target",
      type: "text",
      x: 100,
      y: 50,
      content: "Scroll here",
      textStyle: { fontSize: 48, fill: "#336699", fontFamily: "Arial" },
      ...scrollEvents,
    },
  },
  {
    name: "sprite with an empty payload",
    element: {
      id: "sprite-target",
      type: "sprite",
      x: 100,
      y: 50,
      width: 200,
      height: 100,
      src: "box",
      scrollUp: {},
      scrollDown: {},
    },
  },
  {
    name: "container",
    element: {
      id: "container-target",
      type: "container",
      x: 100,
      y: 50,
      width: 200,
      height: 100,
      children: [
        {
          id: "container-fill",
          type: "rect",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          fill: "#336699",
        },
      ],
      ...scrollEvents,
    },
  },
];

// A scrolling container takes the wheel through Pixi alone. A rect that
// listens for scrollUp also puts a blocking wheel listener on the canvas,
// which makes every wheel event over the canvas cancelable.
const scrollingContainerScene = [
  {
    id: "scroll-target",
    type: "container",
    x: 100,
    y: 50,
    width: 200,
    height: 100,
    direction: "vertical",
    gapY: 8,
    scroll: true,
    children: Array.from({ length: 6 }, (_, index) => ({
      id: `row-${index}`,
      type: "rect",
      width: 180,
      height: 40,
      fill: "#336699",
    })),
  },
  {
    id: "side-target",
    type: "rect",
    x: 20,
    y: 200,
    width: 100,
    height: 60,
    fill: "#996633",
    scrollUp: { payload: { direction: "up" } },
  },
];

const browser = await chromium.launch(
  getRendererBrowserLaunchOptions(process.env.ROUTE_GRAPHICS_TEST_BROWSER),
);
try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
  });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  await page.goto(url);
  await page.evaluate(async (renderer) => {
    const m = await import("/bundle.js");
    const app = m.default();
    window.app = app;
    window.scrollEvents = [];
    await app.init({
      ...renderer,
      rendererPreference: "webgl",
      rendererFallback: true,
      plugins: {
        elements: [
          m.rectPlugin,
          m.textPlugin,
          m.spritePlugin,
          m.containerPlugin,
        ],
        audio: [],
      },
      eventHandler: (eventName) => {
        if (eventName.startsWith("scroll")) {
          window.scrollEvents.push(eventName);
        }
      },
    });
    document.body.prepend(app.canvas);
    await app.loadAssets({
      box: { url: "/box.png", type: "image/png", source: "url" },
    });
  }, RENDERER);

  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

  // Render a scene and wheel once over a point, starting from a page that is
  // scrolled to the top and a pointer that has left the canvas.
  const wheelOver = async ({ elements, point }) => {
    await page.evaluate(async (elements) => {
      window.scrollEvents.length = 0;
      window.scrollTo(0, 0);
      window.app.render({ elements });
      await window.app.whenRenderReady();
    }, elements);
    problems.length = 0;
    await page.mouse.move(700, 500);
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, 40);
    await settle();
    return page.evaluate(() => ({
      events: [...window.scrollEvents],
      pageScrollY: window.scrollY,
      contentY: window.app.findElementByLabel("scroll-target-content")?.y,
    }));
  };

  // The page does scroll when nothing takes the wheel, so a page that stays
  // put below is the element's doing.
  const control = await wheelOver({
    elements: [eventCases[0].element],
    point: OVER_EMPTY_CANVAS,
  });
  assert.ok(
    control.pageScrollY > 0,
    "wheel over empty canvas scrolls the page",
  );
  assert.deepEqual(problems, [], "wheel over empty canvas logs no error");

  for (const { name, element } of eventCases) {
    const result = await wheelOver({
      elements: [element],
      point: OVER_ELEMENT,
    });
    assert.deepEqual(problems, [], `${name}: wheel logs no browser error`);
    assert.deepEqual(
      result.events,
      ["scrollDown"],
      `${name}: wheel down emits scrollDown`,
    );
    assert.equal(
      result.pageScrollY,
      0,
      `${name}: the page does not scroll beneath the element`,
    );
  }

  const scrolled = await wheelOver({
    elements: scrollingContainerScene,
    point: OVER_ELEMENT,
  });
  assert.deepEqual(
    problems,
    [],
    "scrolling container: wheel logs no browser error",
  );
  assert.equal(scrolled.contentY, -40, "scrolling container: content scrolls");
  assert.deepEqual(
    scrolled.events,
    [],
    "scrolling container: no scroll event without scrollUp or scrollDown",
  );

  await context.close();
  console.log("Wheel passive listener checks passed");
} finally {
  await browser.close();
  server.close();
}
