import { describe, expect, it } from "vitest";
import { parseText } from "../../src/plugins/elements/text/parseText.js";
import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { getTextPartDisplayText } from "../../src/plugins/elements/text/bidiTextLayout.js";

const RLO = "‮";
const LRO = "‭";
const PDF = "‬";
const ZWJ = "‍";

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
      content: [{ text: "مر" }, { text: "حبا", textStyle: { fill: "red" } }],
    });
    const [first, second] = node.content[0].lineParts;

    // ر does not join forwards in Unicode data, but both are joining
    // letters, so the joiner is requested and the shaper decides.
    expect(first.joinAfter).toBe(true);
    expect(second.joinBefore).toBe(true);
    expect(getTextPartDisplayText(first)).toBe(`${RLO}مر${ZWJ}${PDF}`);
    expect(getTextPartDisplayText(second)).toBe(`${RLO}${ZWJ}حبا${PDF}`);
    // A partly revealed run has no trailing joiner yet.
    expect(getTextPartDisplayText(second, "ح")).toBe(`${RLO}${ZWJ}ح${PDF}`);
    expect(getTextPartDisplayText(first, "م")).toBe(`${RLO}م${PDF}`);
  });

  it("drops letter spacing on right-to-left runs only", () => {
    const node = parseRtl({
      content: "שלום Hello",
      textStyle: { fontSize: 20, letterSpacing: 4 },
    });
    const [hebrew, latin] = node.content[0].lineParts;

    expect(hebrew.textStyle.letterSpacing).toBe(0);
    expect(latin.textStyle.letterSpacing).toBe(4);
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
