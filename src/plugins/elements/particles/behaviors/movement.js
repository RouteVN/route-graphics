/**
 * Structured movement behavior for module-compiled particle configs.
 */

import { sampleRange } from "../util/sampling.js";

const DEG_TO_RAD = Math.PI / 180;

export class MovementBehavior {
  static type = "movement";

  /**
   * @param {Object} config
   * @param {Object} [config.velocity]
   * @param {"directional" | "radial"} config.velocity.kind
   * @param {number|Object} config.velocity.speed
   * @param {number|Object} [config.velocity.direction]
   * @param {number|Object} [config.velocity.angle]
   * @param {{x: number, y: number}} [config.acceleration]
   * @param {number} [config.maxSpeed=0]
   * @param {boolean} [config.faceVelocity=false]
   */
  constructor(config = {}) {
    this.velocity = config.velocity ?? null;
    this.accelX = config.acceleration?.x ?? 0;
    this.accelY = config.acceleration?.y ?? 0;
    this.maxSpeed = config.maxSpeed ?? 0;
    this.faceVelocity = config.faceVelocity ?? false;
  }

  initParticles(first) {
    let particle = first;

    while (particle) {
      if (this.velocity) {
        const angle = this.#sampleAngle(
          particle.emitter.random.bind(particle.emitter),
        );
        const speed = sampleRange(
          particle.emitter.random.bind(particle.emitter),
          this.velocity.speed,
        );

        particle.velocity.x = Math.cos(angle) * speed;
        particle.velocity.y = Math.sin(angle) * speed;

        if (this.faceVelocity && speed > 0) {
          particle.rotation = angle;
        }
      }

      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    const vel = particle.velocity;
    const hasAcceleration = this.accelX !== 0 || this.accelY !== 0;

    if (hasAcceleration) {
      const oldVelX = vel.x;
      const oldVelY = vel.y;

      vel.x += this.accelX * deltaSec;
      vel.y += this.accelY * deltaSec;

      this.#clampSpeed(vel);

      particle.x += ((oldVelX + vel.x) / 2) * deltaSec;
      particle.y += ((oldVelY + vel.y) / 2) * deltaSec;
    } else {
      this.#clampSpeed(vel);

      particle.x += vel.x * deltaSec;
      particle.y += vel.y * deltaSec;
    }

    if (this.faceVelocity) {
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > 0) {
        particle.rotation = Math.atan2(vel.y, vel.x);
      }
    }
  }

  /**
   * @param {() => number} random
   * @returns {number}
   */
  #sampleAngle(random) {
    if (!this.velocity) return 0;

    if (this.velocity.kind === "radial") {
      return (
        sampleRange(random, this.velocity.angle ?? { min: 0, max: 360 }) *
        DEG_TO_RAD
      );
    }

    return sampleRange(random, this.velocity.direction ?? 0) * DEG_TO_RAD;
  }

  /**
   * @param {{x: number, y: number}} velocity
   */
  #clampSpeed(velocity) {
    if (this.maxSpeed <= 0) return;

    const currentSpeed = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y,
    );

    if (currentSpeed > this.maxSpeed && currentSpeed > 0) {
      const scale = this.maxSpeed / currentSpeed;
      velocity.x *= scale;
      velocity.y *= scale;
    }
  }
}
