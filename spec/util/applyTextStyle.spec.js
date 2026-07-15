import { Text } from "pixi.js";
import { describe, expect, it } from "vitest";
import applyTextStyle from "../../src/util/applyTextStyle.js";

describe("applyTextStyle", () => {
  it("applies font weight and font style to plain text", () => {
    const text = new Text();

    applyTextStyle(text, {
      fontWeight: "700",
      fontStyle: "italic",
    });

    expect(text.style.fontWeight).toBe("700");
    expect(text.style.fontStyle).toBe("italic");
  });
});
