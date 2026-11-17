import { describe, expect, it } from "vitest";
import { parseText } from "../../src/plugins/elements/text/parseText.js";
import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { getVerticalOrientation } from "../../src/util/verticalOrientation.js";

const FONT_SIZE = 20;
const LINE_HEIGHT = 2;
const COLUMN_WIDTH = FONT_SIZE * LINE_HEIGHT;

const parseVertical = (overrides = {}) =>
  parseText({
    state: {
      id: "vertical",
      type: "text",
      x: 0,
      y: 0,
      writingMode: "vertical-rl",
      textStyle: { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT },
      ...overrides,
    },
  });

const columnTexts = (node) =>
  node.content.map((chunk) =>
    chunk.lineParts.map((part) => part.text).join(""),
  );

describe("vertical orientation data", () => {
  it("classifies characters per UAX #50", () => {
    expect(getVerticalOrientation("A".codePointAt(0))).toBe("R");
    expect(getVerticalOrientation("1".codePointAt(0))).toBe("R");
    expect(getVerticalOrientation("猫".codePointAt(0))).toBe("U");
    expect(getVerticalOrientation("あ".codePointAt(0))).toBe("U");
    expect(getVerticalOrientation("、".codePointAt(0))).toBe("Tu");
    expect(getVerticalOrientation("っ".codePointAt(0))).toBe("Tu");
    expect(getVerticalOrientation("ー".codePointAt(0))).toBe("Tr");
    expect(getVerticalOrientation("「".codePointAt(0))).toBe("Tr");
  });
});

describe("parseText with writingMode vertical-rl", () => {
  it("leaves horizontal text untouched when writingMode is omitted", () => {
    const node = parseText({
      state: { id: "t", type: "text", x: 0, y: 0, content: "abc" },
    });

    expect(node.writingMode).toBeUndefined();
    expect(node.content).toBe("abc");
  });

  it("rejects unknown writing modes", () => {
    expect(() =>
      parseVertical({ content: "あ", writingMode: "sideways" }),
    ).toThrow(/writingMode must be one of/);
  });

  it("stacks upright characters one em apart in a single column", () => {
    const node = parseVertical({ content: "あいう" });

    expect(node.writingMode).toBe("vertical-rl");
    expect(node.content).toHaveLength(1);
    expect(node.width).toBe(COLUMN_WIDTH);
    expect(node.height).toBe(FONT_SIZE * 3);

    const parts = node.content[0].lineParts;

    expect(parts.map((part) => part.text)).toEqual(["あ", "い", "う"]);
    expect(parts.map((part) => part.inlineStart)).toEqual([0, 20, 40]);
    expect(parts.every((part) => part.atomic === true)).toBe(true);
    expect(parts.every((part) => part.rotation === undefined)).toBe(true);
  });

  it("wraps on height and flows columns from right to left", () => {
    const node = parseVertical({ content: "あいうえおかき", height: 60 });

    expect(columnTexts(node)).toEqual(["あいう", "えおか", "き"]);
    expect(node.height).toBe(60);
    expect(node.width).toBe(COLUMN_WIDTH * 3);
    expect(node.content.map((chunk) => chunk.x)).toEqual([80, 40, 0]);
    expect(node.content.map((chunk) => chunk.centerX)).toEqual([100, 60, 20]);
  });

  it("starts a new column at explicit newlines and keeps blank columns", () => {
    const node = parseVertical({ content: "あい\n\nう" });

    expect(columnTexts(node)).toEqual(["あい", "", "う"]);
    expect(node.width).toBe(COLUMN_WIDTH * 3);
  });

  it("starts columns at the right edge of a fixed width box", () => {
    const node = parseVertical({ content: "あ\nい", width: 200 });

    expect(node.width).toBe(200);
    expect(node.measuredWidth).toBe(COLUMN_WIDTH * 2);
    expect(node.content.map((chunk) => chunk.x)).toEqual([160, 120]);
  });

  it("aligns columns along their length", () => {
    const start = parseVertical({ content: "あ", height: 100 });
    const center = parseVertical({
      content: "あ",
      height: 100,
      textStyle: {
        fontSize: FONT_SIZE,
        lineHeight: LINE_HEIGHT,
        align: "center",
      },
    });
    const end = parseVertical({
      content: "あ",
      height: 100,
      textStyle: {
        fontSize: FONT_SIZE,
        lineHeight: LINE_HEIGHT,
        align: "right",
      },
    });

    expect(start.content[0].inlineStart).toBe(0);
    expect(center.content[0].inlineStart).toBe(40);
    expect(end.content[0].inlineStart).toBe(80);
  });

  it("does not start a column with closing punctuation", () => {
    const node = parseVertical({ content: "あいう。えお", height: 60 });

    expect(columnTexts(node)).toEqual(["あい", "う。え", "お"]);
  });

  it("does not end a column with an opening bracket", () => {
    const node = parseVertical({ content: "あい「うえ」", height: 60 });

    // The bracket is carried to the next column, and the last character
    // moves on with the closing bracket so it does not start a column.
    expect(columnTexts(node)).toEqual(["あい", "「う", "え」"]);
  });

  it("sets Latin words sideways as one rotated part", () => {
    const node = parseVertical({ content: "猫Route Graphics犬" });
    const parts = node.content[0].lineParts;

    expect(parts.map((part) => part.text)).toEqual([
      "猫",
      "Route Graphics",
      "犬",
    ]);
    expect(parts[1].rotation).toBe(90);
    expect(parts[1].atomic).toBeUndefined();
    expect(parts[1].inlineStart).toBe(20);
    expect(parts[2].inlineStart).toBeCloseTo(parts[1].inlineEnd, 5);
  });

  it("breaks between sideways words when a column is full", () => {
    const node = parseVertical({ content: "alpha beta gamma", height: 85 });

    expect(columnTexts(node).map((text) => text.trim())).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("combines one or two digits upright in a single cell", () => {
    const node = parseVertical({ content: "第12話" });
    const parts = node.content[0].lineParts;

    expect(parts.map((part) => part.text)).toEqual(["第", "12", "話"]);
    expect(parts[1].rotation).toBeUndefined();
    expect(parts[1].atomic).toBe(true);
    expect(parts[1].inlineEnd - parts[1].inlineStart).toBe(FONT_SIZE);
    expect(node.height).toBe(FONT_SIZE * 3);
  });

  it("sets a lone Latin letter upright but keeps words sideways", () => {
    const node = parseVertical({ content: "3年B組のAB" });
    const parts = node.content[0].lineParts;

    expect(parts.map((part) => part.text)).toEqual([
      "3",
      "年",
      "B",
      "組",
      "の",
      "AB",
    ]);
    expect(parts[2].rotation).toBeUndefined();
    expect(parts[5].rotation).toBe(90);
  });

  it("turns the shadow of sideways parts so it falls the same way on screen", () => {
    const node = parseVertical({
      content: [
        {
          text: "影Shadow",
          textStyle: { shadow: { offsetX: 4, offsetY: 2 } },
        },
      ],
    });
    const [upright, sideways] = node.content[0].lineParts;

    expect(upright.textStyle.shadow).toMatchObject({ offsetX: 4, offsetY: 2 });
    expect(sideways.textStyle.shadow).toMatchObject({
      offsetX: 2,
      offsetY: -4,
    });
  });

  it("keeps longer numbers sideways", () => {
    const node = parseVertical({ content: "西暦2026年" });
    const parts = node.content[0].lineParts;

    expect(parts.map((part) => part.text)).toEqual(["西", "暦", "2026", "年"]);
    expect(parts[2].rotation).toBe(90);
  });

  it("rotates transformed punctuation when the font has no vertical glyphs", () => {
    const node = parseVertical({ content: "あー「い」、" });
    const parts = node.content[0].lineParts;

    expect(parts.map((part) => part.rotation)).toEqual([
      undefined,
      90,
      90,
      undefined,
      90,
      undefined,
    ]);
    // Corner punctuation moves towards the upper right of its cell.
    expect(parts[5].y).toBeLessThan(parts[3].y + FONT_SIZE * 2);
  });

  it("places furigana beside the column and keeps the base together", () => {
    const node = parseVertical({
      height: 60,
      content: [
        { text: "あい" },
        {
          text: "漢字",
          furigana: { text: "かんじ", textStyle: { fontSize: 10 } },
        },
      ],
    });

    expect(columnTexts(node)).toEqual(["あい", "漢字"]);

    const [base] = node.content[1].lineParts;

    expect(base.furigana.text).toBe("か\nん\nじ");
    expect(base.furigana.x).toBeGreaterThan(node.content[1].centerX);

    const left = parseVertical({
      content: [
        {
          text: "漢字",
          furigana: {
            text: "かんじ",
            placement: "bottom",
            textStyle: { fontSize: 10 },
          },
        },
      ],
    });

    expect(left.content[0].lineParts[0].furigana.x).toBeLessThan(
      left.content[0].centerX,
    );
  });

  it("widens the base when furigana is longer than it", () => {
    const node = parseVertical({
      content: [
        {
          text: "私",
          furigana: { text: "わたくし", textStyle: { fontSize: 10 } },
        },
        { text: "は" },
      ],
    });
    const [base, next] = node.content[0].lineParts;

    expect(base.inlineStart).toBe(10);
    expect(next.inlineStart).toBe(40);
  });

  it("draws underlines as a sideline on the right of the column", () => {
    const node = parseVertical({
      content: [{ text: "あAB", textStyle: { textDecoration: "underline" } }],
    });
    const [upright, sideways] = node.content[0].lineParts;
    const [rect] = upright.decorationRectangles;

    expect(upright.x + rect.x).toBeGreaterThan(node.content[0].centerX);
    expect(rect.height).toBe(FONT_SIZE);
    expect(sideways.decorationLine).toBeDefined();
  });
});

describe("parseTextRevealing with writingMode vertical-rl", () => {
  it("lays out vertical columns and reports the wrap height", () => {
    const node = parseTextRevealing({
      state: {
        id: "reveal",
        type: "text-revealing",
        x: 0,
        y: 0,
        height: 60,
        writingMode: "vertical-rl",
        content: [
          {
            text: "あいうえお",
            textStyle: { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT },
          },
        ],
      },
    });

    expect(node.writingMode).toBe("vertical-rl");
    expect(node.height).toBe(60);
    expect(node.width).toBe(COLUMN_WIDTH * 2);
    expect(node.content.every((chunk) => chunk.vertical)).toBe(true);
  });

  it("does not report a writing mode for horizontal text", () => {
    const node = parseTextRevealing({
      state: {
        id: "reveal",
        type: "text-revealing",
        x: 0,
        y: 0,
        content: [{ text: "abc" }],
      },
    });

    expect(node.writingMode).toBeUndefined();
  });
});
