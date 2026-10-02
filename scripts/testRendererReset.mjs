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
          for (let index = 0; index < 40; index++) {
            runtime.render({
              elements: [
                {
                  id: "box",
                  type: "rect",
                  width: 20,
                  height: 20,
                  fill: "#00ff00",
                },
                {
                  id: "field",
                  type: "input",
                  width: 40,
                  height: 20,
                  value: "old value",
                },
              ],
              global: { cursorStyles: { default: "crosshair" } },
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
            // A real frame also exercises shader compilation after the resets.
            await runtime.extractBase64();
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
