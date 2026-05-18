import { describe, expect, it } from "vitest";
import {
  SUPPORTED_EASING_NAMES,
  buildTimeline,
  getEasingFunction,
  getValueAtTime,
} from "../../src/util/animationTimeline.js";

describe("animationTimeline easings", () => {
  it("resolves all supported easing names", () => {
    for (const easingName of SUPPORTED_EASING_NAMES) {
      expect(getEasingFunction(easingName)).toEqual(expect.any(Function));
    }
  });

  it("supports the quad easing family", () => {
    const sample = 0.37;

    expect(getEasingFunction("easeInQuad")(sample)).toBeCloseTo(
      sample * sample,
    );
    expect(getEasingFunction("easeOutQuad")(sample)).toBeCloseTo(
      1 - (1 - sample) * (1 - sample),
    );
    expect(getEasingFunction("easeInOutQuad")(sample)).toBeCloseTo(
      sample < 0.5 ? 2 * sample * sample : 1 - Math.pow(-2 * sample + 2, 2) / 2,
    );
  });

  it("supports representative advanced easing families", () => {
    expect(getEasingFunction("easeInCubic")(0.5)).toBeCloseTo(0.125);
    expect(getEasingFunction("easeOutSine")(0.5)).toBeCloseTo(
      Math.sin(Math.PI / 4),
    );
    expect(getEasingFunction("easeOutBounce")(0.5)).toBeGreaterThan(0.7);
    expect(getEasingFunction("easeInOutElastic")(0)).toBe(0);
    expect(getEasingFunction("easeInOutElastic")(1)).toBe(1);
  });

  it("applies the easing from the keyframe being reached", () => {
    const timeline = buildTimeline([
      { value: 0 },
      { duration: 1000, value: 100, easing: "easeInQuad" },
    ]);

    expect(getValueAtTime(timeline, 500)).toBeCloseTo(25);
  });

  it("does not shift later keyframe easings onto following segments", () => {
    const timeline = buildTimeline([
      { value: 0 },
      { duration: 1000, value: 100, easing: "easeInQuad" },
      { duration: 1000, value: 200, easing: "easeOutQuad" },
    ]);

    expect(getValueAtTime(timeline, 500)).toBeCloseTo(25);
    expect(getValueAtTime(timeline, 1500)).toBeCloseTo(175);
  });
});
