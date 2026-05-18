/**
 * Rotation behaviors for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

import { sampleRange } from "../util/sampling.js";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Applies rotation with speed and acceleration.
 *
 * Config example:
 * {
 *   type: 'rotation',
 *   config: {
 *     minStart: 0,
 *     maxStart: 360,
 *     minSpeed: -90,
 *     maxSpeed: 90,
 *     accel: 0
 *   }
 * }
 */
export class RotationBehavior {
  static type = "rotation";

  /**
   * @param {Object} config
   * @param {number} config.minStart - Minimum starting rotation (degrees)
   * @param {number} config.maxStart - Maximum starting rotation (degrees)
   * @param {number} config.minSpeed - Minimum rotation speed (degrees/sec)
   * @param {number} config.maxSpeed - Maximum rotation speed (degrees/sec)
   * @param {number} [config.accel=0] - Rotation acceleration (degrees/sec²)
   */
  constructor(config) {
    this.startRange = {
      min: config.minStart,
      max: config.maxStart ?? config.minStart,
      distribution: config.startDistribution,
    };
    this.speedRange = {
      min: config.minSpeed,
      max: config.maxSpeed ?? config.minSpeed,
      distribution: config.speedDistribution,
    };
    this.accel = (config.accel ?? 0) * DEG_TO_RAD;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      particle.rotation =
        sampleRange(
          particle.emitter.random.bind(particle.emitter),
          this.startRange,
        ) * DEG_TO_RAD;
      particle.rotationSpeed =
        sampleRange(
          particle.emitter.random.bind(particle.emitter),
          this.speedRange,
        ) * DEG_TO_RAD;

      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    if (this.accel !== 0) {
      const oldSpeed = particle.rotationSpeed;
      particle.rotationSpeed += this.accel * deltaSec;
      // Use average speed for smoother motion
      particle.rotation += ((oldSpeed + particle.rotationSpeed) / 2) * deltaSec;
    } else {
      particle.rotation += particle.rotationSpeed * deltaSec;
    }
  }
}

/**
 * Applies a static random rotation at initialization.
 *
 * Config example:
 * {
 *   type: 'rotationStatic',
 *   config: { min: 0, max: 360 }
 * }
 */
export class StaticRotationBehavior {
  static type = "rotationStatic";

  /**
   * @param {Object} config
   * @param {number} config.min - Minimum rotation (degrees)
   * @param {number} config.max - Maximum rotation (degrees)
   */
  constructor(config) {
    this.range = {
      min: config.min,
      max: config.max ?? config.min,
      distribution: config.distribution,
    };
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      particle.rotation =
        sampleRange(
          particle.emitter.random.bind(particle.emitter),
          this.range,
        ) * DEG_TO_RAD;
      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    // Static - no update
  }
}

/**
 * Forces all particles to a fixed rotation (useful for rain/snow).
 *
 * Config example:
 * {
 *   type: 'noRotation',
 *   config: { rotation: 0 }
 * }
 */
export class NoRotationBehavior {
  static type = "noRotation";

  /**
   * @param {Object} config
   * @param {number} [config.rotation=0] - Fixed rotation (degrees)
   */
  constructor(config) {
    this.rotation = (config.rotation ?? 0) * DEG_TO_RAD;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      particle.rotation = this.rotation;
      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    particle.rotation = this.rotation;
  }
}
