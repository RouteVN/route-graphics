import { describe, expect, it } from "vitest";
import { Graphics } from "pixi.js";
import { parseText } from "./parseText.js";
import { createTextDisplayObject } from "./addText.js";
import applyTextStyle from "../../../util/applyTextStyle.js";

const createDisplay = (content, textStyle = {}) => {
  const computed = parseText({
    state: {
      id: "underlined-text",
      type: "text",
      x: 0,
      y: 0,
      content,
      textStyle: { fill: "#ff0000", fontSize: 24, ...textStyle },
    },
  });

  return createTextDisplayObject(computed, 0);
};

const getUnderlineWidth = (graphics) =>
  graphics.context.instructions[0].data.path.bounds.maxX;

describe("text decoration", () => {
  it("draws an underline for plain text", () => {
    const display = createDisplay("Underlined\nagain", {
      textDecoration: "underline",
    });

    const underline = display.children.find(
      (child) => child instanceof Graphics,
    );
    expect(underline.context.instructions).toHaveLength(2);
    display.destroy({ children: true });
  });

  it("draws an underline for a rich text segment", () => {
    const display = createDisplay([
      { text: "Underlined", textStyle: { textDecoration: "underline" } },
    ]);
    const segment = display.children[0].children[0];

    expect(segment.children.some((child) => child instanceof Graphics)).toBe(
      true,
    );
    display.destroy({ children: true });
  });

  it("keeps the underline synced with text changes and removes it with the style", () => {
    const display = createDisplay("Short", {
      textDecoration: "underline",
    });
    const underline = display.children.find(
      (child) => child instanceof Graphics,
    );
    const initialWidth = getUnderlineWidth(underline);

    display.text = "A much longer line";
    display.onRender();
    expect(getUnderlineWidth(underline)).toBeGreaterThan(initialWidth);

    applyTextStyle(display, {
      fill: "#ff0000",
      fontSize: 24,
      textDecoration: "none",
    });
    expect(display.children).not.toContain(underline);
    display.destroy({ children: true });
  });
});
