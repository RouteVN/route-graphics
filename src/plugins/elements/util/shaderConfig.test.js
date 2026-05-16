import { describe, expect, it } from "vitest";
import {
  normalizeElementShaderFilters,
  normalizeShaderCompositor,
} from "./shaderConfig.js";

const source = {
  webgl: {
    fragment: `
      in vec2 vTextureCoord;
      out vec4 finalColor;
      uniform sampler2D uTexture;
      void main() { finalColor = texture(uTexture, vTextureCoord); }
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
};

describe("shader config normalization", () => {
  it("normalizes element shader filters with sorted uniforms and textures", () => {
    const filters = normalizeElementShaderFilters([
      {
        id: "crt",
        type: "shader",
        uniforms: {
          intensity: 0.3,
          tint: [1, 0.8, 0.4, 1],
          offset: [2, 4],
        },
        textures: {
          noise: "noise-texture",
        },
        source,
      },
    ]);

    expect(filters[0].uniforms.map((uniform) => uniform.symbol)).toEqual([
      "uIntensity",
      "uOffset",
      "uTint",
    ]);
    expect(filters[0].textures[0]).toMatchObject({
      key: "noise",
      symbol: "uNoiseTexture",
      src: "noise-texture",
    });
    expect(filters[0].pipeline).toEqual({
      blend: "normal",
      textureWrap: "clamp",
      mipmap: false,
    });
  });

  it("rejects generated uniform and texture symbol collisions", () => {
    expect(() =>
      normalizeElementShaderFilters([
        {
          id: "bad",
          type: "shader",
          uniforms: {
            noiseTexture: 1,
          },
          textures: {
            noise: "noise-texture",
          },
          source,
        },
      ]),
    ).toThrow(/duplicate shader symbol uNoiseTexture/);
  });

  it("rejects reserved generated texture symbols", () => {
    expect(() =>
      normalizeShaderCompositor({
        type: "shader",
        textures: {
          next: "next-texture",
        },
        source,
      }),
    ).toThrow(/reserved shader symbol uNextTexture/);
  });

  it("rejects unsupported uniform value shapes", () => {
    expect(() =>
      normalizeElementShaderFilters([
        {
          id: "bad",
          type: "shader",
          uniforms: {
            color: [1, 0, 0],
          },
          source,
        },
      ]),
    ).toThrow(/length-4 number array/);
  });

  it("normalizes compositor mesh defaults and explicit grids", () => {
    expect(
      normalizeShaderCompositor({
        type: "shader",
        source,
      }).mesh,
    ).toEqual({ grid: [1, 1] });

    expect(
      normalizeShaderCompositor({
        type: "shader",
        mesh: {
          grid: [64, 2],
        },
        source,
      }).mesh,
    ).toEqual({ grid: [64, 2] });
  });
});
