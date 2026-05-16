import { describe, expect, it } from "vitest";
import { getAnimationContinuitySignature } from "./planAnimations.js";

describe("getAnimationContinuitySignature", () => {
  it("includes compositor and transition uProgress tween in transition signatures", () => {
    const base = {
      id: "flip",
      targetId: "scene",
      type: "transition",
      playback: {
        continuity: "persistent",
      },
      compositor: {
        type: "shader",
        uniforms: [{ key: "amount", symbol: "uAmount", type: "f32", value: 1 }],
      },
      tween: {
        uProgress: {
          keyframes: [{ duration: 500, value: 1, easing: "linear" }],
        },
      },
    };

    expect(getAnimationContinuitySignature(base)).not.toBe(
      getAnimationContinuitySignature({
        ...base,
        tween: {
          uProgress: {
            keyframes: [{ duration: 900, value: 1, easing: "linear" }],
          },
        },
      }),
    );

    expect(getAnimationContinuitySignature(base)).not.toBe(
      getAnimationContinuitySignature({
        ...base,
        compositor: {
          ...base.compositor,
          uniforms: [
            { key: "amount", symbol: "uAmount", type: "f32", value: 0.5 },
          ],
        },
      }),
    );
  });
});
