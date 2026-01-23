/**
 * Rotation behaviors for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

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
    this.minStart = config.minStart * DEG_TO_RAD;
    this.maxStart = config.maxStart * DEG_TO_RAD;
    this.minSpeed = config.minSpeed * DEG_TO_RAD;
    this.maxSpeed = config.maxSpeed * DEG_TO_RAD;
    this.accel = (config.accel ?? 0) * DEG_TO_RAD;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      particle.rotation =
        particle.emitter.random() * (this.maxStart - this.minStart) +
        this.minStart;
      particle.rotationSpeed =
        particle.emitter.random() * (this.maxSpeed - this.minSpeed) +
        this.minSpeed;

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
    this.min = config.min * DEG_TO_RAD;
    this.max = config.max * DEG_TO_RAD;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      particle.rotation =
        particle.emitter.random() * (this.max - this.min) + this.min;
      particle = particle.next;
    }
  }

  updateParticle(_particle, _deltaSec) {
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

  updateParticle(particle, _deltaSec) {
    particle.rotation = this.rotation;
  }
}
