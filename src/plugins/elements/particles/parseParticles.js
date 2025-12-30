/**
 * Parse particles element.
 *
 * Note: Particles don't use parseCommonObject because:
 * - No anchor calculations needed (no single visual to anchor)
 * - Width/height are required and must be provided by caller
 */
export const parseParticles = ({ state }) => {
  // Required field validation
  if (!state.id) {
    throw new Error("Input Error: Id is missing");
  }

  if (!state.width || !state.height) {
    throw new Error("Input Error: Particles require both width and height");
  }

  if (!state.texture) {
    throw new Error("Input Error: Particles require 'texture'");
  }

  if (!state.behaviors) {
    throw new Error("Input Error: Particles require 'behaviors'");
  }

  if (!Array.isArray(state.behaviors)) {
    throw new Error("Input Error: 'behaviors' must be an array");
  }

  if (state.behaviors.length === 0) {
    throw new Error("Input Error: 'behaviors' array cannot be empty");
  }

  if (!state.emitter) {
    throw new Error("Input Error: Particles require 'emitter'");
  }

  if (typeof state.emitter !== "object" || Array.isArray(state.emitter)) {
    throw new Error("Input Error: 'emitter' must be an object");
  }

  // Reconcile count with emitter.maxParticles
  const count = state.emitter?.maxParticles ?? state.count ?? 100;

  // Build emitter config with count synced to maxParticles
  let emitter = state.emitter;
  if (
    emitter &&
    emitter.maxParticles === undefined &&
    state.count !== undefined
  ) {
    emitter = { ...emitter, maxParticles: count };
  }

  return {
    id: state.id,
    type: state.type,
    count,
    texture: state.texture,
    behaviors: state.behaviors,
    emitter,
    x: state.x ?? 0,
    y: state.y ?? 0,
    width: state.width,
    height: state.height,
    alpha: state.alpha ?? 1,
  };
};
