import { describe, expect, it } from "vitest";
import { parseText } from "../../src/plugins/elements/text/parseText.js";
import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import {
  getTextPartDisplayText,
  restyleBidiChunks,
} from "../../src/plugins/elements/text/bidiTextLayout.js";

const RLO = "‮";
const LRO = "‭";
const PDF = "‬";
const ZWJ = "‍";
const RLM = "\u200F";

const parseRtl = (overrides = {}) =>
  parseText({
    state: {
      id: "rtl",
      type: "text",
      x: 0,
      y: 0,
      direction: "rtl",
      textStyle: { fontSize: 20 },
      ...overrides,
    },
  });

const lineTexts = (node) =>
  node.content.map((chunk) => chunk.lineParts.map((part) => part.text));

// Parts of a line from left to right. Rich segments keep their trailing
// spaces as non-breaking ones; compare them as ordinary spaces.
const visualOrder = (chunk) =>
  [...chunk.lineParts]
    .sort((a, b) => a.x - b.x)
    .map((part) => part.text.replaceAll("\u00A0", " "));

const lineRight = (chunk) =>
  Math.max(...chunk.lineParts.map((part) => part.x + part.width));

describe("parseText with direction rtl", () => {
  it("leaves text untouched when direction is omitted or ltr", () => {
    const base = { id: "t", type: "text", x: 0, y: 0, content: "שלום" };
    const plain = parseText({ state: base });
    const ltr = parseText({ state: { ...base, direction: "ltr" } });

    expect(plain.content).toBe("שלום");
    expect(plain.direction).toBeUndefined();
    expect(ltr).toEqual(plain);
  });

  it("rejects unknown directions", () => {
    expect(() => parseRtl({ direction: "auto", content: "a" })).toThrow(
      "Input Error: direction must be one of ltr, rtl.",
    );
  });

  it("lays a plain string out as one right-to-left run", () => {
    const node = parseRtl({ content: "שלום עולם" });

    expect(node.direction).toBe("rtl");
    expect(lineTexts(node)).toEqual([["שלום עולם"]]);

    const [part] = node.content[0].lineParts;

    expect(part.direction).toBe("rtl");
    expect(part.x).toBeCloseTo(0, 5);
    expect(node.width).toBe(Math.round(part.width));
    expect(getTextPartDisplayText(part)).toBe(`${RLO}שלום עולם${PDF}`);
  });

  it("splits a line into level runs and orders them visually", () => {
    const node = parseRtl({ content: "שלום Hello World עולם" });
    const [chunk] = node.content;

    // Logical order is kept for reveals.
    expect(chunk.lineParts.map((part) => part.text)).toEqual([
      "שלום ",
      "Hello World",
      " עולם",
    ]);
    expect(chunk.lineParts.map((part) => part.direction)).toEqual([
      "rtl",
      "ltr",
      "rtl",
    ]);
    // The first word is on the right; the Latin phrase stays left to right.
    expect(visualOrder(chunk)).toEqual([" עולם", "Hello World", "שלום "]);
    expect(getTextPartDisplayText(chunk.lineParts[1])).toBe(
      `${LRO}Hello World${PDF}`,
    );
  });

  it("keeps a left-to-right phrase in order across style segments", () => {
    const node = parseRtl({
      content: [
        { text: "שלום " },
        { text: "Hello ", textStyle: { fill: "red" } },
        { text: "World" },
      ],
    });

    expect(visualOrder(node.content[0])).toEqual(["Hello ", "World", "שלום "]);
  });

  it("puts numbers left to right inside right-to-left text", () => {
    const node = parseRtl({ content: "שנת 2024 טובה" });
    const [chunk] = node.content;

    expect(chunk.lineParts.map((part) => part.text)).toEqual([
      "שנת ",
      "2024",
      " טובה",
    ]);
    expect(chunk.lineParts[1].direction).toBe("ltr");
    expect(visualOrder(chunk)).toEqual([" טובה", "2024", "שנת "]);
  });

  it("starts every line at the right edge of a fixed width box", () => {
    const node = parseRtl({
      width: 200,
      content: "שלום עולם שלום עולם שלום עולם שלום עולם שלום עולם",
    });

    expect(node.width).toBe(200);
    expect(node.content.length).toBeGreaterThan(1);

    for (const chunk of node.content) {
      expect(lineRight(chunk)).toBeCloseTo(200, 0);
      expect(chunk.inlineStartX).toBeCloseTo(200, 0);
      expect(chunk.direction).toBe("rtl");
    }
  });

  it("honours an authored alignment", () => {
    const content = "שלום\nשלום עולם שלום";
    const left = parseRtl({
      width: 400,
      content,
      textStyle: { align: "left" },
    });
    const center = parseRtl({
      width: 400,
      content,
      textStyle: { align: "center" },
    });
    const leftEdge = (chunk) =>
      Math.min(...chunk.lineParts.map((part) => part.x));

    expect(leftEdge(left.content[0])).toBeCloseTo(0, 5);
    expect(
      leftEdge(center.content[0]) + lineRight(center.content[0]),
    ).toBeCloseTo(400, 0);
  });

  it("joins an Arabic word that is split across style segments", () => {
    const node = parseRtl({
      content: [{ text: "مرح" }, { text: "با", textStyle: { fill: "red" } }],
    });
    const [first, second] = node.content[0].lineParts;

    expect(first.joinAfter).toBe(true);
    expect(second.joinBefore).toBe(true);
    expect(getTextPartDisplayText(first)).toBe(`${RLO}مرح${ZWJ}${RLM}${PDF}`);
    expect(getTextPartDisplayText(second)).toBe(`${RLO}${ZWJ}با${PDF}`);
  });

  it.each([
    ["مر", "حبا"],
    ["ا", "ب"],
    ["بو", "ب"],
    ["ء", "ب"],
    ["שלו", "ם"],
  ])(
    "does not force a join after a letter that ends its word shape (%s|%s)",
    (before, after) => {
      const node = parseRtl({
        content: [
          { text: before },
          { text: after, textStyle: { fill: "red" } },
        ],
      });
      const [first, second] = node.content[0].lineParts;

      expect(first.joinAfter).toBeUndefined();
      expect(second.joinBefore).toBeUndefined();
      expect(getTextPartDisplayText(first)).toBe(`${RLO}${before}${PDF}`);
      expect(getTextPartDisplayText(second)).toBe(`${RLO}${after}${PDF}`);
    },
  );

  it("joins across marks between two segments", () => {
    const node = parseRtl({
      content: [{ text: "بَ" }, { text: "ب", textStyle: { fill: "red" } }],
    });

    expect(node.content[0].lineParts[0].joinAfter).toBe(true);
  });

  it("shapes a partly revealed word as if the rest were there", () => {
    const node = parseRtl({ content: "مرحبا" });
    const [part] = node.content[0].lineParts;

    // م and ح join the letter after them; ر does not.
    expect(getTextPartDisplayText(part, "م")).toBe(`${RLO}م${ZWJ}${RLM}${PDF}`);
    expect(getTextPartDisplayText(part, "مر")).toBe(`${RLO}مر${PDF}`);
    expect(getTextPartDisplayText(part, "مرح")).toBe(
      `${RLO}مرح${ZWJ}${RLM}${PDF}`,
    );
    expect(getTextPartDisplayText(part)).toBe(`${RLO}مرحبا${PDF}`);
  });

  it("resolves directions before lines are broken", () => {
    const content = "שלום עולם hello, world שלום";
    const wrapped = [];

    for (let width = 30; width <= 400; width += 5) {
      const node = parseRtl({ content, width });
      const line = node.content.find(
        (chunk) =>
          chunk.lineParts
            .map((part) => part.text)
            .join("")
            .trimEnd()
            .endsWith("hello,") && node.content.length > 1,
      );

      if (line) wrapped.push(line);
    }

    expect(wrapped.length).toBeGreaterThan(0);

    for (const line of wrapped) {
      // The comma belongs to the English phrase, which continues on the
      // next line, so it stays to the right of "hello".
      const latin = line.lineParts.find((part) => part.text.includes("hello"));

      expect(latin.text.trimEnd()).toMatch(/hello,$/);
      expect(latin.direction).toBe("ltr");
    }
  });

  it("orders a number the same way wherever its line starts", () => {
    const content = "الهاتف رقمه هو 123-456 الآن";
    const orders = new Set();

    for (let width = 30; width <= 600; width += 5) {
      const node = parseRtl({ content, width });

      for (const chunk of node.content) {
        const first = chunk.lineParts.find((part) => part.text === "123");
        const second = chunk.lineParts.find((part) => part.text === "456");

        if (first && second) orders.add(Math.sign(first.x - second.x));
      }
    }

    // After Arabic letters the digits are Arabic numbers, and "-" does not
    // bind them: the second group is drawn to the left of the first.
    expect([...orders]).toEqual([1]);
  });

  it("gives every paragraph the base direction", () => {
    const node = parseRtl({ content: "abc שלום\nשלום abc" });

    expect(node.content.map(visualOrder)).toEqual([
      [" שלום", "abc"],
      ["abc", "שלום "],
    ]);
  });

  it("treats emoji as neutral characters", () => {
    const beside = parseRtl({ content: "שלום abc 😀 שלום" });
    const emoji = beside.content[0].lineParts.find((part) =>
      part.text.includes("😀"),
    );
    const latin = beside.content[0].lineParts.find(
      (part) => part.text === "abc",
    );

    expect(emoji.direction).toBe("rtl");
    expect(emoji.x).toBeLessThan(latin.x);

    const withNumber = parseRtl({ content: "אבג 😀 5 דהו" });
    const number = withNumber.content[0].lineParts.find(
      (part) => part.text === "5",
    );
    const face = withNumber.content[0].lineParts.find((part) =>
      part.text.includes("😀"),
    );

    expect(number.x).toBeLessThan(face.x);
    expect(lineTexts(parseRtl({ content: "😀😎" }))).toEqual([["😀😎"]]);
  });

  it("reads right-to-left scripts outside the basic plane", () => {
    const node = parseRtl({ content: "𞤀𞤁𞤂 abc" });

    expect(
      node.content[0].lineParts.map((part) => [part.text, part.direction]),
    ).toEqual([
      ["𞤀𞤁𞤂 ", "rtl"],
      ["abc", "ltr"],
    ]);
  });

  it("orders numbers in separate segments like numbers in one string", () => {
    const plain = parseRtl({ content: "100 200" });
    const rich = parseRtl({ content: [{ text: "100 " }, { text: "200" }] });
    const numbers = (node) =>
      visualOrder(node.content[0]).filter((text) => /\d/.test(text));

    expect(numbers(plain)).toEqual(["200", "100"]);
    expect(numbers(rich)).toEqual(["200", "100"]);
  });

  it("overlaps the stroke margins of neighbouring runs", () => {
    const node = parseRtl({
      content: "שלום 2024 שלום",
      textStyle: { fontSize: 20, strokeWidth: 6, strokeColor: "black" },
    });
    const parts = [...node.content[0].lineParts].sort((a, b) => a.x - b.x);

    expect(parts.length).toBeGreaterThan(1);

    for (let index = 1; index < parts.length; index++) {
      expect(parts[index].x).toBeCloseTo(
        parts[index - 1].x + parts[index - 1].width - 6,
        5,
      );
    }

    expect(node.measuredWidth).toBe(
      Math.round(parts.reduce((sum, part) => sum + part.width - 6, 0) + 6),
    );
  });

  it("reports the alignment the lines were laid out with", () => {
    expect(parseRtl({ content: "שלום" }).textStyle.align).toBe("right");
    expect(
      parseRtl({ content: "שלום", textStyle: { align: "center" } }).textStyle
        .align,
    ).toBe("center");
  });

  it("places the runs again for an interaction style", () => {
    const node = parseRtl({ content: "שלום Start עולם", width: 300 });
    const restyled = restyleBidiChunks(
      node.content,
      (style) => ({ ...style, fontSize: 30, letterSpacing: 5 }),
      { width: 300, align: "right" },
    );
    const before = [...node.content[0].lineParts].sort((a, b) => a.x - b.x);
    const after = [...restyled[0].lineParts].sort((a, b) => a.x - b.x);

    expect(after.map((part) => part.text)).toEqual(
      before.map((part) => part.text),
    );
    expect(after.every((part) => part.textStyle.fontSize === 30)).toBe(true);
    // Letter spacing never reaches a right-to-left run.
    expect(
      after
        .filter((part) => part.direction === "rtl")
        .every((part) => part.textStyle.letterSpacing === 0),
    ).toBe(true);

    for (let index = 1; index < after.length; index++) {
      expect(after[index].x).toBeCloseTo(
        after[index - 1].x + after[index - 1].width,
        5,
      );
    }

    expect(after.at(-1).x + after.at(-1).width).toBeCloseTo(300, 5);
    expect(restyled[0].inlineStartX).toBeCloseTo(300, 5);
  });

  it("drops letter spacing on right-to-left runs only", () => {
    const node = parseRtl({
      content: "שלום Hello",
      textStyle: { fontSize: 20, letterSpacing: 4 },
    });
    const [hebrew, latin] = node.content[0].lineParts;

    expect(hebrew.textStyle.letterSpacing).toBe(0);
    expect(latin.textStyle.letterSpacing).toBe(4);
    // Spaced text is drawn one character at a time and takes no override
    // characters, which would each be counted as a spaced character.
    expect(getTextPartDisplayText(latin)).toBe("Hello");
  });

  it("centres furigana over its base text", () => {
    const node = parseRtl({
      content: [
        { text: "שלום " },
        { text: "עולם", furigana: { text: "olam" } },
      ],
    });
    const base = node.content[0].lineParts.find((part) => part.furigana);
    const centre = base.x + base.width / 2;

    expect(base.furigana.x).toBeLessThan(centre);
    expect(base.furigana.x).toBeGreaterThanOrEqual(base.x - 20);
  });

  it("is ignored by vertical writing modes", () => {
    const node = parseRtl({ writingMode: "vertical-rl", content: "あい" });

    expect(node.direction).toBeUndefined();
    expect(node.content.every((chunk) => chunk.vertical)).toBe(true);
  });
});

describe("parseTextRevealing with direction rtl", () => {
  const parse = (overrides = {}) =>
    parseTextRevealing({
      state: {
        id: "reveal",
        type: "text-revealing",
        x: 0,
        y: 0,
        width: 300,
        direction: "rtl",
        content: [{ text: "שלום Hello עולם", textStyle: { fontSize: 20 } }],
        ...overrides,
      },
    });

  it("places lines from the right edge and keeps logical part order", () => {
    const node = parse();
    const [chunk] = node.content;

    expect(node.direction).toBe("rtl");
    expect(chunk.lineParts.map((part) => part.text)).toEqual([
      "שלום ",
      "Hello",
      " עולם",
    ]);
    expect(lineRight(chunk)).toBeCloseTo(300, 0);
    expect(visualOrder(chunk)).toEqual([" עולם", "Hello", "שלום "]);
  });

  it("does not report a direction for left-to-right text", () => {
    expect(parse({ direction: "ltr" }).direction).toBeUndefined();
    expect(parse({ direction: undefined }).direction).toBeUndefined();
  });
});
