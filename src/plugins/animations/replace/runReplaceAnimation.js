import {
  Container,
  Filter,
  Matrix,
  Rectangle,
  RenderTexture,
  Sprite,
  Texture,
  UniformGroup,
} from "pixi.js";
import {
  buildTimeline,
  calculateMaxDuration,
  getValueAtTime,
} from "../../../util/animationTimeline.js";
import {
  clearDeferredMountOperations,
  createRenderContext,
  flushDeferredMountOperations,
} from "../../elements/renderContext.js";
const DEFAULT_SUBJECT_VALUES = {
  translateX: 0,
  translateY: 0,
  alpha: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const sampleMaskReveal = ({ progress, maskValue, softness } = {}) => {
  const clampedMaskValue = clamp01(maskValue);
  const lowerEdge = clamp01(clampedMaskValue - softness);
  const upperEdge = clamp01(clampedMaskValue + softness);

  return smoothstep(lowerEdge, upperEdge, clamp01(progress));
};

const getLocalBoundsRectangle = (displayObject) =>
  displayObject.getLocalBounds().rectangle.clone();

const normalizeFrame = (frame) => {
  frame.width = Math.max(1, Math.ceil(frame.width));
  frame.height = Math.max(1, Math.ceil(frame.height));
  return frame;
};

const createSnapshotSubject = (app, displayObject) => {
  const frame = normalizeFrame(getLocalBoundsRectangle(displayObject));
  const texture = app.renderer.generateTexture({
    target: displayObject,
    frame,
  });

  const sprite = new Sprite(texture);
  sprite.x = frame.x;
  sprite.y = frame.y;

  const wrapper = new Container();
  wrapper.x = displayObject.x ?? 0;
  wrapper.y = displayObject.y ?? 0;
  wrapper.scale.set(displayObject.scale?.x ?? 1, displayObject.scale?.y ?? 1);
  wrapper.rotation = displayObject.rotation ?? 0;
  wrapper.alpha = displayObject.alpha ?? 1;
  wrapper.addChild(sprite);

  return {
    wrapper,
    texture,
  };
};

const buildSubjectTimelines = (tween = {}) =>
  Object.entries(tween).map(([property, config]) => ({
    property,
    timeline: buildTimeline([
      {
        value: config.initialValue ?? DEFAULT_SUBJECT_VALUES[property] ?? 0,
      },
      ...config.keyframes,
    ]),
  }));

const createSubjectController = (wrapper, tween, app) => {
  if (!wrapper || !tween) {
    return {
      duration: 0,
      apply: () => {},
    };
  }

  const timelines = buildSubjectTimelines(tween);
  const base = {
    x: wrapper.x,
    y: wrapper.y,
    alpha: wrapper.alpha,
    scaleX: wrapper.scale.x,
    scaleY: wrapper.scale.y,
    rotation: wrapper.rotation,
  };

  return {
    duration: calculateMaxDuration(timelines),
    apply: (time) => {
      wrapper.x = base.x;
      wrapper.y = base.y;
      wrapper.alpha = base.alpha;
      wrapper.scale.x = base.scaleX;
      wrapper.scale.y = base.scaleY;
      wrapper.rotation = base.rotation;

      for (const { property, timeline } of timelines) {
        const value = getValueAtTime(timeline, time);

        switch (property) {
          case "translateX":
            wrapper.x = base.x + value * app.renderer.width;
            break;
          case "translateY":
            wrapper.y = base.y + value * app.renderer.height;
            break;
          case "alpha":
            wrapper.alpha = base.alpha * value;
            break;
          case "scaleX":
            wrapper.scale.x = base.scaleX * value;
            break;
          case "scaleY":
            wrapper.scale.y = base.scaleY * value;
            break;
          case "rotation":
            wrapper.rotation = base.rotation + value;
            break;
        }
      }
    },
  };
};

const createMaskProgressTimeline = (mask) =>
  buildTimeline([
    {
      value: mask?.progress?.initialValue ?? 0,
    },
    ...(mask?.progress?.keyframes ?? []),
  ]);

const REPLACE_MASK_FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vSecondaryCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uSecondaryMatrix;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
    vSecondaryCoord = (uSecondaryMatrix * vec3(vTextureCoord, 1.0)).xy;
}
`;

const REPLACE_MASK_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
in vec2 vSecondaryCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uNextTexture;
uniform sampler2D uMaskTextureA;
uniform sampler2D uMaskTextureB;
uniform float uProgress;
uniform float uSoftness;
uniform float uMaskMix;
uniform float uMaskInvert;
uniform vec4 uMaskChannelWeights;
uniform vec4 uSecondaryClamp;

float sampleMaskValue(vec2 secondaryUv)
{
    vec2 clampedUv = clamp(secondaryUv, uSecondaryClamp.xy, uSecondaryClamp.zw);
    vec4 rawMaskA = texture(uMaskTextureA, clampedUv);
    vec4 rawMaskB = texture(uMaskTextureB, clampedUv);
    float maskA = dot(rawMaskA, uMaskChannelWeights);
    float maskB = dot(rawMaskB, uMaskChannelWeights);
    float maskValue = mix(maskA, maskB, clamp(uMaskMix, 0.0, 1.0));

    return mix(maskValue, 1.0 - maskValue, clamp(uMaskInvert, 0.0, 1.0));
}

float sampleReveal(float maskValue)
{
    float progress = clamp(uProgress, 0.0, 1.0);
    float lowerEdge = clamp(maskValue - uSoftness, 0.0, 1.0);
    float upperEdge = clamp(maskValue + uSoftness, 0.0, 1.0);

    if (lowerEdge == upperEdge) {
        return progress < lowerEdge ? 0.0 : 1.0;
    }

    float t = clamp((progress - lowerEdge) / (upperEdge - lowerEdge), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

void main()
{
    vec2 uv = clamp(vTextureCoord, vec2(0.0), vec2(1.0));
    vec2 secondaryUv = clamp(vSecondaryCoord, uSecondaryClamp.xy, uSecondaryClamp.zw);
    vec4 prevColor = texture(uTexture, uv);
    vec4 nextColor = texture(uNextTexture, secondaryUv);
    float reveal = sampleReveal(sampleMaskValue(secondaryUv));

    finalColor = mix(prevColor, nextColor, reveal);
}
`;

const REPLACE_MASK_FILTER_WGSL = `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct ReplaceMaskUniforms {
  uProgress: f32,
  uSoftness: f32,
  uMaskMix: f32,
  uMaskInvert: f32,
  uMaskChannelWeights: vec4<f32>,
  uSecondaryMatrix: mat3x3<f32>,
  uSecondaryClamp: vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> replaceMaskUniforms: ReplaceMaskUniforms;
@group(1) @binding(1) var uNextTexture: texture_2d<f32>;
@group(1) @binding(2) var uMaskTextureA: texture_2d<f32>;
@group(1) @binding(3) var uMaskTextureB: texture_2d<f32>;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) secondaryUv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>
{
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

  return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>
{
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

fn sampleMaskValue(uv: vec2<f32>) -> f32
{
  let rawMaskA = textureSample(uMaskTextureA, uSampler, uv);
  let rawMaskB = textureSample(uMaskTextureB, uSampler, uv);
  let maskA = dot(rawMaskA, replaceMaskUniforms.uMaskChannelWeights);
  let maskB = dot(rawMaskB, replaceMaskUniforms.uMaskChannelWeights);
  let maskValue = mix(maskA, maskB, clamp(replaceMaskUniforms.uMaskMix, 0.0, 1.0));

  return mix(maskValue, 1.0 - maskValue, clamp(replaceMaskUniforms.uMaskInvert, 0.0, 1.0));
}

fn sampleReveal(maskValue: f32) -> f32
{
  let progress = clamp(replaceMaskUniforms.uProgress, 0.0, 1.0);
  let lowerEdge = clamp(maskValue - replaceMaskUniforms.uSoftness, 0.0, 1.0);
  let upperEdge = clamp(maskValue + replaceMaskUniforms.uSoftness, 0.0, 1.0);

  if (lowerEdge == upperEdge) {
    if (progress < lowerEdge) {
      return 0.0;
    }

    return 1.0;
  }

  let t = clamp((progress - lowerEdge) / (upperEdge - lowerEdge), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput
{
  return VSOutput(
    filterVertexPosition(aPosition),
    filterTextureCoord(aPosition),
    (replaceMaskUniforms.uSecondaryMatrix * vec3(filterTextureCoord(aPosition), 1.0)).xy,
  );
}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
  @location(1) secondaryUv: vec2<f32>,
) -> @location(0) vec4<f32>
{
  let clampedUv = clamp(uv, vec2(0.0), vec2(1.0));
  let clampedSecondaryUv = clamp(
    secondaryUv,
    replaceMaskUniforms.uSecondaryClamp.xy,
    replaceMaskUniforms.uSecondaryClamp.zw,
  );
  let prevColor = textureSample(uTexture, uSampler, clampedUv);
  let nextColor = textureSample(uNextTexture, uSampler, clampedSecondaryUv);
  let reveal = sampleReveal(sampleMaskValue(clampedSecondaryUv));

  return mix(prevColor, nextColor, reveal);
}
`;

const MASK_CHANNEL_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uMaskInvert;
uniform vec4 uMaskChannelWeights;

void main()
{
    vec4 rawMask = texture(uTexture, clamp(vTextureCoord, vec2(0.0), vec2(1.0)));
    float maskValue = dot(rawMask, uMaskChannelWeights);
    float outputValue = mix(maskValue, 1.0 - maskValue, clamp(uMaskInvert, 0.0, 1.0));

    finalColor = vec4(outputValue, outputValue, outputValue, 1.0);
}
`;

const MASK_CHANNEL_FILTER_WGSL = `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct MaskChannelUniforms {
  uMaskInvert: f32,
  uMaskChannelWeights: vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> maskChannelUniforms: MaskChannelUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>
{
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

  return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>
{
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput
{
  return VSOutput(
    filterVertexPosition(aPosition),
    filterTextureCoord(aPosition),
  );
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32>
{
  let rawMask = textureSample(uTexture, uSampler, clamp(uv, vec2(0.0), vec2(1.0)));
  let maskValue = dot(rawMask, maskChannelUniforms.uMaskChannelWeights);
  let outputValue = mix(
    maskValue,
    1.0 - maskValue,
    clamp(maskChannelUniforms.uMaskInvert, 0.0, 1.0),
  );

  return vec4(outputValue, outputValue, outputValue, 1.0);
}
`;

const createCanvasContext = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Replace mask composition could not create a 2D canvas.");
  }

  return {
    canvas,
    context,
  };
};

const readChannelValue = (pixelData, offset, channel = "red") => {
  switch (channel) {
    case "green":
      return pixelData[offset + 1];
    case "blue":
      return pixelData[offset + 2];
    case "alpha":
      return pixelData[offset + 3];
    default:
      return pixelData[offset];
  }
};

const extractMaskPixelsFromTexture = ({
  app,
  texture,
  width,
  height,
  channel = "red",
  invert = false,
}) => {
  const values = new Uint8ClampedArray(width * height);
  const maskSprite = new Sprite(Texture.from(texture));
  maskSprite.width = width;
  maskSprite.height = height;

  const maskContainer = new Container();
  maskContainer.addChild(maskSprite);

  const maskRenderTexture = RenderTexture.create({
    width,
    height,
  });

  app.renderer.render({
    container: maskContainer,
    target: maskRenderTexture,
    clear: true,
  });

  const imageData = app.renderer.extract.pixels(maskRenderTexture).pixels;

  for (let index = 0, offset = 0; index < values.length; index++, offset += 4) {
    let value = readChannelValue(imageData, offset, channel);

    if (invert) {
      value = 255 - value;
    }

    values[index] = value;
  }

  maskContainer.destroy({ children: true });
  maskRenderTexture.destroy(true);

  return values;
};

const buildCompositeMaskPixels = (app, mask, width, height) => {
  let combined = null;

  for (const item of mask.items) {
    const current = extractMaskPixelsFromTexture({
      app,
      texture: item.texture,
      width,
      height,
      channel: item.channel ?? "red",
      invert: item.invert ?? false,
    });

    if (!combined) {
      combined = current;
      continue;
    }

    for (let index = 0; index < combined.length; index++) {
      switch (mask.combine ?? "max") {
        case "min":
          combined[index] = Math.min(combined[index], current[index]);
          break;
        case "multiply":
          combined[index] = Math.round(
            (combined[index] / 255) * (current[index] / 255) * 255,
          );
          break;
        case "add":
          combined[index] = Math.min(255, combined[index] + current[index]);
          break;
        default:
          combined[index] = Math.max(combined[index], current[index]);
          break;
      }
    }
  }

  return combined ?? new Uint8ClampedArray(width * height);
};

const createMaskChannelWeights = (channel = "red") => {
  switch (channel) {
    case "green":
      return new Float32Array([0, 1, 0, 0]);
    case "blue":
      return new Float32Array([0, 0, 1, 0]);
    case "alpha":
      return new Float32Array([0, 0, 0, 1]);
    default:
      return new Float32Array([1, 0, 0, 0]);
  }
};

const OUTPUT_MASK_CHANNEL_WEIGHTS = createMaskChannelWeights("red");
// These render textures are sampled as raw TextureSources in the custom
// replace shader, so they must stay at logical resolution rather than the
// renderer/device resolution.
const createShaderRenderTexture = (width, height) =>
  RenderTexture.create({
    width,
    height,
    resolution: 1,
  });

const createMaskChannelFilter = (channelWeights, invert) => {
  const maskChannelUniforms = new UniformGroup({
    uMaskInvert: {
      value: invert ? 1 : 0,
      type: "f32",
    },
    uMaskChannelWeights: {
      value: channelWeights,
      type: "vec4<f32>",
    },
  });

  const filter = Filter.from({
    gpu: {
      vertex: {
        source: MASK_CHANNEL_FILTER_WGSL,
        entryPoint: "mainVertex",
      },
      fragment: {
        source: MASK_CHANNEL_FILTER_WGSL,
        entryPoint: "mainFragment",
      },
    },
    gl: {
      vertex: REPLACE_MASK_FILTER_VERTEX,
      fragment: MASK_CHANNEL_FILTER_FRAGMENT,
      name: "replace-mask-channel-filter",
    },
    resources: {
      maskChannelUniforms,
    },
  });

  return {
    filter,
    maskChannelUniforms,
  };
};

const renderMaskTextureToRenderTexture = ({
  app,
  texture,
  width,
  height,
  channelWeights,
  invert = false,
}) => {
  const sourceTexture = Texture.from(texture);
  const maskSprite = new Sprite(sourceTexture);
  maskSprite.width = width;
  maskSprite.height = height;
  maskSprite.filterArea = new Rectangle(0, 0, width, height);

  const maskContainer = new Container();
  maskContainer.addChild(maskSprite);

  const maskRenderTexture = createShaderRenderTexture(width, height);
  const { filter: maskChannelFilter } = createMaskChannelFilter(
    channelWeights,
    invert,
  );

  maskSprite.filters = [maskChannelFilter];
  app.renderer.render({
    container: maskContainer,
    target: maskRenderTexture,
    clear: true,
  });

  maskSprite.filters = [];
  maskContainer.destroy({ children: true });
  maskChannelFilter.destroy();

  return maskRenderTexture;
};

const createMaskTextureFromPixels = (width, height, pixels) => {
  const { canvas, context } = createCanvasContext(width, height);
  const imageData = context.createImageData(width, height);
  const output = imageData.data;

  for (let index = 0, offset = 0; index < pixels.length; index++, offset += 4) {
    const value = pixels[index];
    output[offset] = value;
    output[offset + 1] = value;
    output[offset + 2] = value;
    output[offset + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return Texture.from(canvas);
};

const createMaskTextures = (app, mask, width, height) => {
  if (!mask) {
    return {
      textures: [Texture.WHITE.source],
      channelWeights: createMaskChannelWeights("red"),
      invert: 0,
      destroy: () => {},
    };
  }

  if (mask.kind === "single") {
    const renderTexture = renderMaskTextureToRenderTexture({
      app,
      texture: mask.texture,
      width,
      height,
      channelWeights: createMaskChannelWeights(mask.channel ?? "red"),
      invert: mask.invert ?? false,
    });

    return {
      textures: [renderTexture.source],
      channelWeights: OUTPUT_MASK_CHANNEL_WEIGHTS,
      invert: 0,
      destroy: () => {
        renderTexture.destroy(true);
      },
    };
  }

  if (mask.kind === "sequence") {
    const textures = mask.textures.map((texture) =>
      renderMaskTextureToRenderTexture({
        app,
        texture,
        width,
        height,
        channelWeights: createMaskChannelWeights(mask.channel ?? "red"),
        invert: mask.invert ?? false,
      }),
    );

    return {
      textures: textures.map((texture) => texture.source),
      channelWeights: OUTPUT_MASK_CHANNEL_WEIGHTS,
      invert: 0,
      destroy: () => {
        for (const texture of textures) {
          texture.destroy(true);
        }
      },
    };
  }

  const texture = createMaskTextureFromPixels(
    width,
    height,
    buildCompositeMaskPixels(app, mask, width, height),
  );

  return {
    textures: [texture.source],
    channelWeights: OUTPUT_MASK_CHANNEL_WEIGHTS,
    invert: 0,
    destroy: () => {
      if (!texture.destroyed) {
        texture.destroy(true);
      }
    },
  };
};

const createReplaceMaskFilter = () => {
  const replaceMaskUniforms = new UniformGroup({
    uProgress: {
      value: 0,
      type: "f32",
    },
    uSoftness: {
      value: 0.001,
      type: "f32",
    },
    uMaskMix: {
      value: 0,
      type: "f32",
    },
    uMaskInvert: {
      value: 0,
      type: "f32",
    },
    uMaskChannelWeights: {
      value: new Float32Array([1, 0, 0, 0]),
      type: "vec4<f32>",
    },
    uSecondaryMatrix: {
      value: new Matrix(),
      type: "mat3x3<f32>",
    },
    uSecondaryClamp: {
      value: new Float32Array([0, 0, 1, 1]),
      type: "vec4<f32>",
    },
  });
  const filter = Filter.from({
    gpu: {
      vertex: {
        source: REPLACE_MASK_FILTER_WGSL,
        entryPoint: "mainVertex",
      },
      fragment: {
        source: REPLACE_MASK_FILTER_WGSL,
        entryPoint: "mainFragment",
      },
    },
    gl: {
      vertex: REPLACE_MASK_FILTER_VERTEX,
      fragment: REPLACE_MASK_FILTER_FRAGMENT,
      name: "replace-mask-filter",
    },
    resources: {
      replaceMaskUniforms,
      uNextTexture: Texture.EMPTY.source,
      uMaskTextureA: Texture.EMPTY.source,
      uMaskTextureB: Texture.EMPTY.source,
    },
  });

  return {
    filter,
    replaceMaskUniforms,
  };
};

export const selectSequenceMaskFrameState = ({
  progress = 0,
  frameCount = 0,
  sampleMode = "hold",
} = {}) => {
  if (frameCount <= 1) {
    return {
      fromIndex: 0,
      toIndex: 0,
      mix: 0,
    };
  }

  const scaled = clamp01(progress) * Math.max(0, frameCount - 1);

  if (sampleMode === "linear") {
    const fromIndex = Math.floor(scaled);
    const toIndex = Math.min(frameCount - 1, fromIndex + 1);

    return {
      fromIndex,
      toIndex,
      mix: scaled - fromIndex,
    };
  }

  const fromIndex = Math.min(frameCount - 1, Math.max(0, Math.round(scaled)));

  return {
    fromIndex,
    toIndex: fromIndex,
    mix: 0,
  };
};

const createMaskTextureController = (app, mask, width, height, filter) => {
  const progressTimeline = createMaskProgressTimeline(mask);
  const duration = calculateMaxDuration([{ timeline: progressTimeline }]);
  const softness = Math.max(mask?.softness ?? 0.001, 0.0001);
  const { textures, channelWeights, invert, destroy } = createMaskTextures(
    app,
    mask,
    width,
    height,
  );
  const replaceMaskUniforms = filter.resources.replaceMaskUniforms;
  let lastFromIndex = -1;
  let lastToIndex = -1;

  return {
    duration,
    progressTimeline,
    apply: (progress) => {
      const selection =
        mask?.kind === "sequence"
          ? selectSequenceMaskFrameState({
              progress,
              frameCount: textures.length,
              sampleMode: mask.sample ?? "hold",
            })
          : {
              fromIndex: 0,
              toIndex: 0,
              mix: 0,
            };

      if (selection.fromIndex !== lastFromIndex) {
        filter.resources.uMaskTextureA =
          textures[selection.fromIndex] ?? Texture.EMPTY.source;
        lastFromIndex = selection.fromIndex;
      }

      if (selection.toIndex !== lastToIndex) {
        filter.resources.uMaskTextureB =
          textures[selection.toIndex] ?? Texture.EMPTY.source;
        lastToIndex = selection.toIndex;
      }

      replaceMaskUniforms.uniforms.uProgress = clamp01(progress);
      replaceMaskUniforms.uniforms.uSoftness = softness;
      replaceMaskUniforms.uniforms.uMaskMix = selection.mix;
      replaceMaskUniforms.uniforms.uMaskInvert = invert;
      replaceMaskUniforms.uniforms.uMaskChannelWeights = channelWeights;
      replaceMaskUniforms.update();
    },
    destroy,
  };
};

const createFullFrameClamp = (width, height) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  return new Float32Array([
    0.5 / safeWidth,
    0.5 / safeHeight,
    1 - 0.5 / safeWidth,
    1 - 0.5 / safeHeight,
  ]);
};

const getUnionBounds = (subjects) => {
  const boundsContainer = new Container();

  for (const subject of subjects) {
    if (subject?.wrapper) {
      boundsContainer.addChild(subject.wrapper);
    }
  }

  return normalizeFrame(getLocalBoundsRectangle(boundsContainer));
};

const renderOffscreenContainer = ({ app, container, target, frame }) => {
  app.renderer.render({
    container,
    target,
    clear: true,
    transform: new Matrix(1, 0, 0, 1, -frame.x, -frame.y),
  });
};

const destroySubjectSnapshot = (subject) => {
  if (subject?.wrapper && !subject.wrapper.destroyed) {
    subject.wrapper.destroy({ children: true });
  }

  subject?.texture?.destroy(true);
};

const resolveOverlaySubjects = ({
  prevElement,
  nextElement,
  animation,
  prevSubject,
  nextSubject,
}) => {
  if (!prevSubject || !nextSubject || prevElement?.id !== nextElement?.id) {
    return { prevSubject, nextSubject };
  }

  let overlayPrevSubject = prevSubject;
  let overlayNextSubject = nextSubject;

  if (
    animation.mask !== undefined &&
    animation.prev === undefined &&
    animation.next === undefined
  ) {
    return {
      prevSubject: overlayPrevSubject,
      nextSubject: overlayNextSubject,
    };
  } else {
    if (animation.prev === undefined) {
      overlayPrevSubject = null;
    }

    if (animation.next === undefined) {
      overlayNextSubject = null;
    }
  }

  return {
    prevSubject: overlayPrevSubject,
    nextSubject: overlayNextSubject,
  };
};

const createPlainOverlay = ({
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
}) => {
  const overlay = new Container();
  overlay.zIndex = zIndex;

  if (prevSubject?.wrapper) {
    overlay.addChild(prevSubject.wrapper);
  }

  if (nextSubject?.wrapper) {
    overlay.addChild(nextSubject.wrapper);
  }

  const prevController = createSubjectController(
    prevSubject?.wrapper ?? null,
    animation.prev?.tween,
    app,
  );
  const nextController = createSubjectController(
    nextSubject?.wrapper ?? null,
    animation.next?.tween,
    app,
  );

  return {
    overlay,
    duration: Math.max(prevController.duration, nextController.duration),
    apply: (time) => {
      prevController.apply(time);
      nextController.apply(time);
    },
    destroy: () => {
      overlay.removeFromParent();
      overlay.destroy({ children: true });
      destroySubjectSnapshot(prevSubject);
      destroySubjectSnapshot(nextSubject);
    },
  };
};

const createMaskedOverlay = ({
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
}) => {
  const unionBounds = getUnionBounds([prevSubject, nextSubject]);
  const prevRoot = new Container();
  const nextRoot = new Container();

  if (prevSubject?.wrapper) {
    prevRoot.addChild(prevSubject.wrapper);
  }

  if (nextSubject?.wrapper) {
    nextRoot.addChild(nextSubject.wrapper);
  }

  const prevTexture = createShaderRenderTexture(
    unionBounds.width,
    unionBounds.height,
  );
  const nextTexture = createShaderRenderTexture(
    unionBounds.width,
    unionBounds.height,
  );

  const overlay = new Container();
  overlay.zIndex = zIndex;

  const sprite = new Sprite(prevTexture);
  sprite.x = unionBounds.x;
  sprite.y = unionBounds.y;
  sprite.filterArea = new Rectangle(
    0,
    0,
    unionBounds.width,
    unionBounds.height,
  );
  overlay.addChild(sprite);

  const { filter: maskFilter } = createReplaceMaskFilter();
  maskFilter.resources.uNextTexture = nextTexture.source;
  sprite.filters = [maskFilter];
  const secondaryClamp = createFullFrameClamp(
    unionBounds.width,
    unionBounds.height,
  );
  const baseApplyMaskFilter =
    typeof maskFilter.apply === "function"
      ? maskFilter.apply.bind(maskFilter)
      : (filterManager, input, output, clearMode) => {
          filterManager.applyFilter(maskFilter, input, output, clearMode);
        };
  maskFilter.apply = (filterManager, input, output, clearMode) => {
    const replaceMaskUniforms = maskFilter.resources.replaceMaskUniforms;
    filterManager.calculateSpriteMatrix(
      replaceMaskUniforms.uniforms.uSecondaryMatrix,
      sprite,
    );
    replaceMaskUniforms.uniforms.uSecondaryClamp = secondaryClamp;
    replaceMaskUniforms.update();
    baseApplyMaskFilter(filterManager, input, output, clearMode);
  };

  const maskTextureController = createMaskTextureController(
    app,
    animation.mask,
    unionBounds.width,
    unionBounds.height,
    maskFilter,
  );
  const prevController = createSubjectController(
    prevSubject?.wrapper ?? null,
    animation.prev?.tween,
    app,
  );
  const nextController = createSubjectController(
    nextSubject?.wrapper ?? null,
    animation.next?.tween,
    app,
  );
  let prevStaticRendered = false;
  let nextStaticRendered = false;

  if (!prevSubject?.wrapper) {
    renderOffscreenContainer({
      app,
      container: prevRoot,
      target: prevTexture,
      frame: unionBounds,
    });
  }

  if (!nextSubject?.wrapper) {
    renderOffscreenContainer({
      app,
      container: nextRoot,
      target: nextTexture,
      frame: unionBounds,
    });
  }

  return {
    overlay,
    duration: Math.max(
      prevController.duration,
      nextController.duration,
      maskTextureController.duration,
    ),
    apply: (time) => {
      prevController.apply(time);
      nextController.apply(time);

      if (
        prevSubject?.wrapper &&
        (prevController.duration > 0 || !prevStaticRendered)
      ) {
        renderOffscreenContainer({
          app,
          container: prevRoot,
          target: prevTexture,
          frame: unionBounds,
        });
        prevStaticRendered = true;
      }

      if (
        nextSubject?.wrapper &&
        (nextController.duration > 0 || !nextStaticRendered)
      ) {
        renderOffscreenContainer({
          app,
          container: nextRoot,
          target: nextTexture,
          frame: unionBounds,
        });
        nextStaticRendered = true;
      }

      const progress = clamp01(
        getValueAtTime(maskTextureController.progressTimeline, time),
      );
      maskTextureController.apply(progress);
    },
    destroy: () => {
      overlay.removeFromParent();
      sprite.filters = [];
      maskFilter.destroy();
      overlay.destroy({ children: true });
      prevRoot.destroy({ children: true });
      nextRoot.destroy({ children: true });
      prevTexture.destroy(true);
      nextTexture.destroy(true);
      destroySubjectSnapshot(prevSubject);
      destroySubjectSnapshot(nextSubject);
      maskTextureController.destroy();
    },
  };
};

const createReplaceOverlay = ({
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
}) => {
  if (animation.mask) {
    return createMaskedOverlay({
      app,
      animation,
      prevSubject,
      nextSubject,
      zIndex,
    });
  }

  return createPlainOverlay({
    app,
    animation,
    prevSubject,
    nextSubject,
    zIndex,
  });
};

const instantiateNextLiveElement = ({
  app,
  parent,
  nextElement,
  plugin,
  animations,
  eventHandler,
  animationBus,
  completionTracker,
  elementPlugins,
  renderContext,
  zIndex,
  signal,
}) => {
  if (!nextElement) {
    return null;
  }

  const result = plugin.add({
    app,
    parent,
    element: nextElement,
    animations,
    eventHandler,
    animationBus,
    completionTracker,
    elementPlugins,
    renderContext,
    zIndex,
    signal,
  });

  if (result && typeof result.then === "function") {
    return result.then(() => {
      if (signal?.aborted || parent.destroyed) {
        return null;
      }

      return (
        parent.children.find((child) => child.label === nextElement.id) ?? null
      );
    });
  }

  if (signal?.aborted || parent.destroyed) {
    return null;
  }

  return (
    parent.children.find((child) => child.label === nextElement.id) ?? null
  );
};

const resolveNextDisplayObject = async (nextDisplayObjectOrPromise) => {
  if (
    nextDisplayObjectOrPromise &&
    typeof nextDisplayObjectOrPromise.then === "function"
  ) {
    return nextDisplayObjectOrPromise;
  }

  return nextDisplayObjectOrPromise ?? null;
};

export const runReplaceAnimation = ({
  app,
  parent,
  prevElement,
  nextElement,
  animation,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  elementPlugins,
  renderContext,
  plugin,
  zIndex,
  signal,
}) => {
  if (!prevElement && !nextElement) {
    throw new Error(
      `Replace animation "${animation.id}" must receive prevElement and/or nextElement.`,
    );
  }

  if (signal?.aborted || parent.destroyed) {
    return;
  }

  const prevDisplayObject = prevElement
    ? (parent.children.find((child) => child.label === prevElement.id) ?? null)
    : null;

  if (prevElement && !prevDisplayObject) {
    throw new Error(
      `Transition animation "${animation.id}" could not find the previous element "${prevElement.id}".`,
    );
  }

  const prevSubject = prevDisplayObject
    ? createSnapshotSubject(app, prevDisplayObject)
    : null;

  const transitionMountParent = new Container();
  const hiddenMountContext = createRenderContext({
    suppressAnimations: true,
  });
  const stateVersion = completionTracker.getVersion();
  let completionTracked = false;

  const trackTransition = () => {
    if (completionTracked) {
      return;
    }

    completionTracker.track(stateVersion);
    completionTracked = true;
  };

  const completeTransition = () => {
    if (!completionTracked) {
      return;
    }

    completionTracker.complete(stateVersion);
    completionTracked = false;
  };

  const finalize = ({ flushDeferredEffects }) => {
    if (finalized) return;
    finalized = true;

    if (nextDisplayObjectRef.value && !nextDisplayObjectRef.value.destroyed) {
      nextDisplayObjectRef.value.visible = true;
    }

    replaceOverlayRef.value?.destroy();

    if (flushDeferredEffects) {
      flushDeferredMountOperations(hiddenMountContext);
      return;
    }

    clearDeferredMountOperations(hiddenMountContext);
  };
  const nextDisplayObjectRef = { value: null };
  const replaceOverlayRef = { value: null };
  let finalized = false;

  trackTransition();

  const continueWithNextDisplayObject = (nextDisplayObject) => {
    if (signal?.aborted || parent.destroyed) {
      clearDeferredMountOperations(hiddenMountContext);
      transitionMountParent.destroy({ children: true });
      destroySubjectSnapshot(prevSubject);
      completeTransition();
      return;
    }

    if (nextElement && !nextDisplayObject) {
      clearDeferredMountOperations(hiddenMountContext);
      completeTransition();
      throw new Error(
        `Transition animation "${animation.id}" could not create the next element "${nextElement.id}".`,
      );
    }

    nextDisplayObjectRef.value = nextDisplayObject;
    const nextSubject = nextDisplayObject
      ? createSnapshotSubject(app, nextDisplayObject)
      : null;

    const overlaySubjects = resolveOverlaySubjects({
      prevElement,
      nextElement,
      animation,
      prevSubject,
      nextSubject,
    });

    if (overlaySubjects.prevSubject !== prevSubject) {
      destroySubjectSnapshot(prevSubject);
    }

    if (overlaySubjects.nextSubject !== nextSubject) {
      destroySubjectSnapshot(nextSubject);
    }

    transitionMountParent.destroy({ children: false });

    if (prevDisplayObject) {
      plugin.delete({
        app,
        parent,
        element: prevElement,
        animations: [],
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        signal,
      });
    }

    if (nextDisplayObject) {
      nextDisplayObject.zIndex = zIndex;
      parent.addChild(nextDisplayObject);
      nextDisplayObject.visible = false;
    }

    const replaceOverlay = createReplaceOverlay({
      app,
      animation,
      prevSubject: overlaySubjects.prevSubject,
      nextSubject: overlaySubjects.nextSubject,
      zIndex,
    });
    replaceOverlayRef.value = replaceOverlay;

    parent.addChild(replaceOverlay.overlay);
    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        driver: "custom",
        duration: replaceOverlay.duration,
        applyFrame: replaceOverlay.apply,
        applyTargetState: () => {
          finalize({ flushDeferredEffects: false });
        },
        onComplete: () => {
          try {
            finalize({ flushDeferredEffects: true });
          } finally {
            completeTransition();
          }
        },
        onCancel: () => {
          completeTransition();
        },
        isValid: () =>
          Boolean(replaceOverlay.overlay) &&
          !replaceOverlay.overlay.destroyed &&
          (!nextDisplayObject || !nextDisplayObject.destroyed),
      },
    });
  };

  const nextDisplayObjectOrPromise = nextElement
    ? instantiateNextLiveElement({
        app,
        parent: transitionMountParent,
        nextElement,
        plugin,
        animations,
        eventHandler,
        animationBus,
        completionTracker,
        elementPlugins,
        renderContext: hiddenMountContext,
        zIndex,
        signal,
      })
    : null;

  if (
    nextDisplayObjectOrPromise &&
    typeof nextDisplayObjectOrPromise.then === "function"
  ) {
    void resolveNextDisplayObject(nextDisplayObjectOrPromise).then(
      continueWithNextDisplayObject,
    );
    return;
  }

  continueWithNextDisplayObject(nextDisplayObjectOrPromise ?? null);
};

export default runReplaceAnimation;
