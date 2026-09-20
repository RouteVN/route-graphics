// Real WebGL regression for transition snapshots of source-mounted elements.
// No server, downloads, mocked renderer, or pre-recorded expected image.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { getRendererBrowserLaunchOptions } from "../src/cli/browserLaunch.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const family = "TransitionSnapshotTestSans";
const font = await readFile(
  new URL("../spec/assets/fonts/NotoSans-Regular.ttf", import.meta.url),
);
const { outputFiles } = await build({
  absWorkingDir: root,
  stdin: {
    resolveDir: root,
    contents: `
    export { Application, Rectangle, RenderLayer } from "pixi.js";
    export { parseElements } from "./src/plugins/elements/parseElements.js";
    export { renderElements } from "./src/plugins/elements/renderElements.js";
    export { rectPlugin } from "./src/plugins/elements/rect/index.js";
    export { textPlugin } from "./src/plugins/elements/text/index.js";
    export { containerPlugin } from "./src/plugins/elements/container/index.js";
    export { createAnimationBus } from "./src/plugins/animations/animationBus.js";
    export { createCompletionTracker } from "./src/util/completionTracker.js";
    export { createSnapshotSubject, destroySubjectSnapshot } from "./src/plugins/animations/replace/transitionSurfaces.js";
  `,
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
});
const rect = (id, rest = {}) => ({
  id,
  type: "rect",
  width: 48,
  height: 30,
  fill: "#ff0000",
  ...rest,
});
const text = (rest = {}) => ({
  id: "subject",
  type: "text",
  content: "jAg office AVA",
  width: 260,
  x: 20,
  y: 16,
  scaleX: 1.25,
  scaleY: -1,
  alpha: 0.4,
  textStyle: {
    fontFamily: family,
    fontSize: 32,
    fill: "#ffffff",
    align: "center",
  },
  ...rest,
});
const cases = [
  {
    id: "root-graphics",
    subject: rect("subject", {
      x: 37,
      y: 21,
      originX: 7,
      originY: 5,
      scaleX: -1.5,
      scaleY: 2,
      rotation: 23,
      alpha: 0.25,
    }),
    opaqueRed: true,
  },
  {
    id: "root-graphics-border",
    subject: rect("subject", {
      x: 12,
      y: 44,
      alpha: 0.5,
      border: { width: 1.5, color: "#0000ff", alpha: 1 },
    }),
  },
  { id: "root-text", subject: text() },
  { id: "root-text-render-group", subject: text(), renderGroup: true },
  {
    id: "root-graphics-filter",
    subject: rect("subject", {
      x: 25,
      y: 40,
      alpha: 0.25,
      blur: { x: 2, y: 2 },
    }),
  },
  {
    id: "root-graphics-blend",
    blend: "add",
    subject: rect("subject", { x: 25, y: 40, alpha: 0.25 }),
    opaqueRed: true,
  },
  {
    id: "root-graphics-layer",
    layer: true,
    subject: rect("subject", { x: 25, y: 40, alpha: 0.25 }),
    opaqueRed: true,
  },
  {
    id: "container-overlap",
    subject: {
      id: "subject",
      type: "container",
      x: 20,
      y: 30,
      originX: 9,
      originY: 3,
      scaleX: -1.5,
      alpha: 0.25,
      children: [
        rect("red", { x: -12, y: -6, width: 40, height: 24 }),
        rect("blue", {
          x: 4,
          y: 2,
          width: 32,
          height: 24,
          fill: "#0000ff",
          alpha: 0.5,
        }),
      ],
    },
  },
  {
    id: "cached-container",
    cache: true,
    subject: {
      id: "subject",
      type: "container",
      x: 20,
      y: 30,
      alpha: 0.25,
      children: [
        rect("red"),
        text({ id: "child", x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1 }),
      ],
    },
  },
  {
    id: "masked-scroll-container",
    subject: {
      id: "subject",
      type: "container",
      x: 20,
      y: 30,
      width: 32,
      height: 16,
      scroll: true,
      alpha: 0.25,
      children: [rect("red", { height: 60 })],
    },
    opaqueRed: true,
  },
  {
    id: "rich-text",
    subject: text({
      scaleX: 1,
      scaleY: 1,
      content: [
        { text: "office " },
        { text: "AVA", textStyle: { fill: "#00ffff", fontSize: 28 } },
        { text: "\njAg" },
      ],
    }),
  },
];

async function observe({ code, fontBase64, family, fixture, presented }) {
  document.fonts.add(
    await new FontFace(
      family,
      Uint8Array.from(atob(fontBase64), (c) => c.charCodeAt(0)),
    ).load(),
  );
  await document.fonts.ready;
  const url = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  const m = await import(url);
  URL.revokeObjectURL(url);
  const app = new m.Application();
  await app.init({
    width: 640,
    height: 360,
    autoStart: false,
    preference: "webgl",
    resolution: 1,
    antialias: false,
  });
  app.stop();
  const animationBus = m.createAnimationBus(),
    completionTracker = m.createCompletionTracker(() => {});
  const plugins = [m.rectPlugin, m.textPlugin, m.containerPlugin];
  const states = [
    {
      id: "ancestor",
      type: "container",
      x: 160,
      y: 70,
      alpha: 0.5,
      children: [
        rectState("before", 0),
        fixture.subject,
        rectState("after", 300),
      ],
    },
  ];
  function rectState(id, x) {
    return {
      id,
      type: "rect",
      x,
      y: 120,
      width: 8,
      height: 8,
      fill: "#00ff00",
    };
  }
  let subject;
  try {
    const parsed = m.parseElements({
      JSONObject: states,
      parserPlugins: plugins,
    });
    await m.renderElements({
      app,
      parent: app.stage,
      prevComputedTree: [],
      nextComputedTree: parsed,
      animations: [],
      animationBus,
      completionTracker,
      eventHandler: () => {},
      elementPlugins: plugins,
    });
    const parent = app.stage.children.find((c) => c.label === "ancestor");
    const node = parent.children.find((c) => c.label === "subject");
    if (fixture.renderGroup) node.enableRenderGroup();
    if (fixture.cache) node.cacheAsTexture(true);
    if (fixture.blend) node.blendMode = fixture.blend;
    let layer;
    if (fixture.layer) {
      layer = new m.RenderLayer();
      app.stage.addChild(layer);
      layer.attach(parent.children[0], node, parent.children[2]);
    }
    const state = () => ({
      parent: node.parent === parent,
      order: parent.children.map((c) => c.label),
      position: [node.x, node.y],
      scale: [node.scale.x, node.scale.y],
      pivot: [node.pivot.x, node.pivot.y],
      skew: [node.skew.x, node.skew.y],
      rotation: node.rotation,
      alpha: node.alpha,
      renderGroup: node.isRenderGroup,
      cache: node.isCachedAsTexture,
      destroyed: node.destroyed,
      layerRestored: layer
        ? node.parentRenderLayer === layer
        : !node.parentRenderLayer,
      layerOrder: layer?.renderLayerChildren.map((c) => c.label) ?? [],
    });
    const stagePixels = () => [
      ...app.renderer.extract.pixels({
        target: app.stage,
        frame: new m.Rectangle(0, 0, 640, 360),
      }).pixels,
    ];
    if (presented) app.render();
    const before = state(),
      beforeStage = presented ? stagePixels() : null;
    const captures = [];
    for (let i = 0; i < 2; i++) {
      subject = m.createSnapshotSubject(app, node);
      const extracted = app.renderer.extract.pixels({
        target: subject.texture,
      });
      captures.push({
        size: [extracted.width, extracted.height],
        pixels: [...extracted.pixels],
        state: state(),
      });
      m.destroySubjectSnapshot(subject, app);
      subject = null;
      if (presented) app.render();
    }
    const afterStage = presented ? stagePixels() : null;
    return {
      before,
      captures,
      stageUnchanged:
        !presented || beforeStage.every((v, i) => v === afterStage[i]),
      stageHasPixels: !presented || beforeStage.some((v) => v !== 0),
    };
  } finally {
    if (subject) m.destroySubjectSnapshot(subject, app);
    animationBus.destroy();
    app.destroy(true, { children: true });
  }
}

const browser = await chromium.launch({
  ...getRendererBrowserLaunchOptions(
    process.env.ROUTE_GRAPHICS_TEST_BROWSER ?? chromium.executablePath(),
  ),
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const results = [];
try {
  for (const fixture of cases) {
    const observations = [];
    for (const presented of [false, true]) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      const errors = [],
        requests = [];
      try {
        await context.route("**/*", (route) => {
          requests.push(route.request().url());
          return route.abort();
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(String(error)));
        observations.push(
          await page.evaluate(observe, {
            code: outputFiles[0].text,
            fontBase64: font.toString("base64"),
            family,
            fixture,
            presented,
          }),
        );
        assert.deepEqual(errors, []);
        assert.deepEqual(requests, []);
      } finally {
        await context.close();
      }
    }
    const checks = [];
    const check = (name, fn) => {
      try {
        fn();
        checks.push({ name, pass: true });
      } catch (error) {
        checks.push({
          name,
          pass: false,
          message: error.message.slice(0, 500),
        });
      }
    };
    for (const [index, result] of observations.entries()) {
      check(`${index}:restores-local-state-parent-order-and-cache`, () => {
        result.captures.forEach((capture) =>
          assert.deepEqual(capture.state, result.before),
        );
      });
      check(`${index}:snapshot-has-opaque-content`, () => {
        assert(
          result.captures[0].pixels.some(
            (value, i) => i % 4 === 3 && value === 255,
          ),
        );
      });
      check(`${index}:repeat-is-identical`, () => {
        assert.deepEqual(result.captures[0].size, result.captures[1].size);
        assert.deepEqual(result.captures[0].state, result.captures[1].state);
        assert(
          Buffer.from(result.captures[0].pixels).equals(
            Buffer.from(result.captures[1].pixels),
          ),
          "repeated capture pixels differ",
        );
      });
      check(`${index}:stage-is-unchanged`, () =>
        assert(result.stageUnchanged && result.stageHasPixels),
      );
      if (fixture.opaqueRed)
        check(`${index}:opaque-red-local-texture`, () => {
          result.captures[0].pixels.forEach((value, i) =>
            assert.equal(value, i % 4 === 0 || i % 4 === 3 ? 255 : 0),
          );
        });
    }
    check("fresh-and-previously-presented-captures-match", () => {
      assert.deepEqual(
        observations[0].captures[0].size,
        observations[1].captures[0].size,
      );
      assert(
        Buffer.from(observations[0].captures[0].pixels).equals(
          Buffer.from(observations[1].captures[0].pixels),
        ),
        "fresh and presented pixels differ",
      );
    });
    const summarize = (o) =>
      o.captures.map((c) => ({
        size: c.size,
        nontransparentPixels: c.pixels.filter((n, i) => i % 4 === 3 && n > 0)
          .length,
        maxAlpha: c.pixels.reduce(
          (max, n, i) => (i % 4 === 3 ? Math.max(max, n) : max),
          0,
        ),
      }));
    const result = {
      id: fixture.id,
      pass: checks.every((c) => c.pass),
      checks,
      fresh: summarize(observations[0]),
      presented: summarize(observations[1]),
    };
    results.push(result);
    console.log(JSON.stringify(result));
  }
} finally {
  await browser.close();
}
console.log(
  JSON.stringify({
    pass: results.every((r) => r.pass),
    caseCount: results.length,
    browserContexts: results.length * 2,
  }),
);
if (results.some((r) => !r.pass)) process.exitCode = 1;
