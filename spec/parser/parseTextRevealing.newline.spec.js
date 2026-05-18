import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

describe("parseTextRevealing newline layout", () => {
  it("splits explicit newlines into reveal chunks with computed dimensions", () => {
    const parsed = parseTextRevealing({
      state: {
        id: "reveal-newline-anchor",
        type: "text-revealing",
        content: [
          {
            text: "REVEAL TOP\nREVEAL BOTTOM",
            textStyle: {
              fontSize: 30,
              lineHeight: 1.25,
              fill: "#FFFFFF",
              fontFamily: "Arial",
            },
          },
        ],
        x: 360,
        y: 140,
        width: 300,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 1,
        speed: 100,
        revealEffect: "none",
      },
    });

    expect(parsed.width).toBe(300);
    expect(parsed.height).toBe(76);
    expect(parsed.x).toBe(210);
    expect(parsed.y).toBe(102);
    expect(parsed.originX).toBe(150);
    expect(parsed.originY).toBe(38);
    expect(parsed.alpha).toBe(1);
    expect(parsed.speed).toBe(100);
    expect(parsed.revealEffect).toBe("none");

    expect(parsed.content).toHaveLength(2);
    expect(parsed.content.map((chunk) => chunk.y)).toEqual([0, 38]);
    expect(parsed.content.map((chunk) => chunk.lineMaxHeight)).toEqual([
      38, 38,
    ]);
    expect(
      parsed.content.map((chunk) =>
        chunk.lineParts.map((part) => part.text).join(""),
      ),
    ).toEqual(["REVEAL TOP", "REVEAL BOTTOM"]);
    expect(parsed.content.every((chunk) => chunk.lineParts.length === 1)).toBe(
      true,
    );
    expect(parsed.content.every((chunk) => chunk.lineParts[0].x === 0)).toBe(
      true,
    );
    expect(parsed.content.map((chunk) => chunk.lineParts[0].y)).toEqual([
      0, 38,
    ]);
    expect(parsed.content[0].lineParts[0].textStyle.lineHeight).toBe(38);
    expect(parsed.content[0].lineParts[0].textStyle.wordWrapWidth).toBe(300);
    expect(parsed.content[1].lineParts[0].textStyle.wordWrapWidth).toBe(300);
  });

  it("preserves explicit newline boundaries between styled segments", () => {
    const parsed = parseTextRevealing({
      state: {
        id: "reveal-newline-segments",
        type: "text-revealing",
        width: 300,
        content: [
          {
            text: "FIRST\n",
            textStyle: {
              fontSize: 24,
              fill: "#FFFFFF",
              fontFamily: "Arial",
            },
          },
          {
            text: "SECOND",
            textStyle: {
              fontSize: 24,
              fill: "#D9D9D9",
              fontFamily: "Arial",
            },
          },
        ],
      },
    });

    expect(parsed.content).toHaveLength(2);
    expect(
      parsed.content.map((chunk) =>
        chunk.lineParts.map((part) => part.text).join(""),
      ),
    ).toEqual(["FIRST", "SECOND"]);
    expect(parsed.content[1].y).toBeGreaterThan(parsed.content[0].y);
    expect(parsed.content[0].lineParts[0].textStyle.fill).toBe("#FFFFFF");
    expect(parsed.content[1].lineParts[0].textStyle.fill).toBe("#D9D9D9");
  });
});
