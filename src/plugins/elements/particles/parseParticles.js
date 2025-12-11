/**
 * Parse particles element.
 *
 * Note: Particles don't use parseCommonObject because:
 * - No anchor calculations needed (no single visual to anchor)
 * - Width/height are optional (defaults to screen size)
 * - emitX/emitY handle point-based emission positioning
 */
export const parseParticles = ({ state }) => {
  // Required field validation
  if (!state.id) {
    throw new Error("Input Error: Id is missing");
  }

  // Must have either preset or behaviors
  if (!state.preset && !state.behaviors) {
    throw new Error("Input Error: Particles require either 'preset' or 'behaviors'");
  }

  // Behaviors must be an array if provided
  if (state.behaviors !== undefined && !Array.isArray(state.behaviors)) {
    throw new Error("Input Error: 'behaviors' must be an array");
  }

  // Emitter must be an object if provided
  if (state.emitter !== undefined && (typeof state.emitter !== "object" || Array.isArray(state.emitter))) {
    throw new Error("Input Error: 'emitter' must be an object");
  }

  // Reconcile count with emitter.maxParticles
  const count = state.emitter?.maxParticles ?? state.count ?? 100;

  // Build emitter config with count synced to maxParticles
  let emitter = state.emitter;
  if (emitter && emitter.maxParticles === undefined && state.count !== undefined) {
    emitter = { ...emitter, maxParticles: count };
  }

  return {
    id: state.id,
    type: state.type,
    preset: state.preset,
    count,
    texture: state.texture,
    behaviors: state.behaviors,
    disableBehaviors: state.disableBehaviors,
    emitter,
    x: state.x ?? 0,
    y: state.y ?? 0,
    width: state.width,
    height: state.height,
    emitX: state.emitX,
    emitY: state.emitY,
    alpha: state.alpha ?? 1,
  };
};
