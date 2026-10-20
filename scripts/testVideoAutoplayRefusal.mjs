import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { chromium } from "playwright";

// A browser that refuses to play a video with sound outside a user gesture
// must not hold the render, now or on a later render that changes the video.
// The page renders from its own script and reports through the console:
// Playwright's evaluate(), which waitForFunction() polls with, counts as a
// user gesture and would let the video play.

const bundle = await readFile(
  process.env.ROUTE_GRAPHICS_TEST_BUNDLE ??
    new URL("../dist/RouteGraphics.js", import.meta.url),
);
const video = await readFile(
  new URL("../vt/static/public/video_sample.mp4", import.meta.url),
);
const page = `<!doctype html>
<body style="margin:0">
<script type="module">
  const result = { completions: [], rejections: [] };
  let video;
  const report = () => {
    clearTimeout(deadline);
    console.log(
      "RESULT " +
        JSON.stringify({
          ...result,
          paused: video?.paused,
          currentTime: video?.currentTime,
        }),
    );
  };
  // Long enough for the 3.3 s sample to end if it plays.
  const deadline = setTimeout(report, 5000);
  window.addEventListener("unhandledrejection", (event) => {
    result.rejections.push(event.reason?.name ?? String(event.reason));
  });
  const m = await import("/bundle.js");
  const app = m.default();
  await app.init({
    width: 320,
    height: 180,
    rendererPreference: "webgl",
    rendererFallback: false,
    plugins: { elements: [m.videoPlugin] },
    eventHandler: (name, payload) => {
      if (name !== "renderComplete") return;
      result.completions.push(payload);
      if (payload.id === "scene-1") {
        setTimeout(() =>
          app.render({ id: "scene-2", elements: [{ ...clip, x: 40 }] }),
        );
      } else if (payload.id === "scene-2") {
        // Let any unhandled rejection arrive first.
        setTimeout(report, 100);
      }
    },
  });
  document.body.append(app.canvas);
  await app.loadAssets({
    clip: { url: "/video.mp4", type: "video/mp4", source: "url" },
  });
  const clip = {
    id: "clip",
    type: "video",
    src: "clip",
    x: 0,
    y: 0,
    width: 320,
    height: 180,
    volume: 1,
    loop: false,
  };
  app.render({ id: "scene-1", elements: [clip] });
  video = app.findElementByLabel("clip").texture.source.resource;
</script>
</body>`;

const server = http.createServer((request, response) => {
  if (request.url === "/bundle.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(bundle);
  } else if (request.url === "/video.mp4") {
    response.setHeader("Content-Type", "video/mp4");
    response.end(video);
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(page);
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.ROUTE_GRAPHICS_TEST_BROWSER,
  args: ["--autoplay-policy=document-user-activation-required"],
});
try {
  const tab = await browser.newPage({ viewport: { width: 320, height: 180 } });
  const errors = [];
  tab.on("pageerror", (error) => errors.push(error.message));
  const reported = new Promise((resolve) => {
    tab.on("console", (message) => {
      const text = message.text();
      if (text.startsWith("RESULT ")) resolve(JSON.parse(text.slice(7)));
    });
  });
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await reported;
  assert.deepEqual(errors, [], "autoplay refusal: page errors");
  assert.deepEqual(
    result.rejections,
    [],
    "autoplay refusal: unhandled play() rejection",
  );
  assert.deepEqual(result.completions, [
    { id: "scene-1", aborted: false },
    { id: "scene-2", aborted: false },
  ]);
  // The renders completed because play() was refused, not because the video
  // played to its end.
  assert.equal(result.paused, true);
  assert.equal(result.currentTime, 0);
  console.log(
    "PASS autoplay refusal: a refused video completes its render and later ones",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
