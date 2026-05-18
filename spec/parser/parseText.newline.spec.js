import { describe, expect, it } from "vitest";

import { parseText } from "../../src/plugins/elements/text/parseText.js";

describe("parseText newline layout", () => {
  it("measures explicit newlines and applies anchor-adjusted coordinates", () => {
    const parsed = parseText({
      state: {
        id: "text-newline-anchor",
        type: "text",
        content: "TOP\nBOTTOM",
        x: 360,
        y: 140,
        anchorX: 0.5,
        anchorY: 0.5,
        textStyle: {
          fontSize: 32,
          lineHeight: 1.25,
          fill: "#FFFFFF",
          fontFamily: "Arial",
        },
      },
    });

    expect(parsed.content).toBe("TOP\nBOTTOM");
    expect(parsed.measuredWidth).toBe(134);
    expect(parsed.width).toBe(134);
    expect(parsed.height).toBe(80);
    expect(parsed.x).toBe(293);
    expect(parsed.y).toBe(100);
    expect(parsed.originX).toBe(67);
    expect(parsed.originY).toBe(40);
    expect(parsed.textStyle.lineHeight).toBe(40);
  });

  it("keeps fixed width separate from measured newline text width", () => {
    const parsed = parseText({
      state: {
        id: "text-newline-fixed-center",
        type: "text",
        content: "LEFT\nRIGHT",
        x: 560,
        y: 108,
        width: 260,
        textStyle: {
          fontSize: 30,
          lineHeight: 1.25,
          fill: "#FFFFFF",
          fontFamily: "Arial",
          align: "center",
        },
      },
    });

    expect(parsed.content).toBe("LEFT\nRIGHT");
    expect(parsed.width).toBe(260);
    expect(parsed.measuredWidth).toBe(92);
    expect(parsed.height).toBe(76);
    expect(parsed.x).toBe(560);
    expect(parsed.y).toBe(108);
    expect(parsed.originX).toBe(0);
    expect(parsed.originY).toBe(0);
    expect(parsed.textStyle.wordWrap).toBe(true);
    expect(parsed.textStyle.wordWrapWidth).toBe(260);
    expect(parsed.textStyle.lineHeight).toBe(38);
  });
});
