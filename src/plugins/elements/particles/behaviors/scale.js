/**
 * Scale behaviors for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

import { PropertyList } from "../emitter/propertyList.js";

/**
 * Applies interpolated scale values over particle lifetime.
 *
 * Config example:
 * {
 *   type: 'scale',
 *   config: {
 *     list: [
 *       { value: 0.5, time: 0 },
 *       { value: 1, time: 0.5 },
 *       { value: 0.5, time: 1 }
 *     ],
 *     minMult: 0.5  // Optional multiplier range
 *   }
 * }
 */
export class ScaleBehavior {
  static type = "scale";

  /**
   * @param {Object} config
   * @param {Array<{value: number, time: number}>} config.list - Scale keyframes
   * @param {number} [config.minMult=1] - Minimum multiplier for randomization
   */
  constructor(config) {
    this.list = new PropertyList(false);
    this.list.reset(config.list);
    this.minMult = config.minMult ?? 1;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      // Store random multiplier for this particle
      const mult =
        this.minMult < 1
          ? particle.emitter.random() * (1 - this.minMult) + this.minMult
          : 1;
      particle.config.scaleMult = mult;

      const scale = this.list.getValue(0) * mult;
      particle.scale.set(scale, scale);
      particle = particle.next;
    }
  }

  updateParticle(particle, _deltaSec) {
    const scale =
      this.list.getValue(particle.agePercent) * particle.config.scaleMult;
    particle.scale.set(scale, scale);
  }
}

/**
 * Applies a static random scale at initialization.
 *
 * Config example:
 * {
 *   type: 'scaleStatic',
 *   config: { min: 0.5, max: 1.5 }
 * }
 */
export class StaticScaleBehavior {
  static type = "scaleStatic";

  /**
   * @param {Object} config
   * @param {number} config.min - Minimum scale
   * @param {number} config.max - Maximum scale
   */
  constructor(config) {
    this.min = config.min;
    this.max = config.max;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      const scale =
        particle.emitter.random() * (this.max - this.min) + this.min;
      particle.scale.set(scale, scale);
      particle = particle.next;
    }
  }

  updateParticle(_particle, _deltaSec) {
    // Static - no update needed
  }
}
