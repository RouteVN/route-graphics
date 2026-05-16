const SHADER_KEY_PATTERN = /^[a-z][A-Za-z0-9]*$/;

const FILTER_TEXTURE_LIMIT = 7;
const COMPOSITOR_TEXTURE_LIMIT = 6;

const SHADER_FILTER_TYPES = new Set(["shader"]);
const BLEND_MODES = new Set(["normal", "add", "multiply", "screen"]);
const TEXTURE_WRAP_MODES = new Set(["clamp", "repeat"]);

const RESERVED_SHADER_SYMBOLS = new Set([
  "uTexture",
  "uPrevTexture",
  "uNextTexture",
  "uProgress",
  "uResolution",
  "uSampler",
  "GlobalFilterUniforms",
  "ShaderUniforms",
  "VSOutput",
  "gfu",
  "shaderUniforms",
  "mainVertex",
  "mainFragment",
  "uInputSize",
  "uInputPixel",
  "uInputClamp",
  "uOutputFrame",
  "uGlobalFrame",
  "uOutputTexture",
]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const assertPlainObject = (value, path) => {
  if (!isPlainObject(value)) {
    throw new Error(`Input Error: ${path} must be an object`);
  }
};

const assertNonEmptyString = (value, path) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Input Error: ${path} must be a non-empty string`);
  }
};

const assertShaderKey = (key, path) => {
  if (!SHADER_KEY_PATTERN.test(key)) {
    throw new Error(
      `Input Error: ${path} must match ${SHADER_KEY_PATTERN.source}`,
    );
  }
};

const toPascalCase = (key) => key.charAt(0).toUpperCase() + key.slice(1);

export const toShaderUniformSymbol = (key) => `u${toPascalCase(key)}`;

export const toShaderTextureSymbol = (key) => `u${toPascalCase(key)}Texture`;

const assertGeneratedSymbolAvailable = ({
  key,
  symbol,
  path,
  symbols,
  kind,
}) => {
  if (RESERVED_SHADER_SYMBOLS.has(symbol)) {
    throw new Error(
      `Input Error: ${path}.${key} generates reserved shader symbol ${symbol}`,
    );
  }

  if (symbols.has(symbol)) {
    throw new Error(
      `Input Error: ${path}.${key} generates duplicate shader symbol ${symbol}`,
    );
  }

  symbols.set(symbol, { key, kind });
};

const normalizeUniformValue = (value, path) => {
  if (isFiniteNumber(value)) {
    return {
      type: "f32",
      value,
    };
  }

  if (
    Array.isArray(value) &&
    (value.length === 2 || value.length === 4) &&
    value.every(isFiniteNumber)
  ) {
    return {
      type: value.length === 2 ? "vec2<f32>" : "vec4<f32>",
      value: [...value],
    };
  }

  throw new Error(
    `Input Error: ${path} must be a number, a length-2 number array, or a length-4 number array`,
  );
};

const normalizeShaderUniforms = (uniforms, path, symbols) => {
  if (uniforms === undefined) {
    return [];
  }

  assertPlainObject(uniforms, path);

  return Object.keys(uniforms)
    .sort()
    .map((key) => {
      assertShaderKey(key, `${path}.${key}`);
      const symbol = toShaderUniformSymbol(key);
      assertGeneratedSymbolAvailable({
        key,
        symbol,
        path,
        symbols,
        kind: "uniform",
      });

      return {
        key,
        symbol,
        ...normalizeUniformValue(uniforms[key], `${path}.${key}`),
      };
    });
};

const normalizeShaderTextures = ({ textures, path, symbols, maxTextures }) => {
  if (textures === undefined) {
    return [];
  }

  assertPlainObject(textures, path);

  const keys = Object.keys(textures).sort();

  if (keys.length > maxTextures) {
    throw new Error(
      `Input Error: ${path} supports at most ${maxTextures} custom textures`,
    );
  }

  return keys.map((key) => {
    assertShaderKey(key, `${path}.${key}`);
    assertNonEmptyString(textures[key], `${path}.${key}`);
    const symbol = toShaderTextureSymbol(key);
    assertGeneratedSymbolAvailable({
      key,
      symbol,
      path,
      symbols,
      kind: "texture",
    });

    return {
      key,
      symbol,
      src: textures[key],
    };
  });
};

const normalizeShaderPipeline = (pipeline, path) => {
  if (pipeline === undefined) {
    return {
      blend: "normal",
      textureWrap: "clamp",
      mipmap: false,
    };
  }

  assertPlainObject(pipeline, path);

  const blend = pipeline.blend ?? "normal";
  if (!BLEND_MODES.has(blend)) {
    throw new Error(
      `Input Error: ${path}.blend must be one of: ${Array.from(BLEND_MODES).join(", ")}`,
    );
  }

  const textureWrap = pipeline.textureWrap ?? "clamp";
  if (!TEXTURE_WRAP_MODES.has(textureWrap)) {
    throw new Error(
      `Input Error: ${path}.textureWrap must be one of: ${Array.from(TEXTURE_WRAP_MODES).join(", ")}`,
    );
  }

  const mipmap = pipeline.mipmap ?? false;
  if (typeof mipmap !== "boolean") {
    throw new Error(`Input Error: ${path}.mipmap must be a boolean`);
  }

  return {
    blend,
    textureWrap,
    mipmap,
  };
};

const normalizeShaderSource = (source, path) => {
  assertPlainObject(source, path);
  assertPlainObject(source.webgl, `${path}.webgl`);
  assertPlainObject(source.webgpu, `${path}.webgpu`);

  if (
    source.webgl.vertex !== undefined &&
    typeof source.webgl.vertex !== "string"
  ) {
    throw new Error(`Input Error: ${path}.webgl.vertex must be a string`);
  }

  assertNonEmptyString(source.webgl.fragment, `${path}.webgl.fragment`);
  assertNonEmptyString(source.webgpu.source, `${path}.webgpu.source`);

  if (
    !source.webgpu.source.includes("mainVertex") ||
    !source.webgpu.source.includes("mainFragment")
  ) {
    throw new Error(
      `Input Error: ${path}.webgpu.source must define mainVertex and mainFragment`,
    );
  }

  return {
    webgl: {
      ...(source.webgl.vertex !== undefined
        ? { vertex: source.webgl.vertex }
        : {}),
      fragment: source.webgl.fragment,
    },
    webgpu: {
      source: source.webgpu.source,
    },
  };
};

const normalizeShaderMesh = (mesh, path) => {
  if (mesh === undefined) {
    return {
      grid: [1, 1],
    };
  }

  assertPlainObject(mesh, path);

  if (
    !Array.isArray(mesh.grid) ||
    mesh.grid.length !== 2 ||
    !mesh.grid.every((value) => Number.isInteger(value) && value >= 1)
  ) {
    throw new Error(
      `Input Error: ${path}.grid must be [columns, rows] with positive integers`,
    );
  }

  return {
    grid: [mesh.grid[0], mesh.grid[1]],
  };
};

const normalizeShaderConfig = ({
  shader,
  path,
  requireId,
  textureLimit,
  allowMesh,
}) => {
  assertPlainObject(shader, path);

  if (!SHADER_FILTER_TYPES.has(shader.type)) {
    throw new Error(`Input Error: ${path}.type must be shader`);
  }

  const normalized = {
    type: "shader",
  };

  if (requireId) {
    assertNonEmptyString(shader.id, `${path}.id`);
    normalized.id = shader.id;
  } else if (shader.id !== undefined) {
    assertNonEmptyString(shader.id, `${path}.id`);
    normalized.id = shader.id;
  }

  const symbols = new Map();
  normalized.uniforms = normalizeShaderUniforms(
    shader.uniforms,
    `${path}.uniforms`,
    symbols,
  );
  normalized.textures = normalizeShaderTextures({
    textures: shader.textures,
    path: `${path}.textures`,
    symbols,
    maxTextures: textureLimit,
  });
  normalized.pipeline = normalizeShaderPipeline(
    shader.pipeline,
    `${path}.pipeline`,
  );
  normalized.source = normalizeShaderSource(shader.source, `${path}.source`);

  if (shader.mesh !== undefined && !allowMesh) {
    throw new Error(`Input Error: ${path}.mesh is only valid for compositors`);
  }

  if (allowMesh) {
    normalized.mesh = normalizeShaderMesh(shader.mesh, `${path}.mesh`);
  }

  return normalized;
};

export const normalizeElementShaderFilters = (filters, path = "filters") => {
  if (filters === undefined) {
    return undefined;
  }

  if (!Array.isArray(filters)) {
    throw new Error(`Input Error: ${path} must be an array`);
  }

  const seenIds = new Set();

  return filters.map((filter, index) => {
    const normalized = normalizeShaderConfig({
      shader: filter,
      path: `${path}[${index}]`,
      requireId: true,
      textureLimit: FILTER_TEXTURE_LIMIT,
      allowMesh: false,
    });

    if (seenIds.has(normalized.id)) {
      throw new Error(
        `Input Error: ${path}[${index}].id must be unique within filters`,
      );
    }

    seenIds.add(normalized.id);
    return normalized;
  });
};

export const normalizeShaderCompositor = (compositor, path = "compositor") =>
  normalizeShaderConfig({
    shader: compositor,
    path,
    requireId: false,
    textureLimit: COMPOSITOR_TEXTURE_LIMIT,
    allowMesh: true,
  });

export const getShaderConfigSignature = (config) =>
  JSON.stringify(config ?? null);
