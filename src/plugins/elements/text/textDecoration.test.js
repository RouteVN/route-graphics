import { describe, expect, it, vi } from "vitest";
import { CanvasTextMetrics, Color, Graphics, Text } from "pixi.js";
import { parseText } from "./parseText.js";
import { createTextDisplayObject } from "./addText.js";
import applyTextStyle from "../../../util/applyTextStyle.js";

const createDisplay = (content, textStyle = {}, state = {}) => {
  const computed = parseText({
    state: {
      id: "underlined-text",
      type: "text",
      x: 0,
      y: 0,
      content,
      textStyle: { fill: "#ff0000", fontSize: 24, ...textStyle },
      ...state,
    },
  });

  return createTextDisplayObject(computed, 0);
};

const parseUnderlineStyle = (textStyle) =>
  parseText({
    state: {
      id: "underlined-text",
      type: "text",
      x: 0,
      y: 0,
      content: "ignored",
      textStyle: { fill: "#ff0000", fontSize: 24, ...textStyle },
    },
  }).textStyle;

const getUnderline = (textObject) =>
  textObject.children.find((child) => child instanceof Graphics);

const getUnderlineRects = (graphics) =>
  graphics.context.instructions.map(({ data }) => {
    const { minX, minY, maxX, maxY } = data.path.bounds;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      color: data.style.color,
    };
  });

const measure = (textObject) =>
  CanvasTextMetrics.measureText(textObject.text, textObject.style);

const colorNumber = (fill) => new Color(fill).toNumber();

// Mirrors the decoration alignment rule: underlines follow each measured line
// inside the text object, exactly like the glyphs do.
const getAlignmentOffset = (metrics, lineWidth, align) =>
  align === "right"
    ? metrics.maxLineWidth - lineWidth
    : align === "center"
      ? (metrics.maxLineWidth - lineWidth) / 2
      : 0;

const getExpectedUnderlineY = (metrics, index, fontSize, strokeWidth = 0) => {
  const lineThickness = Math.max(1, fontSize / 16);
  const lineShift = Math.max(
    0,
    (metrics.lineHeight - metrics.fontProperties.fontSize) / 2,
  );

  return Math.max(
    0,
    Math.min(
      metrics.height - lineThickness,
      strokeWidth / 2 +
        index * metrics.lineHeight +
        metrics.fontProperties.ascent +
        lineShift +
        fontSize * 0.06,
    ),
  );
};

describe("text decoration", () => {
  it("draws one underline per line, sized and placed from measured text metrics", () => {
    const display = createDisplay("Underlined\nagain", {
      textDecoration: "underline",
    });
    const underline = getUnderline(display);
    const metrics = measure(display);
    const rects = getUnderlineRects(underline);

    expect(rects).toHaveLength(metrics.lineWidths.length);
    rects.forEach((rect, index) => {
      expect(rect.width).toBeCloseTo(metrics.lineWidths[index], 2);
      expect(rect.height).toBeCloseTo(Math.max(1, 24 / 16), 2);
      expect(rect.x).toBeCloseTo(0, 2);
      expect(rect.y).toBeCloseTo(getExpectedUnderlineY(metrics, index, 24), 2);
      expect(rect.color).toBe(colorNumber("#ff0000"));
    });
    expect(rects[1].y - rects[0].y).toBeCloseTo(metrics.lineHeight, 2);
    display.destroy({ children: true });
  });

  it("sinks the underline with the ascent gap of a taller line height", () => {
    const display = createDisplay("Underlined\nagain", {
      textDecoration: "underline",
      lineHeight: 2,
    });
    const metrics = measure(display);

    // Precondition: the taller line height must actually open an ascent gap,
    // otherwise this case would silently degenerate into the default one.
    expect(metrics.lineHeight).toBeGreaterThan(metrics.fontProperties.fontSize);

    const rects = getUnderlineRects(getUnderline(display));
    rects.forEach((rect, index) => {
      expect(rect.y).toBeCloseTo(getExpectedUnderlineY(metrics, index, 24), 2);
    });
    expect(rects[1].y - rects[0].y).toBeCloseTo(metrics.lineHeight, 2);
    display.destroy({ children: true });
  });

  it.each(["center", "right"])(
    "offsets each line's underline for %s alignment",
    (align) => {
      const display = createDisplay(
        "Short line\nA considerably longer line",
        { textDecoration: "underline", align },
        { width: 500 },
      );
      const metrics = measure(display);
      const rects = getUnderlineRects(getUnderline(display));

      expect(metrics.lineWidths).toHaveLength(2);
      rects.forEach((rect, index) => {
        expect(rect.x).toBeCloseTo(
          getAlignmentOffset(metrics, metrics.lineWidths[index], align),
          2,
        );
      });

      if (align === "right") {
        rects.forEach((rect) => {
          expect(rect.x + rect.width).toBeCloseTo(metrics.maxLineWidth, 2);
        });
      } else {
        rects.forEach((rect, index) => {
          expect(rect.x + rect.width).toBeCloseTo(
            (metrics.maxLineWidth + metrics.lineWidths[index]) / 2,
            2,
          );
        });
      }
      display.destroy({ children: true });
    },
  );

  it("restyles the underline fill and font size in place", () => {
    const display = createDisplay("Hello", {
      textDecoration: "underline",
    });
    const underline = getUnderline(display);

    applyTextStyle(
      display,
      parseUnderlineStyle({
        fill: "#00ff00",
        fontSize: 48,
        textDecoration: "underline",
      }),
    );

    expect(getUnderline(display)).toBe(underline);
    const rects = getUnderlineRects(underline);
    const metrics = measure(display);
    expect(rects).toHaveLength(1);
    expect(rects[0].color).toBe(colorNumber("#00ff00"));
    expect(rects[0].width).toBeCloseTo(metrics.lineWidths[0], 2);
    expect(rects[0].height).toBeCloseTo(Math.max(1, 48 / 16), 2);
    expect(rects[0].y).toBeCloseTo(getExpectedUnderlineY(metrics, 0, 48), 2);
    display.destroy({ children: true });
  });

  it("keeps the underline synced with text changes and removes it with the style", () => {
    const display = createDisplay("Short", {
      textDecoration: "underline",
    });
    const underline = getUnderline(display);
    expect(getUnderlineRects(underline)[0].width).toBeCloseTo(
      measure(display).lineWidths[0],
      2,
    );

    display.text = "A much longer line";
    display.onRender();
    expect(getUnderlineRects(underline)[0].width).toBeCloseTo(
      measure(display).lineWidths[0],
      2,
    );

    display.text = "Hi";
    display.onRender();
    expect(getUnderlineRects(underline)[0].width).toBeCloseTo(
      measure(display).lineWidths[0],
      2,
    );

    applyTextStyle(
      display,
      parseUnderlineStyle({
        fill: "#ff0000",
        fontSize: 24,
        textDecoration: "none",
      }),
    );
    expect(display.children).not.toContain(underline);
    expect(underline.destroyed).toBe(true);
    expect(display.allowChildren).toBe(false);

    applyTextStyle(
      display,
      parseUnderlineStyle({ textDecoration: "underline" }),
    );
    const reapplied = getUnderline(display);
    expect(reapplied).toBeDefined();
    expect(reapplied).not.toBe(underline);
    expect(getUnderlineRects(reapplied)[0].width).toBeCloseTo(
      measure(display).lineWidths[0],
      2,
    );
    display.destroy({ children: true });
  });

  it("draws nothing for empty text and recovers once text arrives", () => {
    const display = createDisplay("", { textDecoration: "underline" });
    const underline = getUnderline(display);

    expect(underline).toBeDefined();
    expect(getUnderlineRects(underline)).toHaveLength(0);

    display.text = "Arrived text";
    display.onRender();
    const rects = getUnderlineRects(underline);
    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeCloseTo(measure(display).lineWidths[0], 2);
    display.destroy({ children: true });
  });

  it("chains a previous onRender and restores it when the decoration is removed", () => {
    const display = createDisplay("Changed", {
      textDecoration: "none",
    });
    const previousOnRender = vi.fn(() => {
      display.text = "Late";
    });
    display.onRender = previousOnRender;

    applyTextStyle(
      display,
      parseUnderlineStyle({ textDecoration: "underline" }),
    );
    expect(display.onRender).not.toBe(previousOnRender);

    display.onRender();
    expect(previousOnRender).toHaveBeenCalledTimes(1);
    // The chained callback runs before the underline redraw, so the underline
    // must already reflect the text set by the previous onRender.
    expect(getUnderlineRects(getUnderline(display))[0].width).toBeCloseTo(
      measure(display).lineWidths[0],
      2,
    );
    expect(display.text).toBe("Late");

    applyTextStyle(display, parseUnderlineStyle({ textDecoration: "none" }));
    expect(display.onRender).toBe(previousOnRender);
    display.onRender();
    expect(previousOnRender).toHaveBeenCalledTimes(2);
    display.destroy({ children: true });
  });

  it("leaves a replaced onRender untouched when the decoration is removed", () => {
    const display = createDisplay("Hello", {
      textDecoration: "underline",
    });
    const replacementOnRender = vi.fn();
    display.onRender = replacementOnRender;

    applyTextStyle(display, parseUnderlineStyle({ textDecoration: "none" }));
    expect(display.onRender).toBe(replacementOnRender);
    display.onRender();
    expect(replacementOnRender).toHaveBeenCalledTimes(1);
    display.destroy({ children: true });
  });

  it("underlines only the decorated rich text segment", () => {
    const display = createDisplay(
      [
        { text: "Plain words ", textStyle: {} },
        {
          text: "underlined words",
          textStyle: { textDecoration: "underline" },
        },
      ],
      { fill: "#ff0000", fontSize: 24 },
    );
    const parts = display.children[0].children.filter(
      (child) => child instanceof Text,
    );
    // Trailing spaces are normalized to non-breaking spaces while parsing.
    const plainPart = parts.find((part) => part.text.startsWith("Plain words"));
    const underlinedPart = parts.find(
      (part) => part.text === "underlined words",
    );

    expect(getUnderline(plainPart)).toBeUndefined();
    const rects = getUnderlineRects(getUnderline(underlinedPart));
    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeCloseTo(
      measure(underlinedPart).lineWidths[0],
      2,
    );
    expect(rects[0].color).toBe(colorNumber("#ff0000"));
    display.destroy({ children: true });
  });

  it("underlines decorated furigana without decorating the base text", () => {
    const display = createDisplay(
      [
        {
          text: "base text",
          furigana: {
            text: "hint",
            textStyle: { textDecoration: "underline", fontSize: 12 },
          },
        },
      ],
      { fill: "#ff0000", fontSize: 24 },
    );
    const parts = display.children[0].children.filter(
      (child) => child instanceof Text,
    );
    const basePart = parts.find((part) => part.text === "base text");
    const furiganaPart = parts.find((part) => part.text === "hint");

    expect(getUnderline(basePart)).toBeUndefined();
    const rects = getUnderlineRects(getUnderline(furiganaPart));
    const metrics = measure(furiganaPart);
    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeCloseTo(metrics.lineWidths[0], 2);
    expect(rects[0].y + rects[0].height).toBeLessThanOrEqual(metrics.height);
    display.destroy({ children: true });
  });
});
