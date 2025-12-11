/**
 * Speed/Movement behaviors for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

import { PropertyList } from "../emitter/propertyList.js";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Applies interpolated speed values over particle lifetime.
 * Movement direction is based on particle rotation.
 *
 * Config example:
 * {
 *   type: 'speed',
 *   config: {
 *     list: [
 *       { value: 200, time: 0 },
 *       { value: 100, time: 1 }
 *     ],
 *     minMult: 0.8
 *   }
 * }
 */
export class SpeedBehavior {
  static type = "speed";

  /**
   * @param {Object} config
   * @param {Array<{value: number, time: number}>} config.list - Speed keyframes (pixels/sec)
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
      // Random multiplier
      const mult =
        this.minMult < 1
          ? particle.emitter.random() * (1 - this.minMult) + this.minMult
          : 1;
      particle.config.speedMult = mult;

      // Set initial velocity based on rotation
      const speed = this.list.getValue(0) * mult;
      particle.velocity.x = Math.cos(particle.rotation) * speed;
      particle.velocity.y = Math.sin(particle.rotation) * speed;

      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    const speed =
      this.list.getValue(particle.agePercent) * particle.config.speedMult;

    // Normalize and scale velocity
    const len = Math.sqrt(
      particle.velocity.x * particle.velocity.x +
        particle.velocity.y * particle.velocity.y
    );

    if (len > 0) {
      particle.velocity.x = (particle.velocity.x / len) * speed;
      particle.velocity.y = (particle.velocity.y / len) * speed;
    }

    // Apply velocity
    particle.x += particle.velocity.x * deltaSec;
    particle.y += particle.velocity.y * deltaSec;
  }
}

/**
 * Applies a constant random speed at initialization.
 *
 * Config example:
 * {
 *   type: 'speedStatic',
 *   config: { min: 100, max: 200 }
 * }
 */
export class StaticSpeedBehavior {
  static type = "speedStatic";

  /**
   * @param {Object} config
   * @param {number} config.min - Minimum speed (pixels/sec)
   * @param {number} config.max - Maximum speed (pixels/sec)
   */
  constructor(config) {
    this.min = config.min;
    this.max = config.max;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      const speed = particle.emitter.random() * (this.max - this.min) + this.min;

      // Set velocity based on rotation
      particle.velocity.x = Math.cos(particle.rotation) * speed;
      particle.velocity.y = Math.sin(particle.rotation) * speed;

      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    // Apply constant velocity
    particle.x += particle.velocity.x * deltaSec;
    particle.y += particle.velocity.y * deltaSec;
  }
}

/**
 * Point movement - moves in a specific direction.
 *
 * Config example:
 * {
 *   type: 'movePoint',
 *   config: {
 *     speed: { min: 100, max: 200 },
 *     direction: 90  // Degrees (0 = right, 90 = down)
 *   }
 * }
 */
export class PointMovementBehavior {
  static type = "movePoint";

  /**
   * @param {Object} config
   * @param {Object} config.speed
   * @param {number} config.speed.min
   * @param {number} config.speed.max
   * @param {number} config.direction - Direction in degrees
   */
  constructor(config) {
    this.minSpeed = config.speed.min;
    this.maxSpeed = config.speed.max;
    this.direction = config.direction * DEG_TO_RAD;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      const speed =
        particle.emitter.random() * (this.maxSpeed - this.minSpeed) + this.minSpeed;

      particle.velocity.x = Math.cos(this.direction) * speed;
      particle.velocity.y = Math.sin(this.direction) * speed;

      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    particle.x += particle.velocity.x * deltaSec;
    particle.y += particle.velocity.y * deltaSec;
  }
}
