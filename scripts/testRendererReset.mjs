import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { chromium, webkit } from "playwright";

const bundle = await readFile(
  new URL("../dist/RouteGraphics.js", import.meta.url),
);
const server = http.createServer((request, response) => {
  response.setHeader(
    "Content-Type",
    request.url === "/bundle.js" ? "text/javascript" : "text/html",
  );
  response.end(
    request.url === "/bundle.js" ? bundle : "<!doctype html><body></body>",
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (/too many active WebGL|context already lost/i.test(message.text()))
          errors.push(message.text());
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const result = await page.evaluate(async () => {
        const m = await import("/bundle.js");
        const runtime = m.default();
        const events = [];
        let app;
        let createdApplications = 0;
        const originalInit = m.Application.prototype.init;
        m.Application.prototype.init = async function (...args) {
          app = this;
          createdApplications += 1;
          return originalInit.apply(this, args);
        };
        const checks = [];
        try {
          await runtime.init({
            width: 64,
            height: 64,
            plugins: {
              elements: [m.rectPlugin, m.inputPlugin],
              audio: [m.soundPlugin],
            },
            eventHandler: (...args) => events.push(["initial", ...args]),
          });
          const canvas = runtime.canvas;
          const gl = app.renderer.gl;
          document.body.append(canvas);
          // Compare every pixel with a simple geometric oracle. This detects
          // blank output, stale scene content, wrong colors, and bad resizing.
          const matchesFrame = async (width, height, rect, color) => {
            const frame = await runtime.extractCanvas();
            if (frame.width !== width || frame.height !== height) return false;
            const pixels = frame
              .getContext("2d")
              .getImageData(0, 0, width, height).data;
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const expected =
                  x < rect.width && y < rect.height ? color : [0, 0, 0];
                const offset = (y * width + x) * 4;
                if (
                  pixels[offset] !== expected[0] ||
                  pixels[offset + 1] !== expected[1] ||
                  pixels[offset + 2] !== expected[2] ||
                  pixels[offset + 3] !== 255
                )
                  return false;
              }
            }
            return true;
          };
          for (let index = 0; index < 40; index++) {
            const oldScene = {
              elements: [
                {
                  id: "box",
                  type: "rect",
                  width: 20,
                  height: 20,
                  fill: "#00ff00",
                },
              ],
              global: { cursorStyles: { default: "crosshair" } },
            };
            runtime.render(oldScene);
            const oldFrameCorrect = await matchesFrame(
              app.renderer.width,
              app.renderer.height,
              { width: 20, height: 20 },
              [0, 255, 0],
            );
            runtime.render({
              ...oldScene,
              elements: [
                ...oldScene.elements,
                {
                  id: "field",
                  type: "input",
                  y: 30,
                  width: 40,
                  height: 20,
                  value: "old value",
                },
              ],
            });
            const oldBox = runtime.findElementByLabel("box");
            const oldInput = runtime.findElementByLabel("field");
            const oldAudio = app.audioStage;
            await runtime.reset({
              width: 80,
              height: 60,
              eventHandler: (...args) => events.push([index, ...args]),
            });
            checks.push({
              sameCanvas: runtime.canvas === canvas,
              sameContext: app.renderer.gl === gl,
              contextActive: !gl.isContextLost(),
              oldChildrenDestroyed: oldBox.destroyed && oldInput.destroyed,
              emptyStage: runtime.findElementByLabel("box") === null,
              audioReplaced: app.audioStage !== oldAudio,
              oldAudioEmpty: oldAudio._inspect().sounds.size === 0,
              cursorReset: canvas.style.cursor === "default",
              resized: app.renderer.width === 80 && app.renderer.height === 60,
              oldFrameCorrect,
              clearedFrameCorrect: await matchesFrame(
                80,
                60,
                { width: 0, height: 0 },
                [0, 0, 0],
              ),
            });
            runtime.render({
              elements: [
                {
                  id: "box",
                  type: "rect",
                  width: 30,
                  height: 10,
                  fill: "#ff0000",
                },
              ],
            });
            checks.at(-1).newFrameCorrect = await matchesFrame(
              80,
              60,
              { width: 30, height: 10 },
              [255, 0, 0],
            );
          }
          const activeBeforeDestroy = !gl.isContextLost();
          runtime.destroy();
          return {
            checks,
            createdApplications,
            activeBeforeDestroy,
            released: gl.isContextLost(),
            lastHandler: events.at(-1)?.[0],
          };
        } finally {
          m.Application.prototype.init = originalInit;
        }
      });
      assert.equal(result.createdApplications, 1);
      assert.equal(result.checks.length, 40);
      for (const check of result.checks)
        assert.ok(Object.values(check).every(Boolean), JSON.stringify(check));
      assert.equal(result.activeBeforeDestroy, true);
      assert.equal(result.released, true);
      assert.equal(result.lastHandler, 39);
      assert.deepEqual(errors, []);
      console.log(
        `${name}: 40 scene resets reuse one renderer/context; runtime state cleared; final destroy releases context`,
      );

      const cursorPage = await browser.newPage();
      const cursorErrors = [];
      cursorPage.on("pageerror", (error) => cursorErrors.push(error.message));
      await cursorPage.goto(`http://127.0.0.1:${server.address().port}`);
      await cursorPage.evaluate(async () => {
        const m = await import("/bundle.js");
        window.runtime = m.default();
        await window.runtime.init({
          width: 64,
          height: 64,
          plugins: { elements: [m.rectPlugin] },
        });
        document.body.style.margin = "0";
        document.body.append(window.runtime.canvas);
        window.cursorScene = {
          elements: [
            {
              id: "button",
              type: "rect",
              width: 40,
              height: 40,
              fill: "#00ff00",
              hover: { cursor: "pointer" },
            },
          ],
          global: { cursorStyles: { default: "crosshair" } },
        };
        window.runtime.render(window.cursorScene);
      });
      for (const [position, cursor] of [
        [10, "pointer"],
        [55, "crosshair"],
      ]) {
        await cursorPage.mouse.move(position, position);
        assert.equal(
          await cursorPage.evaluate(() => window.runtime.canvas.style.cursor),
          cursor,
        );
        await cursorPage.evaluate(async () => {
          await window.runtime.reset();
        });
        assert.equal(
          await cursorPage.evaluate(() => window.runtime.canvas.style.cursor),
          "default",
        );
        await cursorPage.evaluate(() =>
          window.runtime.render(window.cursorScene),
        );
        // Stay inside the canvas: leaving it would mask the stale cursor cache.
        await cursorPage.mouse.move(12, 12);
        assert.equal(
          await cursorPage.evaluate(() => window.runtime.canvas.style.cursor),
          "pointer",
        );
      }
      const firstRender = await cursorPage.evaluate(async () => {
        window.runtime.destroy();
        const m = await import("/bundle.js");
        const runtime = m.default();
        const calls = [];
        const events = [];
        let resetPromise;
        await runtime.init({
          width: 64,
          height: 64,
          onFirstRender: () => calls.push("old"),
          eventHandler: (event, payload) => {
            if (event === "renderComplete" && payload.id === "old") {
              resetPromise = runtime.reset({
                onFirstRender: () => calls.push("new"),
                eventHandler: (event, payload) => events.push([event, payload]),
              });
            }
          },
        });
        runtime.render({ id: "old", elements: [] });
        await resetPromise;
        const beforeNewScene = [...calls];
        runtime.render({ id: "new", elements: [] });
        await runtime.whenRenderReady();
        const afterNewScene = [...calls];
        runtime.render({ id: "another", elements: [] });
        const afterAnotherScene = [...calls];
        runtime.destroy();
        return { beforeNewScene, afterNewScene, afterAnotherScene, events };
      });
      assert.deepEqual(firstRender.beforeNewScene, []);
      assert.deepEqual(firstRender.afterNewScene, ["new"]);
      assert.deepEqual(firstRender.afterAnotherScene, ["new"]);
      assert.deepEqual(firstRender.events, [
        ["renderComplete", { id: "new", aborted: false }],
        ["renderComplete", { id: "another", aborted: false }],
      ]);
      assert.deepEqual(cursorErrors, []);
      await cursorPage.close();
      console.log(
        `${name}: hover survives reset; renderComplete reset preserves the replacement first-render callback`,
      );

      // Each runtime behavior is observed before the reset, so the checks after
      // it cannot pass trivially.
      const behaviorPage = await browser.newPage();
      const behaviorErrors = [];
      behaviorPage.on("pageerror", (error) =>
        behaviorErrors.push(error.message),
      );
      await behaviorPage.goto(`http://127.0.0.1:${server.address().port}`);
      const before = await behaviorPage.evaluate(async () => {
        const m = await import("/bundle.js");
        const runtime = m.default();
        window.runtime = runtime;
        window.events = [];
        await runtime.init({
          width: 64,
          height: 64,
          plugins: { elements: [m.rectPlugin, m.inputPlugin] },
          eventHandler: (...args) => window.events.push(["before", ...args]),
        });
        document.body.style.margin = "0";
        document.body.append(runtime.canvas);
        runtime.render({
          id: "before-reset",
          elements: [
            {
              id: "moving",
              type: "rect",
              width: 20,
              height: 20,
              fill: "#00ff00",
            },
            {
              id: "field",
              type: "input",
              y: 30,
              width: 40,
              height: 20,
              value: "old value",
            },
          ],
          animations: [
            {
              id: "move",
              targetId: "moving",
              type: "update",
              tween: {
                x: {
                  initialValue: 0,
                  keyframes: [{ value: 40, duration: 2000 }],
                },
              },
            },
          ],
          global: {
            keyboard: { a: { keydown: { payload: { binding: "a" } } } },
          },
        });
        return {
          inputs: document.querySelectorAll("input, textarea").length,
        };
      });
      await behaviorPage.keyboard.press("a");
      const after = await behaviorPage.evaluate(async () => {
        const keydownBeforeReset = window.events.some(
          ([, event]) => event === "keydown",
        );
        const animatingAtReset = !window.events.some(
          ([, event, payload]) =>
            event === "renderComplete" && payload?.id === "before-reset",
        );
        await window.runtime.reset({
          eventHandler: (...args) => window.events.push(["after", ...args]),
        });
        return {
          keydownBeforeReset,
          animatingAtReset,
          inputs: document.querySelectorAll("input, textarea").length,
          eventCount: window.events.length,
        };
      });
      await behaviorPage.keyboard.press("a");
      // Outlast the 2 s animation that the reset interrupted.
      await behaviorPage.waitForTimeout(2300);
      await behaviorPage.evaluate(() => {
        window.runtime.render({
          id: "after-reset",
          elements: [
            {
              id: "button",
              type: "rect",
              width: 40,
              height: 40,
              fill: "#0000ff",
              click: { payload: { clicked: true } },
            },
          ],
        });
      });
      await behaviorPage.mouse.click(10, 10);
      const events = await behaviorPage.evaluate(() =>
        window.events.map(([handler, event, payload]) => ({
          handler,
          event,
          id: payload?.id ?? payload?._event?.id,
          aborted: payload?.aborted,
        })),
      );
      const eventsAfterReset = events.slice(after.eventCount);
      assert.ok(before.inputs > 0, "input DOM control was created");
      assert.equal(after.inputs, 0, "reset removes input DOM controls");
      assert.ok(
        after.keydownBeforeReset,
        "keyboard binding fired before reset",
      );
      assert.ok(
        !eventsAfterReset.some(({ event }) => event === "keydown"),
        "reset removes keyboard bindings",
      );
      assert.ok(after.animatingAtReset, "the animation was running at reset");
      assert.ok(
        !events.some(
          ({ id, aborted }) => id === "before-reset" && aborted === false,
        ),
        "the interrupted animation never completes its render",
      );
      assert.ok(
        eventsAfterReset.some(
          ({ handler, event, id }) =>
            handler === "after" && event === "click" && id === "button",
        ),
        "clicks reach elements rendered after reset",
      );
      assert.deepEqual(behaviorErrors, []);
      await behaviorPage.evaluate(() => window.runtime.destroy());
      console.log(
        `${name}: reset removes input controls and keyboard bindings, stops animations, and keeps pointer events working`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
