/**
 * Update particles element.
 * Particle emitter adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 *
 * For particles, updates are handled by destroying and recreating the emitter
 * since emitter configuration cannot be hot-reloaded cleanly.
 */

import { deleteParticles } from "./deleteParticles.js";
import { addParticle } from "./addParticles.js";

/**
 * @typedef {import('../../../types.js').ParticlesComputedNode} ParticlesComputedNode
 */

/**
 * Update particles element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateParticles = ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationBus,
  completionTracker,
  zIndex,
}) => {
  // Find the existing container
  const container = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!container) {
    // Container doesn't exist, just add the new one
    addParticle({
      app,
      parent,
      element: nextElement,
      animations,
      animationBus,
      completionTracker,
      zIndex,
    });
    return;
  }

  // Update zIndex
  container.zIndex = zIndex;

  // Check if we need to recreate the emitter (config changes)
  const needsRecreate = hasConfigChanged(prevElement, nextElement);

  if (needsRecreate) {
    // Delete old emitter and create new one
    deleteParticles({
      app,
      parent,
      element: prevElement,
      animations,
      animationBus,
      completionTracker,
    });

    addParticle({
      app,
      parent,
      element: nextElement,
      animations,
      animationBus,
      completionTracker,
      zIndex,
    });
  } else {
    // Simple property updates that don't require emitter recreation
    if (nextElement.alpha !== undefined) {
      container.alpha = nextElement.alpha;
    }
    if (nextElement.x !== undefined) {
      container.x = nextElement.x;
    }
    if (nextElement.y !== undefined) {
      container.y = nextElement.y;
    }
  }
};

/**
 * Check if emitter configuration has changed in a way that requires recreation.
 * @param {ParticlesComputedNode} prev - Previous element state
 * @param {ParticlesComputedNode} next - Next element state
 * @returns {boolean} Whether emitter needs to be recreated
 */
function hasConfigChanged(prev, next) {
  // Changes that require emitter recreation
  if (prev.count !== next.count) return true;
  if (JSON.stringify(prev.texture) !== JSON.stringify(next.texture))
    return true;
  if (JSON.stringify(prev.behaviors) !== JSON.stringify(next.behaviors))
    return true;
  if (JSON.stringify(prev.emitter) !== JSON.stringify(next.emitter))
    return true;
  if (prev.width !== next.width) return true;
  if (prev.height !== next.height) return true;

  return false;
}
