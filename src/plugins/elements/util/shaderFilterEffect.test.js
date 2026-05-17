import { afterEach, describe, expect, it, vi } from "vitest";
import { Cache, Texture } from "pixi.js";
import {
  createShaderFilter,
  installShaderProgressProperty,
  resetShaderFilterProgress,
  shouldUpdateUnchangedShaderFilterProgress,
} from "./shaderFilterEffect.js";

const TEST_TEXTURE_ALIAS = "shader-filter-effect-test-texture";

const shaderSource = {
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

const createTestShader = (overrides = {}) => ({
  source: shaderSource,
  uniforms: [],
  textures: [],
  pipeline: {
    blend: "normal",
    textureWrap: "clamp",
    mipmap: false,
  },
  mesh: {
    grid: [1, 1],
  },
  ...overrides,
});

afterEach(() => {
  if (Cache.has(TEST_TEXTURE_ALIAS)) {
    Cache.remove(TEST_TEXTURE_ALIAS);
  }
});

describe("shader filter progress state", () => {
  it("resets an installed shader progress property to the base value", () => {
    const displayObject = {};

    installShaderProgressProperty(displayObject);
    displayObject.uProgress = 1;
    resetShaderFilterProgress(displayObject);

    expect(displayObject.uProgress).toBe(0);
  });

  it("requests an unchanged update when a shader filter has stale progress", () => {
    const displayObject = { label: "shader-target" };
    const parent = { children: [displayObject] };

    installShaderProgressProperty(displayObject);
    displayObject.uProgress = 1;

    expect(
      shouldUpdateUnchangedShaderFilterProgress({
        parent,
        nextElement: {
          id: "shader-target",
          filters: [{ id: "grade", type: "shader" }],
        },
        animations: [],
      }),
    ).toBe(true);
  });

  it("does not request an unchanged update while uProgress is actively animated", () => {
    const displayObject = { label: "shader-target" };
    const parent = { children: [displayObject] };

    installShaderProgressProperty(displayObject);
    displayObject.uProgress = 1;

    expect(
      shouldUpdateUnchangedShaderFilterProgress({
        parent,
        nextElement: {
          id: "shader-target",
          filters: [{ id: "grade", type: "shader" }],
        },
        animations: [
          {
            id: "progress",
            targetId: "shader-target",
            type: "update",
            tween: { uProgress: { initialValue: 0, keyframes: [] } },
          },
        ],
      }),
    ).toBe(false);
  });

  it("finds stale shader progress in unchanged descendants", () => {
    const childDisplayObject = { label: "child-shader" };
    const containerDisplayObject = {
      label: "container",
      children: [childDisplayObject],
    };
    const parent = { children: [containerDisplayObject] };

    installShaderProgressProperty(childDisplayObject);
    childDisplayObject.uProgress = 0.5;

    expect(
      shouldUpdateUnchangedShaderFilterProgress({
        parent,
        nextElement: {
          id: "container",
          children: [
            {
              id: "child-shader",
              filters: [{ id: "grade", type: "shader" }],
            },
          ],
        },
        animations: [],
      }),
    ).toBe(true);
  });
});

describe("shader filter resources", () => {
  it("does not mutate cached texture sources when applying pipeline options", () => {
    Cache.set(TEST_TEXTURE_ALIAS, Texture.WHITE);
    const cachedSource = Texture.WHITE.source;
    const originalAddressMode = cachedSource.addressMode;
    const originalAutoGenerateMipmaps = cachedSource.autoGenerateMipmaps;
    const originalMipmapFilter = cachedSource.mipmapFilter;

    const repeatFilter = createShaderFilter({
      shader: createTestShader({
        textures: [{ symbol: "uNoiseTexture", src: TEST_TEXTURE_ALIAS }],
        pipeline: {
          blend: "normal",
          textureWrap: "repeat",
          mipmap: true,
        },
      }),
      width: 32,
      height: 32,
    });
    const clampFilter = createShaderFilter({
      shader: createTestShader({
        textures: [{ symbol: "uNoiseTexture", src: TEST_TEXTURE_ALIAS }],
        pipeline: {
          blend: "normal",
          textureWrap: "clamp",
          mipmap: false,
        },
      }),
      width: 32,
      height: 32,
    });

    const repeatSource = repeatFilter.resources.uNoiseTexture;
    const clampSource = clampFilter.resources.uNoiseTexture;

    expect(cachedSource.addressMode).toBe(originalAddressMode);
    expect(cachedSource.autoGenerateMipmaps).toBe(originalAutoGenerateMipmaps);
    expect(cachedSource.mipmapFilter).toBe(originalMipmapFilter);
    expect(repeatSource).not.toBe(cachedSource);
    expect(clampSource).not.toBe(cachedSource);
    expect(repeatSource).not.toBe(clampSource);
    expect(repeatSource.addressMode).toBe("repeat");
    expect(repeatSource.autoGenerateMipmaps).toBe(true);
    expect(repeatSource.mipmapFilter).toBe("linear");
    expect(clampSource.addressMode).toBe("clamp-to-edge");
    expect(clampSource.autoGenerateMipmaps).toBe(false);
    expect(clampSource.mipmapFilter).toBe("nearest");

    repeatFilter.destroy();
    clampFilter.destroy();

    expect(repeatSource.destroyed).toBe(true);
    expect(clampSource.destroyed).toBe(true);
    expect(cachedSource.destroyed).toBe(false);
  });

  it("uses the loop index when locating the previous non-skipped mesh filter stack entry", () => {
    const filter = createShaderFilter({
      shader: createTestShader({
        mesh: {
          grid: [2, 1],
        },
      }),
      width: 100,
      height: 50,
    });
    const output = {};
    const outputFrame = new Float32Array(4);
    const filterUniforms = {
      uniforms: {
        uOutputFrame: outputFrame,
        uInputSize: new Float32Array(4),
        uInputPixel: new Float32Array(4),
        uInputClamp: new Float32Array(4),
        uGlobalFrame: new Float32Array(4),
        uOutputTexture: new Float32Array(4),
      },
      update: vi.fn(),
    };
    const filterManager = {
      _filterStackIndex: 3,
      _filterStack: [
        null,
        {
          skip: false,
          bounds: { minX: 20, minY: 30 },
          inputTexture: { source: { _resolution: 2 } },
        },
        {
          skip: true,
          bounds: { minX: 999, minY: 999 },
          inputTexture: { source: { _resolution: 3 } },
        },
        {
          skip: false,
          bounds: { minX: 50, minY: 80 },
          previousRenderSurface: output,
        },
      ],
      _filterGlobalUniforms: filterUniforms,
      _globalFilterBindGroup: {
        setResource: vi.fn(),
      },
      renderer: {
        renderTarget: {
          rootRenderTarget: {
            colorTexture: {
              source: { _resolution: 1, width: 800, height: 600 },
            },
          },
          getRenderTarget: () => ({ width: 100, height: 50, isRoot: false }),
          bind: vi.fn(),
        },
        renderPipes: {},
        encoder: {
          draw: vi.fn(),
        },
      },
    };
    const input = {
      frame: { width: 100, height: 50 },
      source: {
        width: 100,
        height: 50,
        pixelWidth: 100,
        pixelHeight: 50,
        style: {},
      },
    };

    filter.apply(filterManager, input, output, false);

    expect(outputFrame[0]).toBe(30);
    expect(outputFrame[1]).toBe(50);

    filter.destroy();
  });
});
