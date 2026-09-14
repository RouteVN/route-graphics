import { CanvasTextMetrics, Text } from "pixi.js";
import { describe, expect, it } from "vitest";
import applyTextStyle from "../../src/util/applyTextStyle.js";
import { parseText } from "../../src/plugins/elements/text/parseText.js";
import {
  applyTextDisplayStyle,
  createTextDisplayObject,
} from "../../src/plugins/elements/text/addText.js";

describe("applyTextStyle", () => {
  it("applies ordered font family fallbacks to Pixi text", () => {
    const text = new Text();

    applyTextStyle(text, {
      fontFamily: ["uiFont", "fallbackFont"],
    });

    expect(text.style.fontFamily).toEqual(["uiFont", "fallbackFont"]);
  });

  it("applies font weight and font style to plain text", () => {
    const text = new Text();

    applyTextStyle(text, {
      fontWeight: "700",
      fontStyle: "italic",
    });

    expect(text.style.fontWeight).toBe("700");
    expect(text.style.fontStyle).toBe("italic");
  });

  it.each([-2, 0, 3.5])(
    "keeps parser and display widths aligned at spacing %s",
    (letterSpacing) => {
      const computed = parseText({
        state: {
          id: "text",
          type: "text",
          x: 100,
          y: 100,
          width: 130,
          content: "AVA office WWWW next line",
          textStyle: { fontSize: 24, letterSpacing, align: "center" },
        },
      });
      const text = createTextDisplayObject(computed, 0);
      try {
        expect(text.style.letterSpacing).toBe(letterSpacing);
        const measured = CanvasTextMetrics.measureText(text.text, text.style);
        expect(Math.round(measured.width)).toBe(computed.measuredWidth);
        expect(Math.round(measured.height)).toBe(computed.height);
      } finally {
        text.destroy();
      }
    },
  );

  it.each(["pre", "normal", "pre-line"])(
    "keeps parser and display wrapping aligned with %s whitespace",
    (whiteSpace) => {
      const computed = parseText({
        state: {
          id: "text",
          type: "text",
          x: 0,
          y: 0,
          width: 120,
          content: "  One   two\n\nThree    four",
          textStyle: { fontSize: 24, whiteSpace },
        },
      });
      const text = createTextDisplayObject(computed, 0);
      try {
        expect(text.style.whiteSpace).toBe(whiteSpace);
        const measured = CanvasTextMetrics.measureText(text.text, text.style);
        expect(Math.round(measured.width)).toBe(computed.measuredWidth);
        expect(Math.round(measured.height)).toBe(computed.height);
      } finally {
        text.destroy();
      }
    },
  );

  it("restores base layout styles after an interaction without mutating input", () => {
    const style = Object.freeze({
      fontSize: 24,
      letterSpacing: 2,
      whiteSpace: "normal",
    });
    const computed = parseText({
      state: {
        id: "text",
        type: "text",
        x: 0,
        y: 0,
        width: 180,
        content: "AVA   office\nNext",
        textStyle: style,
      },
    });
    Object.freeze(computed.textStyle);
    const override = Object.freeze({
      letterSpacing: -1,
      whiteSpace: "pre-line",
    });
    const text = createTextDisplayObject(computed, 0);
    try {
      applyTextDisplayStyle(text, computed, override);
      expect(text.style.letterSpacing).toBe(-1);
      expect(text.style.whiteSpace).toBe("pre-line");
      applyTextDisplayStyle(text, computed);
      expect(text.style.letterSpacing).toBe(2);
      expect(text.style.whiteSpace).toBe("normal");
      expect(computed.textStyle).toMatchObject(style);
      expect(override).toEqual({ letterSpacing: -1, whiteSpace: "pre-line" });
    } finally {
      text.destroy();
    }
  });
});
