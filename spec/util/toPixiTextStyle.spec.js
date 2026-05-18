import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEXT_SHADOW,
  toPixiTextStyle,
} from "../../src/util/toPixiTextStyle.js";

describe("toPixiTextStyle", () => {
  it("maps public shadow offsets to Pixi dropShadow distance and angle", () => {
    const style = toPixiTextStyle({
      fill: "#ffffff",
      shadow: {
        color: "#112233",
        alpha: 0.45,
        blur: 6,
        offsetX: 3,
        offsetY: 4,
      },
    });

    expect(style).not.toHaveProperty("shadow");
    expect(style).not.toHaveProperty("dropShadowColor");
    expect(style.dropShadow).toMatchObject({
      color: "#112233",
      alpha: 0.45,
      blur: 6,
      distance: 5,
    });
    expect(style.dropShadow.angle).toBeCloseTo(Math.atan2(4, 3), 8);
    expect(style.padding).toBe(11);
  });

  it("uses visible defaults when shadow is enabled with an empty object", () => {
    const style = toPixiTextStyle({
      shadow: {},
    });

    expect(style.dropShadow).toMatchObject({
      color: DEFAULT_TEXT_SHADOW.color,
      alpha: DEFAULT_TEXT_SHADOW.alpha,
      blur: DEFAULT_TEXT_SHADOW.blur,
      distance: Math.hypot(
        DEFAULT_TEXT_SHADOW.offsetX,
        DEFAULT_TEXT_SHADOW.offsetY,
      ),
    });
  });

  it("maps null shadow to a disabled Pixi dropShadow", () => {
    const style = toPixiTextStyle({
      shadow: null,
    });

    expect(style.dropShadow).toBeNull();
    expect(style).not.toHaveProperty("padding");
  });

  it("does not expose Pixi dropShadow as public pass-through input", () => {
    const style = toPixiTextStyle({
      dropShadow: {
        color: "#ff0000",
        distance: 100,
      },
    });

    expect(style).not.toHaveProperty("dropShadow");
  });

  it("can omit dropShadow for text measurement styles", () => {
    const style = toPixiTextStyle(
      {
        padding: 2,
        shadow: {
          offsetX: 8,
          offsetY: 0,
        },
      },
      { includeShadow: false },
    );

    expect(style).not.toHaveProperty("dropShadow");
    expect(style.padding).toBe(2);
  });
});
