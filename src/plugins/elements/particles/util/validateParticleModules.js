/**
 * Validation helpers for structured particle modules.
 */

const EMISSION_MODES = new Set(["continuous", "burst"]);
const SOURCE_KINDS = new Set(["point", "rect", "circle", "line"]);
const TEXTURE_MODES = new Set(["single", "random", "cycle"]);
const TEXTURE_PICKS = new Set(["perParticle", "perWave"]);
const DISTRIBUTION_KINDS = new Set(["uniform", "normal", "bias"]);
const BIAS_TOWARDS = new Set(["min", "max", "center"]);
const ROTATION_MODES = new Set(["none", "fixed", "random", "spin"]);

/**
 * Validate structured particle modules.
 * @param {Object} state
 */
export function validateParticleModules(state) {
  validateStructuredTopLevel(state);

  if (
    !state.modules ||
    typeof state.modules !== "object" ||
    Array.isArray(state.modules)
  ) {
    throw new Error("Input Error: Particles require 'modules'");
  }

  const { emission, movement, appearance, bounds } = state.modules;

  if (!emission || typeof emission !== "object" || Array.isArray(emission)) {
    throw new Error("Input Error: modules.emission must be an object");
  }

  if (
    !appearance ||
    typeof appearance !== "object" ||
    Array.isArray(appearance)
  ) {
    throw new Error("Input Error: modules.appearance must be an object");
  }

  validateEmission(emission);
  validateMovement(movement, appearance);
  validateAppearance(appearance);
  validateBounds(bounds);
}

function validateStructuredTopLevel(state) {
  if (
    state.texture !== undefined ||
    state.behaviors !== undefined ||
    state.emitter !== undefined
  ) {
    throw new Error(
      "Input Error: Structured particles cannot mix 'modules' with legacy texture/behaviors/emitter fields",
    );
  }

  if (state.count !== undefined) {
    throw new Error(
      "Input Error: Structured particles do not support legacy 'count'",
    );
  }

  if (state.alpha !== undefined) {
    assertNumber(state.alpha, "alpha");
    if (state.alpha < 0 || state.alpha > 1) {
      throw new Error("Input Error: alpha must be between 0 and 1");
    }
  }

  if (state.x !== undefined) assertNumber(state.x, "x");
  if (state.y !== undefined) assertNumber(state.y, "y");
  if (state.seed !== undefined) assertNumber(state.seed, "seed");
}

function validateEmission(emission) {
  if (!EMISSION_MODES.has(emission.mode)) {
    throw new Error(
      "Input Error: modules.emission.mode must be 'continuous' or 'burst'",
    );
  }

  if (emission.mode === "continuous") {
    assertNumber(emission.rate, "modules.emission.rate");
    if (emission.rate <= 0) {
      throw new Error("Input Error: modules.emission.rate must be positive");
    }
  } else {
    assertInteger(emission.burstCount, "modules.emission.burstCount");
    if (emission.burstCount <= 0) {
      throw new Error(
        "Input Error: modules.emission.burstCount must be positive",
      );
    }
  }

  if (emission.maxActive !== undefined) {
    assertInteger(emission.maxActive, "modules.emission.maxActive");
    if (emission.maxActive <= 0) {
      throw new Error(
        "Input Error: modules.emission.maxActive must be positive",
      );
    }
  }

  if (emission.duration !== undefined) {
    if (emission.duration !== "infinite") {
      assertNumber(emission.duration, "modules.emission.duration");
      if (emission.duration < 0) {
        throw new Error(
          "Input Error: modules.emission.duration must be non-negative",
        );
      }
    }
  }

  validateRangeLike(
    emission.particleLifetime,
    "modules.emission.particleLifetime",
    { allowNegative: false },
  );

  if (
    !emission.source ||
    typeof emission.source !== "object" ||
    Array.isArray(emission.source)
  ) {
    throw new Error("Input Error: modules.emission.source must be an object");
  }

  if (!SOURCE_KINDS.has(emission.source.kind)) {
    throw new Error(
      "Input Error: modules.emission.source.kind must be one of point, rect, circle, line",
    );
  }

  if (
    !emission.source.data ||
    typeof emission.source.data !== "object" ||
    Array.isArray(emission.source.data)
  ) {
    throw new Error(
      "Input Error: modules.emission.source.data must be an object",
    );
  }

  validateSourceData(emission.source.kind, emission.source.data);
}

function validateSourceData(kind, data) {
  if (kind === "point") {
    assertNumber(data.x, "modules.emission.source.data.x");
    assertNumber(data.y, "modules.emission.source.data.y");
    return;
  }

  if (kind === "rect") {
    assertNumber(data.x, "modules.emission.source.data.x");
    assertNumber(data.y, "modules.emission.source.data.y");
    assertNumber(data.width, "modules.emission.source.data.width");
    assertNumber(data.height, "modules.emission.source.data.height");
    if (data.width <= 0 || data.height <= 0) {
      throw new Error(
        "Input Error: modules.emission.source.data.width and height must be positive",
      );
    }
    return;
  }

  if (kind === "circle") {
    assertNumber(data.x, "modules.emission.source.data.x");
    assertNumber(data.y, "modules.emission.source.data.y");
    assertNumber(data.radius, "modules.emission.source.data.radius");
    if (data.radius <= 0) {
      throw new Error(
        "Input Error: modules.emission.source.data.radius must be positive",
      );
    }

    if (data.innerRadius !== undefined) {
      assertNumber(
        data.innerRadius,
        "modules.emission.source.data.innerRadius",
      );
      if (data.innerRadius < 0 || data.innerRadius > data.radius) {
        throw new Error(
          "Input Error: modules.emission.source.data.innerRadius must be between 0 and radius",
        );
      }
    }

    if (
      data.affectRotation !== undefined &&
      typeof data.affectRotation !== "boolean"
    ) {
      throw new Error(
        "Input Error: modules.emission.source.data.affectRotation must be a boolean",
      );
    }
    return;
  }

  assertNumber(data.x1, "modules.emission.source.data.x1");
  assertNumber(data.y1, "modules.emission.source.data.y1");
  assertNumber(data.x2, "modules.emission.source.data.x2");
  assertNumber(data.y2, "modules.emission.source.data.y2");
}

function validateMovement(movement, appearance) {
  if (movement === undefined) return;

  if (!movement || typeof movement !== "object" || Array.isArray(movement)) {
    throw new Error("Input Error: modules.movement must be an object");
  }

  if (movement.velocity !== undefined) {
    if (
      !movement.velocity ||
      typeof movement.velocity !== "object" ||
      Array.isArray(movement.velocity)
    ) {
      throw new Error(
        "Input Error: modules.movement.velocity must be an object",
      );
    }

    const { velocity } = movement;
    if (velocity.kind !== "directional" && velocity.kind !== "radial") {
      throw new Error(
        "Input Error: modules.movement.velocity.kind must be 'directional' or 'radial'",
      );
    }

    validateRangeLike(velocity.speed, "modules.movement.velocity.speed", {
      allowNegative: false,
    });

    if (velocity.kind === "directional") {
      validateRangeLike(
        velocity.direction,
        "modules.movement.velocity.direction",
        {
          allowNegative: true,
        },
      );
    } else if (velocity.angle !== undefined) {
      validateRangeLike(velocity.angle, "modules.movement.velocity.angle", {
        allowNegative: true,
      });
    }
  }

  if (movement.acceleration !== undefined) {
    if (
      !movement.acceleration ||
      typeof movement.acceleration !== "object" ||
      Array.isArray(movement.acceleration)
    ) {
      throw new Error(
        "Input Error: modules.movement.acceleration must be an object",
      );
    }

    assertNumber(movement.acceleration.x, "modules.movement.acceleration.x");
    assertNumber(movement.acceleration.y, "modules.movement.acceleration.y");
  }

  if (movement.maxSpeed !== undefined) {
    assertNumber(movement.maxSpeed, "modules.movement.maxSpeed");
    if (movement.maxSpeed < 0) {
      throw new Error(
        "Input Error: modules.movement.maxSpeed must be non-negative",
      );
    }
  }

  if (
    movement.faceVelocity !== undefined &&
    typeof movement.faceVelocity !== "boolean"
  ) {
    throw new Error(
      "Input Error: modules.movement.faceVelocity must be a boolean",
    );
  }

  if (!movement.velocity && !movement.acceleration) {
    throw new Error(
      "Input Error: modules.movement must define velocity, acceleration, or both",
    );
  }

  if (
    movement.faceVelocity &&
    appearance?.rotation &&
    appearance.rotation.mode !== "none"
  ) {
    throw new Error(
      "Input Error: modules.appearance.rotation cannot be combined with modules.movement.faceVelocity",
    );
  }
}

function validateAppearance(appearance) {
  validateTextureConfig(appearance.texture);

  if (appearance.scale !== undefined) {
    validateScalarChannel(appearance.scale, "modules.appearance.scale", {
      allowNegative: false,
      modes: ["single", "range", "curve"],
    });
  }

  if (appearance.alpha !== undefined) {
    validateScalarChannel(appearance.alpha, "modules.appearance.alpha", {
      min: 0,
      max: 1,
      modes: ["single", "curve"],
    });
  }

  if (appearance.color !== undefined) {
    validateColorChannel(appearance.color, "modules.appearance.color");
  }

  if (appearance.rotation !== undefined) {
    validateRotation(appearance.rotation);
  }
}

function validateTextureConfig(texture) {
  if (texture === undefined) {
    throw new Error("Input Error: modules.appearance.texture is required");
  }

  if (typeof texture === "string") return;

  if (!texture || typeof texture !== "object" || Array.isArray(texture)) {
    throw new Error(
      "Input Error: modules.appearance.texture must be a string or object",
    );
  }

  if (texture.shape) {
    validateTextureShape(texture, "modules.appearance.texture");
    return;
  }

  if (!TEXTURE_MODES.has(texture.mode)) {
    throw new Error(
      "Input Error: modules.appearance.texture.mode must be 'single', 'random', or 'cycle'",
    );
  }

  if (texture.pick !== undefined && !TEXTURE_PICKS.has(texture.pick)) {
    throw new Error(
      "Input Error: modules.appearance.texture.pick must be 'perParticle' or 'perWave'",
    );
  }

  if (!Array.isArray(texture.items) || texture.items.length === 0) {
    throw new Error(
      "Input Error: modules.appearance.texture.items must be a non-empty array",
    );
  }

  if (texture.mode === "single" && texture.items.length !== 1) {
    throw new Error(
      "Input Error: modules.appearance.texture.mode 'single' requires exactly one item",
    );
  }

  for (let i = 0; i < texture.items.length; i++) {
    const item = texture.items[i];
    validateTextureItem(item, `modules.appearance.texture.items[${i}]`);
  }
}

function validateTextureItem(item, path) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`Input Error: ${path} must be an object`);
  }

  if (item.src !== undefined) {
    if (typeof item.src !== "string" || item.src.length === 0) {
      throw new Error(`Input Error: ${path}.src must be a non-empty string`);
    }
  } else if (item.shape) {
    validateTextureShape(item, path);
  } else {
    throw new Error(
      `Input Error: ${path} must define either 'src' or shape fields`,
    );
  }

  if (item.weight !== undefined) {
    assertNumber(item.weight, `${path}.weight`);
    if (item.weight <= 0) {
      throw new Error(`Input Error: ${path}.weight must be positive`);
    }
  }
}

function validateTextureShape(shapeConfig, path) {
  if (!["circle", "ellipse", "rect"].includes(shapeConfig.shape)) {
    throw new Error(
      `Input Error: ${path}.shape must be 'circle', 'ellipse', or 'rect'`,
    );
  }

  if (shapeConfig.radius !== undefined) {
    assertNumber(shapeConfig.radius, `${path}.radius`);
  }
  if (shapeConfig.width !== undefined) {
    assertNumber(shapeConfig.width, `${path}.width`);
  }
  if (shapeConfig.height !== undefined) {
    assertNumber(shapeConfig.height, `${path}.height`);
  }
  if (
    shapeConfig.color !== undefined &&
    typeof shapeConfig.color !== "string" &&
    typeof shapeConfig.color !== "number"
  ) {
    throw new Error(`Input Error: ${path}.color must be a string or number`);
  }
}

function validateScalarChannel(channel, path, options) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) {
    throw new Error(`Input Error: ${path} must be an object`);
  }

  if (!options.modes.includes(channel.mode)) {
    throw new Error(
      `Input Error: ${path}.mode must be one of ${options.modes.join(", ")}`,
    );
  }

  if (channel.mode === "single") {
    validateScalarValue(channel.value, `${path}.value`, options);
    return;
  }

  if (channel.mode === "range") {
    validateRangeLike(channel, path, options);
    return;
  }

  if (!Array.isArray(channel.keys) || channel.keys.length === 0) {
    throw new Error(`Input Error: ${path}.keys must be a non-empty array`);
  }

  let previousTime = -Infinity;
  for (let i = 0; i < channel.keys.length; i++) {
    const key = channel.keys[i];
    if (!key || typeof key !== "object" || Array.isArray(key)) {
      throw new Error(`Input Error: ${path}.keys[${i}] must be an object`);
    }

    assertNumber(key.time, `${path}.keys[${i}].time`);
    if (key.time < 0 || key.time > 1) {
      throw new Error(
        `Input Error: ${path}.keys[${i}].time must be between 0 and 1`,
      );
    }
    if (key.time < previousTime) {
      throw new Error(`Input Error: ${path}.keys must be sorted by time`);
    }
    previousTime = key.time;

    validateScalarValue(key.value, `${path}.keys[${i}].value`, options);
  }
}

function validateColorChannel(channel, path) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) {
    throw new Error(`Input Error: ${path} must be an object`);
  }

  if (channel.mode === "single") {
    validateColorValue(channel.value, `${path}.value`);
    return;
  }

  if (channel.mode !== "gradient") {
    throw new Error(
      "Input Error: modules.appearance.color.mode must be 'single' or 'gradient'",
    );
  }

  if (!Array.isArray(channel.keys) || channel.keys.length === 0) {
    throw new Error(`Input Error: ${path}.keys must be a non-empty array`);
  }

  let previousTime = -Infinity;
  for (let i = 0; i < channel.keys.length; i++) {
    const key = channel.keys[i];
    if (!key || typeof key !== "object" || Array.isArray(key)) {
      throw new Error(`Input Error: ${path}.keys[${i}] must be an object`);
    }
    assertNumber(key.time, `${path}.keys[${i}].time`);
    if (key.time < 0 || key.time > 1) {
      throw new Error(
        `Input Error: ${path}.keys[${i}].time must be between 0 and 1`,
      );
    }
    if (key.time < previousTime) {
      throw new Error(`Input Error: ${path}.keys must be sorted by time`);
    }
    previousTime = key.time;
    validateColorValue(key.value, `${path}.keys[${i}].value`);
  }
}

function validateColorValue(value, path) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Input Error: ${path} must be a string or number`);
  }
}

function validateRotation(rotation) {
  if (!rotation || typeof rotation !== "object" || Array.isArray(rotation)) {
    throw new Error(
      "Input Error: modules.appearance.rotation must be an object",
    );
  }

  if (!ROTATION_MODES.has(rotation.mode)) {
    throw new Error(
      "Input Error: modules.appearance.rotation.mode must be 'none', 'fixed', 'random', or 'spin'",
    );
  }

  if (rotation.mode === "none") return;
  if (rotation.mode === "fixed") {
    assertNumber(rotation.value, "modules.appearance.rotation.value");
    return;
  }
  if (rotation.mode === "random") {
    validateRangeLike(rotation, "modules.appearance.rotation", {
      allowNegative: true,
    });
    return;
  }

  validateRangeLike(rotation.start, "modules.appearance.rotation.start", {
    allowNegative: true,
  });
  validateRangeLike(rotation.speed, "modules.appearance.rotation.speed", {
    allowNegative: true,
  });
}

function validateBounds(bounds) {
  if (bounds === undefined) return;

  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) {
    throw new Error("Input Error: modules.bounds must be an object");
  }

  if (bounds.mode !== "none" && bounds.mode !== "recycle") {
    throw new Error(
      "Input Error: modules.bounds.mode must be 'none' or 'recycle'",
    );
  }

  if (bounds.mode === "none") return;

  if (bounds.source !== "area" && bounds.source !== "custom") {
    throw new Error(
      "Input Error: modules.bounds.source must be 'area' or 'custom'",
    );
  }

  if (bounds.padding !== undefined) {
    validatePadding(bounds.padding, "modules.bounds.padding");
  }

  if (bounds.source === "custom") {
    if (
      !bounds.custom ||
      typeof bounds.custom !== "object" ||
      Array.isArray(bounds.custom)
    ) {
      throw new Error("Input Error: modules.bounds.custom must be an object");
    }

    assertNumber(bounds.custom.x, "modules.bounds.custom.x");
    assertNumber(bounds.custom.y, "modules.bounds.custom.y");
    assertNumber(bounds.custom.width, "modules.bounds.custom.width");
    assertNumber(bounds.custom.height, "modules.bounds.custom.height");
  }
}

function validatePadding(padding, path) {
  if (typeof padding === "number") return;
  if (!padding || typeof padding !== "object" || Array.isArray(padding)) {
    throw new Error(`Input Error: ${path} must be a number or object`);
  }

  for (const side of ["top", "right", "bottom", "left"]) {
    assertNumber(padding[side], `${path}.${side}`);
  }
}

function validateRangeLike(value, path, options = {}) {
  if (typeof value === "number") {
    validateScalarValue(value, path, options);
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Input Error: ${path} must be a number or range object`);
  }

  assertNumber(value.min, `${path}.min`);
  assertNumber(value.max ?? value.min, `${path}.max`);
  validateScalarValue(value.min, `${path}.min`, options);
  validateScalarValue(value.max ?? value.min, `${path}.max`, options);

  if (value.min > (value.max ?? value.min)) {
    throw new Error(`Input Error: ${path}.min cannot be greater than max`);
  }

  if (value.distribution !== undefined) {
    validateDistribution(value.distribution, `${path}.distribution`);
  }
}

function validateScalarValue(value, path, options = {}) {
  assertNumber(value, path);

  if (!options.allowNegative && value < 0) {
    throw new Error(`Input Error: ${path} must be non-negative`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new Error(`Input Error: ${path} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(`Input Error: ${path} must be at most ${options.max}`);
  }
}

function validateDistribution(distribution, path) {
  if (
    !distribution ||
    typeof distribution !== "object" ||
    Array.isArray(distribution)
  ) {
    throw new Error(`Input Error: ${path} must be an object`);
  }

  if (!DISTRIBUTION_KINDS.has(distribution.kind)) {
    throw new Error(
      `Input Error: ${path}.kind must be one of ${[...DISTRIBUTION_KINDS].join(", ")}`,
    );
  }

  if (distribution.kind === "bias") {
    if (!BIAS_TOWARDS.has(distribution.toward ?? "min")) {
      throw new Error(
        `Input Error: ${path}.toward must be one of ${[...BIAS_TOWARDS].join(", ")}`,
      );
    }
    if (distribution.strength !== undefined) {
      assertNumber(distribution.strength, `${path}.strength`);
    }
  }

  if (distribution.kind === "normal") {
    if (distribution.mean !== undefined) {
      assertNumber(distribution.mean, `${path}.mean`);
    }
    if (distribution.deviation !== undefined) {
      assertNumber(distribution.deviation, `${path}.deviation`);
    }
  }
}

function assertNumber(value, path) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Input Error: ${path} must be a number`);
  }
}

function assertInteger(value, path) {
  assertNumber(value, path);
  if (!Number.isInteger(value)) {
    throw new Error(`Input Error: ${path} must be an integer`);
  }
}
