import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { chromium } from "playwright";
import { getRendererBrowserLaunchOptions } from "../src/cli/browserLaunch.js";

// Exercise the consumer bundle: importing a separate Pixi instance would test
// a different canvas cache from the one RouteGraphics actually uses.
const bundle = await readFile(
  process.env.ROUTE_GRAPHICS_TEST_BUNDLE ??
    new URL("../dist/RouteGraphics.js", import.meta.url),
);
const server = http.createServer((request, response) => {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;",
  );
  response.setHeader(
    "Content-Type",
    request.url === "/bundle.js" ? "text/javascript" : "text/html",
  );
  response.end(
    request.url === "/bundle.js"
      ? bundle
      : "<!doctype html><title>Renderer retention regression</title><body></body>",
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch(
    getRendererBrowserLaunchOptions(process.env.ROUTE_GRAPHICS_TEST_BROWSER),
  );
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.rendererRetentionReferences = [];
    window.rendererRetentionControls = [];
  });
  const samples = [];
  for (let batch = 0; batch < 3; batch += 1) {
    const destruction = await page.evaluate(async () => {
      const module = await import("/bundle.js");
      const results = [];
      for (let cycle = 0; cycle < 6; cycle += 1) {
        const graphics = module.default();
        await graphics.init({
          width: 64,
          height: 64,
          rendererPreference: "webgl",
          rendererFallback: false,
          animationPlaybackMode: "manual",
          plugins: { elements: [module.rectPlugin] },
        });
        const host = document.createElement("section");
        const canvas = graphics.canvas;
        host.append(canvas);
        document.body.append(host);
        graphics.render({
          elements: [
            {
              id: "box",
              type: "rect",
              width: 32,
              height: 32,
              fill: "#00ff00",
            },
          ],
        });
        const display = graphics.findElementByLabel("box");
        window.rendererRetentionReferences.push({
          canvas: new WeakRef(canvas),
          host: new WeakRef(host),
        });
        graphics.destroy();
        host.remove();
        results.push({
          childDestroyed: display.destroyed,
          hostConnected: host.isConnected,
        });

        // A detached plain subtree verifies that the explicit GC below works.
        // No strong reference to either subtree crosses this browser job.
        const control = document.createElement("section");
        control.append(document.createElement("canvas"));
        window.rendererRetentionControls.push(new WeakRef(control));
      }
      return results;
    });
    for (const result of destruction) {
      assert.deepEqual(result, {
        childDestroyed: true,
        hostConnected: false,
      });
    }
    // WeakRef targets are kept alive until the creating job finishes. Force
    // collection from a later CDP command, without returning object handles.
    for (let collection = 0; collection < 3; collection += 1) {
      await cdp.send("HeapProfiler.collectGarbage");
    }
    samples.push(
      await page.evaluate(() => ({
        cycles: window.rendererRetentionReferences.length,
        retainedCanvases: window.rendererRetentionReferences.filter(
          ({ canvas }) => canvas.deref() !== undefined,
        ).length,
        retainedHosts: window.rendererRetentionReferences.filter(
          ({ host }) => host.deref() !== undefined,
        ).length,
        retainedOlderCanvases: window.rendererRetentionReferences
          .slice(0, -6)
          .filter(({ canvas }) => canvas.deref() !== undefined).length,
        retainedOlderHosts: window.rendererRetentionReferences
          .slice(0, -6)
          .filter(({ host }) => host.deref() !== undefined).length,
        retainedControls: window.rendererRetentionControls.filter(
          (reference) => reference.deref() !== undefined,
        ).length,
      })),
    );
  }
  console.log(JSON.stringify({ samples, pageErrors }, null, 2));
  assert.deepEqual(pageErrors, []);
  for (const sample of samples) {
    assert.equal(sample.retainedControls, 0, "The GC control must collect");
    // Pixi 8.10.2's batchable pool can keep the latest few geometries, GL
    // contexts, and canvases alive. Earlier batches must still collect: the
    // former canvas-cache leak retained every renderer without a bound.
    assert.equal(
      sample.retainedOlderCanvases,
      0,
      `${sample.cycles} destroyed renderers must release all earlier canvas batches`,
    );
    assert.equal(
      sample.retainedOlderHosts,
      0,
      `${sample.cycles} destroyed renderers must release all earlier host batches`,
    );
    assert.ok(
      sample.retainedCanvases <= 6,
      `${sample.cycles} destroyed renderers must retain at most one batch of canvases`,
    );
    assert.ok(
      sample.retainedHosts <= 6,
      `${sample.cycles} destroyed renderers must retain at most one batch of host subtrees`,
    );
  }
  await page.evaluate(async () => {
    const module = await import("/bundle.js");
    const graphics = module.default();
    await graphics.init({
      width: 64,
      height: 64,
      rendererPreference: "webgl",
      rendererFallback: false,
    });
    graphics.destroy();
    graphics.destroy();
  });
  assert.deepEqual(pageErrors, []);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
