import { ComputedNodeType } from "../../../../constants.js";

/**
 * Validation helpers for particles parser.
 * All validations follow the pattern from parseCommonObject.
 */

/**
 * Validate basic required fields: id, type, width, height
 * @param {Object} state - The particles state
 * @throws {Error} If validation fails
 */
export function validateBasicFields(state) {
  if (!state.id) throw new Error("Input Error: Id is missing");

  if (!Object.values(ComputedNodeType).includes(state.type))
    throw new Error(
      "Input Error: Type must be one of " +
        Object.values(ComputedNodeType).join(", "),
    );

  if (!(typeof state.width === "number") || !(typeof state.height === "number"))
    throw new Error("Input Error: Width and height must be numbers");

  if (state.width <= 0 || state.height <= 0)
    throw new Error("Input Error: Width and height must be positive");
}

/**
 * Validate texture field (string or shape object)
 * @param {Object} state - The particles state
 * @throws {Error} If validation fails
 */
export function validateTexture(state) {
  if (!state.texture)
    throw new Error("Input Error: Particles require 'texture'");

  const isTextureString = typeof state.texture === "string";
  const isTextureObject =
    typeof state.texture === "object" &&
    state.texture !== null &&
    !Array.isArray(state.texture);

  if (!isTextureString && !isTextureObject)
    throw new Error("Input Error: texture must be a string or shape object");

  if (isTextureObject) {
    if (!state.texture.shape)
      throw new Error("Input Error: texture object must have 'shape' property");

    if (!["circle", "ellipse", "rect"].includes(state.texture.shape))
      throw new Error(
        `Input Error: texture.shape must be 'circle', 'ellipse', or 'rect', got '${state.texture.shape}'`,
      );
  }
}

/**
 * Validate behaviors array and each behavior object
 * @param {Object} state - The particles state
 * @throws {Error} If validation fails
 */
export function validateBehaviors(state) {
  if (!state.behaviors)
    throw new Error("Input Error: Particles require 'behaviors'");

  if (!Array.isArray(state.behaviors))
    throw new Error("Input Error: 'behaviors' must be an array");

  if (state.behaviors.length === 0)
    throw new Error("Input Error: 'behaviors' array cannot be empty");

  for (let i = 0; i < state.behaviors.length; i++) {
    const behavior = state.behaviors[i];

    if (
      typeof behavior !== "object" ||
      behavior === null ||
      Array.isArray(behavior)
    )
      throw new Error(`Input Error: behaviors[${i}] must be an object`);

    if (!behavior.type || typeof behavior.type !== "string")
      throw new Error(
        `Input Error: behaviors[${i}] must have a 'type' string property`,
      );
  }
}

/**
 * Validate emitter object and required lifetime property
 * @param {Object} state - The particles state
 * @throws {Error} If validation fails
 */
export function validateEmitter(state) {
  if (!state.emitter)
    throw new Error("Input Error: Particles require 'emitter'");

  if (typeof state.emitter !== "object" || Array.isArray(state.emitter))
    throw new Error("Input Error: 'emitter' must be an object");

  if (!state.emitter.lifetime)
    throw new Error("Input Error: emitter.lifetime is required");

  if (
    typeof state.emitter.lifetime !== "object" ||
    Array.isArray(state.emitter.lifetime)
  )
    throw new Error("Input Error: emitter.lifetime must be an object");

  if (
    !(typeof state.emitter.lifetime.min === "number") ||
    !(typeof state.emitter.lifetime.max === "number")
  )
    throw new Error(
      "Input Error: emitter.lifetime.min and max must be numbers",
    );

  if (state.emitter.lifetime.min < 0 || state.emitter.lifetime.max < 0)
    throw new Error(
      "Input Error: emitter.lifetime.min and max must be non-negative",
    );

  if (state.emitter.lifetime.min > state.emitter.lifetime.max)
    throw new Error(
      "Input Error: emitter.lifetime.min cannot be greater than max",
    );
}

/**
 * Validate optional emitter properties (frequency, particlesPerWave, maxParticles)
 * @param {Object} state - The particles state
 * @throws {Error} If validation fails
 */
export function validateEmitterOptionalProps(state) {
  if (state.emitter.frequency !== undefined) {
    if (!(typeof state.emitter.frequency === "number"))
      throw new Error("Input Error: emitter.frequency must be a number");

    if (state.emitter.frequency < 0)
      throw new Error("Input Error: emitter.frequency must be non-negative");
  }

  if (state.emitter.particlesPerWave !== undefined) {
    if (!(typeof state.emitter.particlesPerWave === "number"))
      throw new Error("Input Error: emitter.particlesPerWave must be a number");

    if (state.emitter.particlesPerWave <= 0)
      throw new Error("Input Error: emitter.particlesPerWave must be positive");

    if (!Number.isInteger(state.emitter.particlesPerWave))
      throw new Error(
        "Input Error: emitter.particlesPerWave must be an integer",
      );
  }

  if (state.emitter.maxParticles !== undefined) {
    if (!(typeof state.emitter.maxParticles === "number"))
      throw new Error("Input Error: emitter.maxParticles must be a number");

    if (state.emitter.maxParticles <= 0)
      throw new Error("Input Error: emitter.maxParticles must be positive");

    if (!Number.isInteger(state.emitter.maxParticles))
      throw new Error("Input Error: emitter.maxParticles must be an integer");
  }
}

/**
 * Validate optional top-level properties (count, alpha, x, y)
 * @param {Object} state - The particles state
 * @throws {Error} If validation fails
 */
export function validateOptionalFields(state) {
  if (state.count !== undefined) {
    if (!(typeof state.count === "number"))
      throw new Error("Input Error: count must be a number");

    if (state.count <= 0)
      throw new Error("Input Error: count must be positive");

    if (!Number.isInteger(state.count))
      throw new Error("Input Error: count must be an integer");
  }

  if (state.alpha !== undefined) {
    if (!(typeof state.alpha === "number"))
      throw new Error("Input Error: alpha must be a number");

    if (state.alpha < 0 || state.alpha > 1)
      throw new Error("Input Error: alpha must be between 0 and 1");
  }

  if (state.x !== undefined && !(typeof state.x === "number"))
    throw new Error("Input Error: x must be a number");

  if (state.y !== undefined && !(typeof state.y === "number"))
    throw new Error("Input Error: y must be a number");
}
