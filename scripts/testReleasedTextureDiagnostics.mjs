// A real frame that fails on a released texture names the elements that draw
// it, in Chromium and WebKit. Pixi leaves a texture source without its image
// when it destroys the source and when it returns a texture to a pool; the
// next frame that draws it then fails.
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
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const results = await page.evaluate(async () => {
        const m = await import("/bundle.js");
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        canvas.getContext("2d").fillRect(0, 0, 8, 8);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve));
        const png = await blob.arrayBuffer();

        const scene = (id, ids) => ({
          id,
          elements: [
            {
              id: "group",
              type: "container",
              x: 0,
              y: 0,
              width: 64,
              height: 64,
              children: ids.map((spriteId, index) => ({
                id: spriteId,
                type: "sprite",
                x: index * 20,
                y: 0,
                width: 16,
                height: 16,
                src: spriteId,
              })),
            },
          ],
        });

        const run = async (kind) => {
          const runtime = m.default();
          await runtime.init({
            width: 64,
            height: 64,
            plugins: {
              elements: [m.spritePlugin, m.containerPlugin],
              audio: [m.soundPlugin],
            },
          });
          document.body.append(runtime.canvas);
          await runtime.loadAssets({
            hero: { buffer: png, type: "image/png", source: "buffer" },
            other: { buffer: png, type: "image/png", source: "buffer" },
          });
          runtime.render(scene("first", ["hero"]));
          await runtime.whenRenderReady();

          // "uploaded": the destroyed source was already on the GPU.
          // "never-uploaded": it is destroyed before its first frame.
          // "released": a live source loses its image, as a pooled text
          // texture does, and the next frame uploads it again.
          const key = kind === "never-uploaded" ? "other" : "hero";
          const source = m.Assets.get(key).source;
          if (kind === "released") {
            source.resource = null;
            source.unload();
          } else {
            source.destroy();
          }

          let failure;
          try {
            runtime.render(scene("next", ["hero", "other"]));
          } catch (error) {
            failure = {
              message: error.message,
              labels: error.releasedTextureLabels,
            };
          }
          runtime.destroy();
          return failure;
        };

        return {
          uploaded: await run("uploaded"),
          neverUploaded: await run("never-uploaded"),
          released: await run("released"),
        };
      });

      for (const [kind, expectedLabel] of [
        ["uploaded", "hero"],
        ["neverUploaded", "other"],
        ["released", "hero"],
      ]) {
        const failure = results[kind];
        assert.ok(failure, `${name} ${kind}: the frame should have failed`);
        assert.deepEqual(
          failure.labels,
          [expectedLabel],
          `${name} ${kind}: ${failure.message}`,
        );
        assert.match(
          failure.message,
          new RegExp(
            `\\[Route Graphics: released texture on "${expectedLabel}"\\]$`,
          ),
          `${name} ${kind}`,
        );
        console.log(`${name} ${kind}: ${failure.message}`);
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
