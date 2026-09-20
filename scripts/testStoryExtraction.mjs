// Public labelled extraction regression using actual mounted RouteGraphics.
// Local public fixtures only; no server, download, or fake renderer pixels.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert(
    ["--out-dir", "--browser"].includes(process.argv[i]) && process.argv[i + 1],
  );
  options[process.argv[i]] = process.argv[i + 1];
}
const directory = path.resolve(options["--out-dir"] ?? "");
assert(
  options["--out-dir"] && !fs.existsSync(directory),
  "fresh output directory required",
);
fs.mkdirSync(directory, { recursive: true });
const write = (name, data) =>
  fs.writeFileSync(
    path.join(directory, name),
    typeof data === "string" || Buffer.isBuffer(data)
      ? data
      : JSON.stringify(data, null, 2) + "\n",
    { flag: "wx" },
  );
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const font = fs.readFileSync(
  path.join(root, "spec/assets/fonts/NotoSans-Regular.ttf"),
);
const bundle = await build({
  absWorkingDir: root,
  stdin: {
    resolveDir: root,
    contents: `
  export { default, Application, rectPlugin, textPlugin, containerPlugin } from './src/index.js';
`,
  },
  bundle: true,
  write: false,
  metafile: true,
  format: "esm",
  platform: "browser",
});
const sourceFiles = Object.keys(bundle.metafile.inputs)
  .filter((file) => file !== "<stdin>")
  .map((file) => path.resolve(root, file));
const identities = () =>
  sourceFiles.map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
const receipt = {
  pass: false,
  originalOnly: true,
  realWebGL: true,
  device: false,
  cases: [],
  sourceBefore: identities(),
  bundleSHA256: hash(bundle.outputFiles[0].text),
};
const fixtures = [
  { id: "rect", kind: "rect", alpha: 0.5, parentAlpha: 0.25 },
  { id: "text", kind: "text", alpha: 0.5, parentAlpha: 0.25 },
  {
    id: "rect-existing-group",
    kind: "rect",
    alpha: 0.5,
    parentAlpha: 0.25,
    group: true,
  },
  {
    id: "text-existing-group",
    kind: "text",
    alpha: 0.5,
    parentAlpha: 0.25,
    group: true,
  },
  { id: "ancestor-zero", kind: "rect", alpha: 0.5, parentAlpha: 0 },
  { id: "root-zero", kind: "rect", alpha: 0, parentAlpha: 0.25 },
];
async function observe({ code, fixture, font }) {
  document.fonts.add(
    await new FontFace(
      "StoryExtractionTest",
      Uint8Array.from(atob(font), (c) => c.charCodeAt(0)),
    ).load(),
  );
  const url = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  const m = await import(url);
  URL.revokeObjectURL(url);
  let pixi;
  // Read-only instance observation; actual init/controller/renderers untouched.
  const originalInit = m.Application.prototype.init;
  m.Application.prototype.init = function (...args) {
    pixi = this;
    return originalInit.apply(this, args);
  };
  const app = m.default();
  try {
    await app.init({
      width: 160,
      height: 100,
      debug: true,
      rendererPreference: "webgl",
      rendererFallback: false,
      plugins: { elements: [m.rectPlugin, m.textPlugin, m.containerPlugin] },
    });
  } finally {
    m.Application.prototype.init = originalInit;
  }
  const subject = {
    id: "story",
    type: fixture.kind,
    width: 80,
    height: 24,
    x: 20,
    y: 18,
    originX: 4,
    originY: 2,
    rotation: 12,
    alpha: fixture.alpha,
    ...(fixture.kind === "rect"
      ? { fill: "#ff0000" }
      : {
          content: "jAg office",
          textStyle: {
            fontFamily: "StoryExtractionTest",
            fontSize: 22,
            fill: "#ffffff",
          },
        }),
  };
  try {
    app.render({
      id: "source",
      elements: [
        {
          id: "background",
          type: "rect",
          width: 160,
          height: 100,
          fill: "#008000",
        },
        {
          id: "ancestor",
          type: "container",
          x: 7,
          y: 4,
          alpha: fixture.parentAlpha,
          children: [subject],
        },
      ],
    });
    await app.whenRenderReady();
    const node = app.findElementByLabel("story"),
      parent = node.parent,
      index = parent.children.indexOf(node);
    if (fixture.group) node.enableRenderGroup();
    const state = () => ({
      x: node.x,
      y: node.y,
      pivot: [node.pivot.x, node.pivot.y],
      scale: [node.scale.x, node.scale.y],
      rotation: node.rotation,
      alpha: node.alpha,
      group: node.isRenderGroup,
      parent: node.parent === parent,
      index: parent.children.indexOf(node),
      destroyed: node.destroyed,
    });
    const beforeState = state(),
      stageBefore = await app.extractBase64();
    const extracted = await app.extractBase64("story"),
      stageAfter = await app.extractBase64();
    const repeated = await app.extractBase64("story"),
      stageAfterRepeat = await app.extractBase64();
    const afterState = state(),
      failures = [];
    // True renderer failure happens inside staging; finally must restore owner.
    const generate = pixi.renderer.textureGenerator.generateTexture;
    pixi.renderer.textureGenerator.generateTexture = () => {
      throw Error("intentional-generate-failure");
    };
    try {
      await app.extractBase64("story");
      failures.push("generate did not reject");
    } catch (error) {
      failures.push(error.message);
    } finally {
      pixi.renderer.textureGenerator.generateTexture = generate;
    }
    const stageAfterGenerateFailure = await app.extractBase64(),
      generateFailureState = state();
    // Encoding may reject asynchronously after the generated texture exists.
    let generated = 0,
      destroyed = 0;
    pixi.renderer.textureGenerator.generateTexture = function (...args) {
      const texture = generate.apply(this, args);
      generated++;
      const destroy = texture.destroy;
      texture.destroy = function (...args) {
        destroyed++;
        return destroy.apply(this, args);
      };
      return texture;
    };
    const base64 = pixi.renderer.extract.base64;
    pixi.renderer.extract.base64 = async () => {
      throw Error("intentional-encode-failure");
    };
    try {
      await app.extractBase64("story");
      failures.push("encode did not reject");
    } catch (error) {
      failures.push(error.message);
    } finally {
      pixi.renderer.textureGenerator.generateTexture = generate;
      pixi.renderer.extract.base64 = base64;
    }
    const stageAfterEncodeFailure = await app.extractBase64(),
      encodeFailureState = state();
    return {
      beforeState,
      afterState,
      generateFailureState,
      encodeFailureState,
      originalIndex: index,
      stageBefore,
      extracted,
      stageAfter,
      repeated,
      stageAfterRepeat,
      stageAfterGenerateFailure,
      stageAfterEncodeFailure,
      failures,
      generated,
      destroyed,
    };
  } finally {
    app.destroy();
  }
}
const browser = await chromium.launch({
  executablePath: options["--browser"],
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  receipt.browser = browser.version();
  for (const fixture of fixtures) {
    const context = await browser.newContext({ serviceWorkers: "block" }),
      denied = [],
      errors = [];
    try {
      await context.route("**/*", (route) => {
        denied.push(route.request().url());
        return route.abort("blockedbyclient");
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(String(error)));
      const observation = await page.evaluate(observe, {
        code: bundle.outputFiles[0].text,
        fixture,
        font: font.toString("base64"),
      });
      const pixels = {};
      for (const field of [
        "stageBefore",
        "extracted",
        "stageAfter",
        "repeated",
        "stageAfterRepeat",
        "stageAfterGenerateFailure",
        "stageAfterEncodeFailure",
      ]) {
        const bytes = Buffer.from(observation[field].split(",")[1], "base64"),
          png = PNG.sync.read(bytes);
        assert.deepEqual([png.width, png.height], [160, 100]);
        pixels[field] = png.data;
        write(`${fixture.id}.${field}.png`, bytes);
        observation[field] = hash(png.data);
      }
      const checks = [];
      const check = (name, fn) => {
        try {
          fn();
          checks.push({ name, pass: true });
        } catch (error) {
          checks.push({ name, pass: false, error: error.message });
        }
      };
      check("network-and-console", () => {
        assert.deepEqual(denied, []);
        assert.deepEqual(errors, []);
      });
      for (const field of [
        "stageAfter",
        "stageAfterRepeat",
        "stageAfterGenerateFailure",
        "stageAfterEncodeFailure",
      ])
        check(field, () =>
          assert(
            pixels.stageBefore.equals(pixels[field]),
            "actual stage pixels changed",
          ),
        );
      check("repeat", () => assert(pixels.extracted.equals(pixels.repeated)));
      for (const field of [
        "afterState",
        "generateFailureState",
        "encodeFailureState",
      ])
        check(field, () =>
          assert.deepEqual(observation[field], observation.beforeState),
        );
      check("generate-and-encoding-failure", () => {
        assert.deepEqual(observation.failures, [
          "intentional-generate-failure",
          "intentional-encode-failure",
        ]);
        assert.equal(observation.generated, 1);
        assert.equal(observation.destroyed, 1);
      });
      check("root-alpha-not-ancestor-alpha", () => {
        const maxAlpha = pixels.extracted.reduce(
          (max, value, i) => (i % 4 === 3 ? Math.max(max, value) : max),
          0,
        );
        assert.equal(maxAlpha, fixture.alpha === 0 ? 0 : 127);
      });
      const result = {
        id: fixture.id,
        pass: checks.every((c) => c.pass),
        checks,
        observation,
      };
      receipt.cases.push(result);
      write(`${fixture.id}.json`, result);
      console.log(
        JSON.stringify({
          id: fixture.id,
          pass: result.pass,
          failures: checks.filter((c) => !c.pass).map((c) => c.name),
        }),
      );
    } finally {
      await context.close();
    }
  }
  receipt.pass = receipt.cases.every((c) => c.pass);
} finally {
  await browser.close();
  receipt.sourceAfter = identities();
  try {
    assert.deepEqual(receipt.sourceAfter, receipt.sourceBefore);
  } catch (error) {
    receipt.pass = false;
    receipt.identityFailure = error.message;
  }
  write("receipt.json", receipt);
}
console.log(
  JSON.stringify({
    pass: receipt.pass,
    contexts: receipt.cases.length,
    receipt: path.join(directory, "receipt.json"),
  }),
);
if (!receipt.pass) process.exitCode = 1;
