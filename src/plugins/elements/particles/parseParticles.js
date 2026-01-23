import {
  validateBasicFields,
  validateTexture,
  validateBehaviors,
  validateEmitter,
  validateEmitterOptionalProps,
  validateOptionalFields,
} from "./util/validateParticles.js";

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').ParticlesComputedNode} ParticlesComputedNode
 */

/**
 * Parse particles element.
 *
 * Note: Particles don't use parseCommonObject because:
 * - No anchor calculations needed (particles container has many small sprites)
 * - No scale calculations needed (particles use raw width/height for spawn bounds)
 * - Width/height must be raw values, not scaled
 *
 * @param {Object} params
 * @param {BaseElement} params.state - The particles state to parse
 * @param {Array} [params.parserPlugins] - Array of parser plugins (not used by this parser)
 * @return {ParticlesComputedNode}
 */
export const parseParticles = ({ state }) => {
  // Run all validations
  validateBasicFields(state);
  validateTexture(state);
  validateBehaviors(state);
  validateEmitter(state);
  validateEmitterOptionalProps(state);
  validateOptionalFields(state);

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
