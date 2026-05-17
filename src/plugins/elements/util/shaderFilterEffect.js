import {
  Filter,
  Geometry,
  Point,
  RendererType,
  Texture,
  UniformGroup,
} from "pixi.js";
import { setManagedFilter } from "./managedFilters.js";
import { getShaderConfigSignature } from "./shaderConfig.js";

const SHADER_FILTERS_STATE_KEY = "__routeGraphicsShaderFilters";
const SHADER_PROGRESS_KEY = "__routeGraphicsShaderProgress";

export const DEFAULT_SHADER_FILTER_VERTEX = `
precision mediump float;

in vec2 aPosition;

out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

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
}
`;

const clampFiniteProgress = (value) => (Number.isFinite(value) ? value : 0);

const getAnimationsForTarget = (animations, targetId) => {
  if (!animations) return [];
  if (animations instanceof Map) {
    return animations.get(targetId) ?? [];
  }
  return animations.filter((animation) => animation?.targetId === targetId);
};

export const hasShaderProgressUpdateAnimation = (animations, targetId) =>
  getAnimationsForTarget(animations, targetId).some(
    (animation) =>
      animation?.type === "update" && animation.tween?.uProgress !== undefined,
  );

const toUniformValue = (uniform) => {
  if (uniform.type === "f32") {
    return uniform.value;
  }

  return new Float32Array(uniform.value);
};

const createShaderUniformGroup = (shader, width, height, progress) => {
  const uniforms = {
    uProgress: {
      value: clampFiniteProgress(progress),
      type: "f32",
    },
    uResolution: {
      value: new Float32Array([Math.max(1, width), Math.max(1, height)]),
      type: "vec2<f32>",
    },
  };

  for (const uniform of shader.uniforms ?? []) {
    uniforms[uniform.symbol] = {
      value: toUniformValue(uniform),
      type: uniform.type,
    };
  }

  return new UniformGroup(uniforms);
};

const applyTexturePipeline = (textureSource, pipeline) => {
  if (!textureSource) {
    return textureSource;
  }

  textureSource.addressMode =
    pipeline?.textureWrap === "repeat" ? "repeat" : "clamp-to-edge";
  textureSource.autoGenerateMipmaps = pipeline?.mipmap === true;
  textureSource.mipmapFilter = pipeline?.mipmap === true ? "linear" : "nearest";

  return textureSource;
};

const createTextureResources = (shader) => {
  const resources = {};

  for (const texture of shader.textures ?? []) {
    resources[texture.symbol] = applyTexturePipeline(
      Texture.from(texture.src).source,
      shader.pipeline,
    );
  }

  return resources;
};

const createShaderFilterGeometry = (grid = [1, 1]) => {
  const columns = Math.max(1, grid[0] ?? 1);
  const rows = Math.max(1, grid[1] ?? 1);

  if (columns === 1 && rows === 1) {
    return null;
  }

  const positions = [];
  const indices = [];

  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      positions.push(column / columns, row / rows);
    }
  }

  const rowStride = columns + 1;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const topLeft = row * rowStride + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + rowStride;
      const bottomRight = bottomLeft + 1;

      indices.push(
        topLeft,
        topRight,
        bottomLeft,
        topRight,
        bottomRight,
        bottomLeft,
      );
    }
  }

  return new Geometry({
    attributes: {
      aPosition: {
        buffer: new Float32Array(positions),
        format: "float32x2",
        stride: 2 * 4,
        offset: 0,
      },
    },
    indexBuffer: new Uint32Array(indices),
  });
};

const applyShaderFilterWithGeometry = ({
  filterManager,
  filter,
  geometry,
  input,
  output,
  clear,
}) => {
  const renderer = filterManager.renderer;
  const filterData =
    filterManager._filterStack[filterManager._filterStackIndex];
  const bounds = filterData.bounds;
  const offset = Point.shared;
  const previousRenderSurface = filterData.previousRenderSurface;
  const isFinalTarget = previousRenderSurface === output;
  let resolution =
    renderer.renderTarget.rootRenderTarget.colorTexture.source._resolution;
  let currentIndex = filterManager._filterStackIndex - 1;

  while (currentIndex > 0 && filterManager._filterStack[currentIndex].skip) {
    currentIndex--;
  }

  if (currentIndex > 0) {
    resolution =
      filterManager._filterStack[currentIndex].inputTexture.source._resolution;
  }

  const filterUniforms = filterManager._filterGlobalUniforms;
  const uniforms = filterUniforms.uniforms;
  const outputFrame = uniforms.uOutputFrame;
  const inputSize = uniforms.uInputSize;
  const inputPixel = uniforms.uInputPixel;
  const inputClamp = uniforms.uInputClamp;
  const globalFrame = uniforms.uGlobalFrame;
  const outputTexture = uniforms.uOutputTexture;

  if (isFinalTarget) {
    let lastIndex = filterManager._filterStackIndex;

    while (lastIndex > 0) {
      lastIndex--;
      const previousFilterData =
        filterManager._filterStack[filterManager._filterStackIndex - 1];
      if (!previousFilterData.skip) {
        offset.x = previousFilterData.bounds.minX;
        offset.y = previousFilterData.bounds.minY;
        break;
      }
    }

    outputFrame[0] = bounds.minX - offset.x;
    outputFrame[1] = bounds.minY - offset.y;
  } else {
    outputFrame[0] = 0;
    outputFrame[1] = 0;
  }

  outputFrame[2] = input.frame.width;
  outputFrame[3] = input.frame.height;
  inputSize[0] = input.source.width;
  inputSize[1] = input.source.height;
  inputSize[2] = 1 / inputSize[0];
  inputSize[3] = 1 / inputSize[1];
  inputPixel[0] = input.source.pixelWidth;
  inputPixel[1] = input.source.pixelHeight;
  inputPixel[2] = 1 / inputPixel[0];
  inputPixel[3] = 1 / inputPixel[1];
  inputClamp[0] = 0.5 * inputPixel[2];
  inputClamp[1] = 0.5 * inputPixel[3];
  inputClamp[2] = input.frame.width * inputSize[2] - 0.5 * inputPixel[2];
  inputClamp[3] = input.frame.height * inputSize[3] - 0.5 * inputPixel[3];

  const rootTexture = renderer.renderTarget.rootRenderTarget.colorTexture;
  globalFrame[0] = offset.x * resolution;
  globalFrame[1] = offset.y * resolution;
  globalFrame[2] = rootTexture.source.width * resolution;
  globalFrame[3] = rootTexture.source.height * resolution;

  const renderTarget = renderer.renderTarget.getRenderTarget(output);
  renderer.renderTarget.bind(output, Boolean(clear));

  if (output instanceof Texture) {
    outputTexture[0] = output.frame.width;
    outputTexture[1] = output.frame.height;
  } else {
    outputTexture[0] = renderTarget.width;
    outputTexture[1] = renderTarget.height;
  }

  outputTexture[2] = renderTarget.isRoot ? -1 : 1;
  filterUniforms.update();

  if (renderer.renderPipes.uniformBatch) {
    const batchUniforms =
      renderer.renderPipes.uniformBatch.getUboResource(filterUniforms);
    filterManager._globalFilterBindGroup.setResource(batchUniforms, 0);
  } else {
    filterManager._globalFilterBindGroup.setResource(filterUniforms, 0);
  }

  filterManager._globalFilterBindGroup.setResource(input.source, 1);
  filterManager._globalFilterBindGroup.setResource(input.source.style, 2);
  filter.groups[0] = filterManager._globalFilterBindGroup;

  renderer.encoder.draw({
    geometry,
    shader: filter,
    state: filter._state,
    topology: "triangle-list",
  });

  if (renderer.type === RendererType.WEBGL) {
    renderer.renderTarget.finishRenderPass();
  }
};

export const setShaderFilterProgress = (filter, progress) => {
  const shaderUniforms = filter?.resources?.shaderUniforms;
  if (!shaderUniforms?.uniforms) {
    return;
  }

  shaderUniforms.uniforms.uProgress = clampFiniteProgress(progress);
  shaderUniforms.update();
};

export const setShaderFilterResolution = (filter, width, height) => {
  const shaderUniforms = filter?.resources?.shaderUniforms;
  if (!shaderUniforms?.uniforms) {
    return;
  }

  shaderUniforms.uniforms.uResolution = new Float32Array([
    Math.max(1, width),
    Math.max(1, height),
  ]);
  shaderUniforms.update();
};

export const createShaderFilter = ({
  shader,
  width,
  height,
  progress = 0,
  nextTextureSource,
  name = "route-graphics-shader-filter",
}) => {
  const shaderUniforms = createShaderUniformGroup(
    shader,
    width,
    height,
    progress,
  );
  const resources = {
    shaderUniforms,
    ...(nextTextureSource ? { uNextTexture: nextTextureSource } : {}),
    ...createTextureResources(shader),
  };

  const filter = Filter.from({
    gpu: {
      vertex: {
        source: shader.source.webgpu.source,
        entryPoint: "mainVertex",
      },
      fragment: {
        source: shader.source.webgpu.source,
        entryPoint: "mainFragment",
      },
    },
    gl: {
      vertex: shader.source.webgl.vertex ?? DEFAULT_SHADER_FILTER_VERTEX,
      fragment: shader.source.webgl.fragment,
      name,
    },
    resources,
    blendMode: shader.pipeline?.blend ?? "normal",
  });

  const geometry = createShaderFilterGeometry(shader.mesh?.grid);
  if (geometry) {
    filter.apply = (filterManager, input, output, clear) => {
      applyShaderFilterWithGeometry({
        filterManager,
        filter,
        geometry,
        input,
        output,
        clear,
      });
    };

    const baseDestroy = filter.destroy.bind(filter);
    filter.destroy = (...args) => {
      geometry.destroy();
      baseDestroy(...args);
    };
  }

  return filter;
};

const getShaderFiltersState = (displayObject) =>
  displayObject?.[SHADER_FILTERS_STATE_KEY] ?? null;

const setShaderFiltersState = (displayObject, state) => {
  Object.defineProperty(displayObject, SHADER_FILTERS_STATE_KEY, {
    value: state,
    enumerable: false,
    configurable: true,
    writable: true,
  });
};

const applyProgressToFilters = (displayObject, progress) => {
  const state = getShaderFiltersState(displayObject);
  for (const filter of state?.filters ?? []) {
    setShaderFilterProgress(filter, progress);
  }
};

export const installShaderProgressProperty = (displayObject) => {
  if (!displayObject) return;

  if (displayObject[SHADER_PROGRESS_KEY] === undefined) {
    Object.defineProperty(displayObject, SHADER_PROGRESS_KEY, {
      value: 0,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    displayObject,
    "uProgress",
  );
  if (descriptor?.get || descriptor?.set) {
    return;
  }

  Object.defineProperty(displayObject, "uProgress", {
    get() {
      return this[SHADER_PROGRESS_KEY] ?? 0;
    },
    set(value) {
      this[SHADER_PROGRESS_KEY] = clampFiniteProgress(value);
      applyProgressToFilters(this, this[SHADER_PROGRESS_KEY]);
    },
    enumerable: false,
    configurable: true,
  });
};

export const resetShaderFilterProgress = (displayObject) => {
  if (!displayObject || displayObject[SHADER_PROGRESS_KEY] === undefined) {
    return;
  }

  displayObject.uProgress = 0;
};

const hasShaderFilters = (element) =>
  element?.filters?.some((filter) => filter?.type === "shader") ?? false;

const findDisplayObjectByLabel = (displayObject, label) => {
  if (!displayObject || !label) {
    return null;
  }

  if (displayObject.label === label) {
    return displayObject;
  }

  for (const child of displayObject.children ?? []) {
    const match = findDisplayObjectByLabel(child, label);
    if (match) {
      return match;
    }
  }

  return null;
};

const hasStaleShaderFilterProgress = ({ parent, element, animations }) => {
  if (!element) {
    return false;
  }

  if (
    hasShaderFilters(element) &&
    !hasShaderProgressUpdateAnimation(animations, element.id)
  ) {
    const displayObject = findDisplayObjectByLabel(parent, element.id);

    if (
      displayObject?.[SHADER_PROGRESS_KEY] !== undefined &&
      displayObject.uProgress !== 0
    ) {
      return true;
    }
  }

  return hasStaleShaderFilterProgressInTree({
    parent,
    elements: element.children,
    animations,
  });
};

export const hasStaleShaderFilterProgressInTree = ({
  parent,
  elements = [],
  animations,
}) =>
  (elements ?? []).some((element) =>
    hasStaleShaderFilterProgress({ parent, element, animations }),
  );

export const shouldUpdateUnchangedShaderFilterProgress = ({
  parent,
  nextElement,
  animations,
}) =>
  hasStaleShaderFilterProgress({
    parent,
    element: nextElement,
    animations,
  });

const clearShaderFilters = (displayObject) => {
  setManagedFilter(displayObject, "shader", null);
  delete displayObject[SHADER_FILTERS_STATE_KEY];
};

export const syncShaderFilters = (
  displayObject,
  filters,
  { width, height, force = false } = {},
) => {
  if (!displayObject) {
    return;
  }

  if (!filters?.length && !force) {
    clearShaderFilters(displayObject);
    return;
  }

  installShaderProgressProperty(displayObject);

  if (!filters?.length) {
    clearShaderFilters(displayObject);
    return;
  }

  const safeWidth = Math.max(1, Math.round(width ?? displayObject.width ?? 1));
  const safeHeight = Math.max(
    1,
    Math.round(height ?? displayObject.height ?? 1),
  );
  const signature = getShaderConfigSignature(filters);
  const previousState = getShaderFiltersState(displayObject);

  if (previousState?.signature === signature) {
    for (const filter of previousState.filters) {
      setShaderFilterResolution(filter, safeWidth, safeHeight);
      setShaderFilterProgress(filter, displayObject.uProgress);
    }
    setManagedFilter(displayObject, "shader", previousState.filters);
    return;
  }

  const nextFilters = filters.map((filterConfig) =>
    createShaderFilter({
      shader: filterConfig,
      width: safeWidth,
      height: safeHeight,
      progress: displayObject.uProgress,
      name: `route-graphics-shader-filter-${filterConfig.id}`,
    }),
  );

  setShaderFiltersState(displayObject, {
    signature,
    filters: nextFilters,
  });
  setManagedFilter(displayObject, "shader", nextFilters);
};

export const getShaderFilterTargetState = (element, { force = false } = {}) => {
  if (!element?.filters?.length && !force) return {};

  return {
    uProgress: 0,
  };
};
