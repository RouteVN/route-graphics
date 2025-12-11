/**
 * Acceleration/Gravity behavior for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

const DEG_TO_RAD = Math.PI / 180;

/**
 * Applies constant acceleration (like gravity) to particles.
 *
 * Config example:
 * {
 *   type: 'acceleration',
 *   config: {
 *     accel: { x: 0, y: 500 },  // Gravity pulling down
 *     minStart: 100,
 *     maxStart: 200,
 *     rotate: false,  // Face movement direction
 *     maxSpeed: 0     // 0 = no limit
 *   }
 * }
 */
export class AccelerationBehavior {
  static type = "acceleration";

  /**
   * @param {Object} config
   * @param {Object} config.accel - Acceleration vector
   * @param {number} config.accel.x - X acceleration (pixels/sec²)
   * @param {number} config.accel.y - Y acceleration (pixels/sec²)
   * @param {number} config.minStart - Minimum initial speed
   * @param {number} config.maxStart - Maximum initial speed
   * @param {boolean} [config.rotate=false] - Rotate to face movement direction
   * @param {number} [config.maxSpeed=0] - Maximum speed (0 = unlimited)
   */
  constructor(config) {
    this.accelX = config.accel.x;
    this.accelY = config.accel.y;
    this.minStart = config.minStart;
    this.maxStart = config.maxStart;
    this.rotate = config.rotate ?? false;
    this.maxSpeed = config.maxSpeed ?? 0;
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      const speed =
        particle.emitter.random() * (this.maxStart - this.minStart) + this.minStart;

      // Set initial velocity based on rotation
      particle.velocity.x = Math.cos(particle.rotation) * speed;
      particle.velocity.y = Math.sin(particle.rotation) * speed;

      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    const vel = particle.velocity;

    // Store old velocity for trapezoid integration
    const oldVelX = vel.x;
    const oldVelY = vel.y;

    // Apply acceleration
    vel.x += this.accelX * deltaSec;
    vel.y += this.accelY * deltaSec;

    // Clamp to max speed if set
    if (this.maxSpeed > 0) {
      const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (currentSpeed > this.maxSpeed) {
        const scale = this.maxSpeed / currentSpeed;
        vel.x *= scale;
        vel.y *= scale;
      }
    }

    // Update position using average velocity (trapezoid rule)
    particle.x += ((oldVelX + vel.x) / 2) * deltaSec;
    particle.y += ((oldVelY + vel.y) / 2) * deltaSec;

    // Rotate to face movement direction
    if (this.rotate) {
      particle.rotation = Math.atan2(vel.y, vel.x);
    }
  }
}

/**
 * Simple gravity behavior - just adds constant downward force.
 *
 * Config example:
 * {
 *   type: 'gravity',
 *   config: { gravity: 500 }
 * }
 */
export class GravityBehavior {
  static type = "gravity";

  /**
   * @param {Object} config
   * @param {number} config.gravity - Gravity strength (pixels/sec²)
   */
  constructor(config) {
    this.gravity = config.gravity;
  }

  initParticles(first) {
    // No initialization needed
  }

  updateParticle(particle, deltaSec) {
    // Apply gravity to velocity
    particle.velocity.y += this.gravity * deltaSec;

    // Update position
    particle.x += particle.velocity.x * deltaSec;
    particle.y += particle.velocity.y * deltaSec;
  }
}
