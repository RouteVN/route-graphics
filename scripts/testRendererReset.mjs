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
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
