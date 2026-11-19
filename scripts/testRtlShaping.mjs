import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

// Right-to-left text is drawn as one text object per run of a single style
// and direction. Each run carries invisible control characters that tell the
// browser which way to lay it out and which neighbours its letters join.
// Whether that gives the right picture is decided by each browser's text
// engine, so this test asks the engine: every line is rendered through
// route-graphics and compared with the same string drawn in one piece by the
// browser's own canvas text.
//
//   node scripts/testRtlShaping.mjs [--browsers chromium,firefox,webkit]
//                                   [--bundle dist/RouteGraphics.js]
//                                   [--out-dir .rettangoli/rtl-shaping]
//
// Firefox has no WebGL in headless mode, so it runs with a window and needs
// a display: xvfb-run -a node scripts/testRtlShaping.mjs

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const ENGINES = { chromium, firefox, webkit };
const browsers = (argument("--browsers") ?? "chromium,firefox,webkit")
  .split(",")
  .filter(Boolean);
const outDir = argument("--out-dir") ?? ".rettangoli/rtl-shaping";
const bundlePath =
  argument("--bundle") ?? new URL("../dist/RouteGraphics.js", import.meta.url);

for (const name of browsers) {
  assert.ok(ENGINES[name], `unknown browser "${name}"`);
}

const FONT_SIZE = 48;
// Share of the ink of either picture with no ink of the other within one
// pixel. A letter in the wrong joining form scores 0.1 or more; a word in
// the wrong place scores close to 2.
const INK_LIMIT = 0.03;
// Kerning between two letters is lost when a style change separates them.
const WIDTH_LIMIT = 3;

const ARABIC_PATTERN = /\p{Script=Arabic}/u;
const ASTRAL_PATTERN = /[\uD800-\uDBFF]/;

// WebKit's own canvas text is not a reliable reference for some lines, so
// they are compared by width only there:
// - Its Linux build draws Arabic glyphs a few pixels above or below where
//   its measureText puts them, by an amount that depends on the rest of the
//   run, so a word drawn in several runs cannot match the word drawn in one.
// - It leaves out the bracket pairing of the bidirectional algorithm (UAX #9
//   rule N0) and gives characters outside the Basic Multilingual Plane, such
//   as emoji, the direction of their UTF-16 halves (left to right). Inside a
//   directional override it orders them correctly, as route-graphics does.
const SKIP_INK = {
  webkit: (line) =>
    ARABIC_PATTERN.test(line.text) || ASTRAL_PATTERN.test(line.text),
};

const LINES = [
  "שלום עולם",
  "שָׁלוֹם עוֹלָם",
  "שלום abc עולם",
  "abc שלום def",
  "A שלום B עולם C",
  "שלום (abc) [עולם] {x}",
  "שלום, עולם! מה? כן.",
  "שלום... עולם",
  "123 שלום 456",
  "שלום 3.14 עולם",
  "שלום -5 עולם",
  "مرحبا بالعالم",
  "السلام عليكم ورحمة الله وبركاته",
  "لا إله إلا الله",
  "مَرْحَبًا بِكُمْ",
  "اللُّغَةُ العَرَبِيَّةُ",
  "می‌خواهم",
  "هل أنت بخير؟ نعم، شكرا!",
  "قال: «مرحبا»",
  "اضغط على Start Game للبدء",
  "الهاتف 123-456 الآن",
  "السعر 50% فقط",
  "التاريخ 2024/01/15",
  "الساعة 10:30 صباحا",
  "العدد 1,234.56 كبير",
  "الرقم ١٢٣ و ٤٥٦",
  "البريد user@example.com هنا",
  "(abc (def)) نص",
  "שלום 😀🎉 עולם",
  "مرحبا 👍🏽 بالعالم",
];

// Each word is cut at every position into two segments, and around every
// letter into three. The pieces must look like the uncut word.
const SPLIT_WORDS = [
  "مرحبا",
  "كتاب",
  "بيت",
  "العربية",
  "مستشفى",
  "يمشي",
  "سلام",
  "مَرْحَبًا",
  "اللُّغَة",
  "שלום",
  "שָׁלוֹם",
];

const HIGHLIGHT = { fill: "#ff6666" };

const createLines = () => {
  const lines = LINES.map((text) => ({ name: text, text, content: text }));

  // Two emoji in a row, split by a style change.
  lines.push({
    name: "שלום 😀|🎉 עולם",
    text: "שלום 😀🎉 עולם",
    content: [{ text: "שלום 😀" }, { text: "🎉 עולם", textStyle: HIGHLIGHT }],
  });

  for (const word of SPLIT_WORDS) {
    for (let index = 1; index < word.length; index++) {
      const parts = [word.slice(0, index), word.slice(index)];

      lines.push({
        name: parts.join("|"),
        text: word,
        content: [{ text: parts[0] }, { text: parts[1], textStyle: HIGHLIGHT }],
      });
    }

    for (let index = 1; index < word.length - 1; index++) {
      const parts = [word.slice(0, index), word[index], word.slice(index + 1)];

      lines.push({
        name: parts.join("|"),
        text: word,
        content: [
          { text: parts[0] },
          { text: parts[1], textStyle: HIGHLIGHT },
          { text: parts[2] },
        ],
      });
    }
  }

  return lines;
};

const files = {
  "/bundle.js": [await readFile(bundlePath), "text/javascript"],
  "/arabic.woff2": [
    await readFile(
      new URL(
        "../vt/static/public/NotoSansArabic-Regular.subset.woff2",
        import.meta.url,
      ),
    ),
    "font/woff2",
  ],
  "/hebrew.woff2": [
    await readFile(
      new URL(
        "../vt/static/public/NotoSansHebrew-Regular.subset.woff2",
        import.meta.url,
      ),
    ),
    "font/woff2",
  ],
};

const server = http.createServer((request, response) => {
  const [body, type] = files[request.url] ?? [
    "<!doctype html><body style='margin:0;background:#000'></body>",
    "text/html",
  ];

  response.setHeader("Content-Type", type);
  response.end(body);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

// Runs in the page.
const compareLines = async ({ lines, fontSize }) => {
  const WIDTH = 900;
  const HEIGHT = 240;
  const RIGHT = WIDTH - 40;
  const FAMILIES = ["NotoSansArabic", "NotoSansHebrew"];

  const m = await import("/bundle.js");
  const manager = m.createAssetBufferManager();

  await manager.load({
    NotoSansArabic: { url: "/arabic.woff2", type: "font/woff2" },
    NotoSansHebrew: { url: "/hebrew.woff2", type: "font/woff2" },
  });

  const app = m.default();

  await app.init({
    width: WIDTH,
    height: HEIGHT,
    plugins: {
      elements: [m.textPlugin],
      animations: [m.tweenPlugin],
      audio: [m.soundPlugin],
    },
    eventHandler: () => {},
  });
  await app.loadAssets(manager.getBufferMap());
  document.body.append(app.canvas);

  const frames = (count) =>
    new Promise((resolve) => {
      const step = () =>
        count-- <= 0 ? resolve() : requestAnimationFrame(step);

      step();
    });

  const readInk = (canvas) => {
    const pixels = canvas
      .getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, WIDTH, HEIGHT).data;
    const ink = new Uint8Array(WIDTH * HEIGHT);
    let left = WIDTH;
    let right = -1;
    let top = HEIGHT;
    let bottom = -1;
    let count = 0;

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const offset = (y * WIDTH + x) * 4;
        const level =
          (Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) *
            pixels[offset + 3]) /
          255;

        if (level < 96) continue;

        ink[y * WIDTH + x] = 1;
        count++;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }

    return { ink, left, right, top, bottom, count };
  };

  // Ink of `a` with no ink of `b` within one pixel, with `b` moved by dx, dy.
  const countUnmatched = (a, b, dx, dy) => {
    let unmatched = 0;

    for (let y = a.top; y <= a.bottom; y++) {
      for (let x = a.left; x <= a.right; x++) {
        if (!a.ink[y * WIDTH + x]) continue;

        let found = false;

        for (let oy = -1; oy <= 1 && !found; oy++) {
          const by = y - dy + oy;

          if (by < 0 || by >= HEIGHT) continue;

          for (let ox = -1; ox <= 1; ox++) {
            const bx = x - dx + ox;

            if (bx >= 0 && bx < WIDTH && b.ink[by * WIDTH + bx]) {
              found = true;
              break;
            }
          }
        }

        if (!found) unmatched++;
      }
    }

    return unmatched;
  };

  // Both pictures end at the same right edge. Their tops are lined up, and
  // a small neighbourhood is searched so that a baseline rounded the other
  // way is not reported as a different shape.
  const scoreInk = (ours, native) => {
    if (ours.count === 0 || native.count === 0) return 2;

    const dx = ours.right - native.right;
    const dy = ours.top - native.top;
    let best = 2;

    for (let sy = -2; sy <= 2; sy++) {
      for (let sx = -2; sx <= 2; sx++) {
        const score =
          countUnmatched(ours, native, dx + sx, dy + sy) / ours.count +
          countUnmatched(native, ours, -(dx + sx), -(dy + sy)) / native.count;

        best = Math.min(best, score);
      }
    }

    return best;
  };

  const nativeCanvas = document.createElement("canvas");

  nativeCanvas.width = WIDTH;
  nativeCanvas.height = HEIGHT;
  // `direction` is only honoured everywhere for a canvas in the document.
  nativeCanvas.style.cssText = "position:absolute;left:-10000px;top:0";
  document.body.append(nativeCanvas);

  const nativeContext = nativeCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  const drawNative = (text) => {
    nativeContext.clearRect(0, 0, WIDTH, HEIGHT);
    nativeContext.font = `${fontSize}px ${FAMILIES.map((family) => `"${family}"`).join(",")}`;
    nativeContext.direction = "rtl";
    nativeContext.textAlign = "right";
    nativeContext.textBaseline = "alphabetic";
    nativeContext.fillStyle = "#fff";
    nativeContext.fillText(text, RIGHT, HEIGHT / 2);

    return nativeContext.measureText(text).width;
  };

  const results = [];
  let renders = 0;

  for (const line of lines) {
    const textStyle = { fontSize, fill: "#ffffff", fontFamily: FAMILIES };
    const element = {
      id: "line",
      type: "text",
      x: RIGHT,
      y: 70,
      anchorX: 1,
      direction: "rtl",
      textStyle,
      content: Array.isArray(line.content)
        ? line.content.map((segment) => ({
            ...segment,
            textStyle: { ...textStyle, ...segment.textStyle },
          }))
        : line.content,
    };

    app.render({
      id: `state-${++renders}`,
      elements: [element],
      animations: [],
      audio: [],
      audioEffects: [],
      global: {},
    });
    await app.whenRenderReady();
    await frames(2);

    const frame = await app.extractCanvas();
    const ours = readInk(frame);
    const nativeWidth = drawNative(line.text);
    const native = readInk(nativeCanvas);
    const node = m.textPlugin.parse({ state: element });
    const width = node.content
      .flatMap((chunk) => chunk.lineParts)
      .reduce((sum, part) => sum + part.width, 0);
    const result = {
      name: line.name,
      lineCount: node.content.length,
      ink: Number(scoreInk(ours, native).toFixed(4)),
      width: Number(width.toFixed(2)),
      nativeWidth: Number(nativeWidth.toFixed(2)),
    };

    if (line.picture) {
      // route-graphics above, the browser's own drawing below.
      const picture = document.createElement("canvas");

      picture.width = WIDTH;
      picture.height = HEIGHT * 2;

      const context = picture.getContext("2d");

      context.fillStyle = "#000";
      context.fillRect(0, 0, WIDTH, HEIGHT * 2);
      context.drawImage(frame, 0, 0);
      context.drawImage(nativeCanvas, 0, HEIGHT);
      result.picture = picture.toDataURL("image/png");
    }

    results.push(result);
  }

  // A blank line between two paragraphs leaves a part that is only a line
  // break. A canvas measures a line break as a space, but nothing is drawn
  // for it, so every line must still end at the right edge of the box.
  const BOX_WIDTH = 400;
  const paragraphs = m.textPlugin.parse({
    state: {
      id: "paragraphs",
      type: "text",
      x: 0,
      y: 0,
      direction: "rtl",
      width: BOX_WIDTH,
      textStyle: { fontSize, fill: "#ffffff", fontFamily: FAMILIES },
      content: "אבג\n\nדהו",
    },
  });
  const lineEnds = paragraphs.content
    .map((chunk) => chunk.lineParts.filter((part) => part.text.trim() !== ""))
    .filter((parts) => parts.length > 0)
    .map(
      (parts) =>
        Math.max(...parts.map((part) => part.x + part.width)) - BOX_WIDTH,
    );

  return { results, lineEnds };
};

const failures = [];

try {
  for (const name of browsers) {
    if (
      name === "firefox" &&
      process.platform === "linux" &&
      !process.env.DISPLAY &&
      !process.env.WAYLAND_DISPLAY
    ) {
      throw new Error(
        "Firefox has no WebGL in headless mode. Run under a display: xvfb-run -a node scripts/testRtlShaping.mjs",
      );
    }

    const browser = await ENGINES[name].launch({
      headless: name !== "firefox",
    });

    // A page per run: each run starts its own renderer.
    const run = async (lines) => {
      const page = await browser.newPage();
      const errors = [];

      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);

      const outcome = await page.evaluate(compareLines, {
        lines,
        fontSize: FONT_SIZE,
      });

      assert.deepEqual(errors, [], `${name} page errors`);
      await page.close();

      return outcome;
    };

    try {
      const lines = createLines();
      const { results, lineEnds } = await run(lines);
      const failed = [];
      let inkCompared = 0;

      results.forEach((result, index) => {
        const reasons = [];
        const compareInk = !SKIP_INK[name]?.(lines[index]);

        if (result.lineCount !== 1) {
          reasons.push(`wrapped into ${result.lineCount} lines`);
        }

        if (compareInk) {
          inkCompared++;

          if (result.ink > INK_LIMIT) reasons.push(`ink ${result.ink}`);
        }

        if (Math.abs(result.width - result.nativeWidth) > WIDTH_LIMIT) {
          reasons.push(`width ${result.width} for ${result.nativeWidth}`);
        }

        if (reasons.length > 0) {
          failed.push({ line: lines[index], reasons });
        }
      });

      if (failed.length > 0) {
        // Draw the failing lines once more to keep a picture of each.
        const { results: pictures } = await run(
          failed.map(({ line }) => ({ ...line, picture: true })),
        );

        await mkdir(outDir, { recursive: true });
        await Promise.all(
          pictures.map((result, index) =>
            writeFile(
              path.join(outDir, `${name}-${index + 1}.png`),
              Buffer.from(result.picture.split(",")[1], "base64"),
            ),
          ),
        );
        failed.forEach(({ line, reasons }, index) => {
          failures.push(
            `${name} ${line.name}: ${reasons.join(", ")} (${name}-${index + 1}.png)`,
          );
        });
      }

      if (
        lineEnds.length !== 2 ||
        lineEnds.some((offset) => Math.abs(offset) > 0.5)
      ) {
        failures.push(
          `${name} lines after a blank line end ${JSON.stringify(lineEnds)} from the right edge of the box`,
        );
      }

      console.log(
        `${name}: ${results.length} lines, ${inkCompared} compared by ink and ${results.length} by width, ${failed.length} differ`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}

assert.deepEqual(
  failures,
  [],
  `right-to-left lines differ from the browser's own text, pictures in ${outDir}`,
);
console.log("Right-to-left shaping matches the browser's own text");
