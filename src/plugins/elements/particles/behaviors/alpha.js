/**
 * Alpha behaviors for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

import { PropertyList } from "../emitter/propertyList.js";

/**
 * Applies interpolated alpha values over particle lifetime.
 *
 * Config example:
 * {
 *   type: 'alpha',
 *   config: {
 *     list: [
 *       { value: 0, time: 0 },
 *       { value: 1, time: 0.2 },
 *       { value: 0, time: 1 }
 *     ]
 *   }
 * }
 */
export class AlphaBehavior {
  static type = "alpha";

  /**
   * @param {Object} config
   * @param {Array<{value: number, time: number}>} config.list - Alpha keyframes
   */
  constructor(config) {
    this.list = new PropertyList(false);
    this.list.reset(config.list);
  }

  /**
   * Initialize particles
   * @param {Particle} first - First particle in linked list
   */
  initParticles(first) {
    let particle = first;
    const startValue = this.list.getValue(0);
    while (particle) {
      particle.alpha = startValue;
      particle = particle.next;
    }
  }

  /**
   * Update a particle
   * @param {Particle} particle
   * @param {number} deltaSec - Delta time in seconds
   */
  updateParticle(particle, deltaSec) {
    particle.alpha = this.list.getValue(particle.agePercent);
  }
}

/**
 * Applies a static alpha value at initialization.
 *
 * Config example:
 * {
 *   type: 'alphaStatic',
 *   config: { alpha: 0.8 }
 * }
 */
export class StaticAlphaBehavior {
  static type = "alphaStatic";

  /**
   * @param {Object} config
   * @param {number} config.alpha - Alpha value (0-1)
   */
  constructor(config) {
    this.alpha = config.alpha;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      particle.alpha = this.alpha;
      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    // Static - no update needed
  }
}
