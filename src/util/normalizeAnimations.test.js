import { describe, expect, it } from "vitest";
import { normalizeAnimations } from "./normalizeAnimations.js";

const compositor = {
  type: "shader",
  source: {
    webgl: {
      fragment: `
        in vec2 vTextureCoord;
        out vec4 finalColor;
        uniform sampler2D uTexture;
        uniform sampler2D uNextTexture;
        uniform float uProgress;
        void main() {
          finalColor = mix(texture(uTexture, vTextureCoord), texture(uNextTexture, vTextureCoord), uProgress);
        }
      `,
    },
    webgpu: {
      source: `
        struct VSOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
        };
        @vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
          return VSOutput(vec4<f32>(aPosition, 0.0, 1.0), aPosition);
        }
        @fragment fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          return vec4<f32>(uv, 0.0, 1.0);
        }
      `,
    },
  },
};

const progressTween = {
  uProgress: {
    initialValue: 0,
    keyframes: [{ duration: 100, value: 1, easing: "linear" }],
  },
};

describe("normalizeAnimations shader support", () => {
  it("allows uProgress as an update tween property", () => {
    const [animation] = normalizeAnimations([
      {
        id: "pulse",
        targetId: "scene",
        type: "update",
        tween: progressTween,
      },
    ]);

    expect(animation.tween.uProgress.keyframes[0].value).toBe(1);
  });

  it("rejects multiple uProgress update tweens for the same target", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "a",
          targetId: "scene",
          type: "update",
          tween: progressTween,
        },
        {
          id: "b",
          targetId: "scene",
          type: "update",
          tween: progressTween,
        },
      ]),
    ).toThrow(/multiple active uProgress update tweens/);
  });

  it("allows a transition compositor with required tween.uProgress", () => {
    const [animation] = normalizeAnimations([
      {
        id: "crossfade",
        targetId: "scene",
        type: "transition",
        tween: progressTween,
        compositor,
      },
    ]);

    expect(animation.compositor.type).toBe("shader");
    expect(animation.tween.uProgress.keyframes[0].duration).toBe(100);
  });

  it("rejects transition tween without a compositor", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad",
          targetId: "scene",
          type: "transition",
          tween: progressTween,
          mask: {
            kind: "single",
            texture: "mask-diagonal",
          },
        },
      ]),
    ).toThrow(/tween is not valid for transition animations/);
  });

  it("rejects a compositor without tween.uProgress", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad",
          targetId: "scene",
          type: "transition",
          compositor,
        },
      ]),
    ).toThrow(/tween\.uProgress is required/);
  });

  it("rejects mask and compositor on the same transition", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad",
          targetId: "scene",
          type: "transition",
          tween: progressTween,
          compositor,
          mask: {
            kind: "single",
            texture: "mask-diagonal",
          },
        },
      ]),
    ).toThrow(/cannot be combined/);
  });
});
