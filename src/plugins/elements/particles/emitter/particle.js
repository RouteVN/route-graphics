/**
 * Particle class for the emitter system.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

import { Sprite } from "pixi.js";

/**
 * A single particle in the particle system.
 * Extends Sprite and adds lifecycle management.
 */
export class Particle extends Sprite {
  /**
   * Reference to the emitter that owns this particle
   * @type {Emitter}
   */
  emitter = null;

  /**
   * Maximum lifetime in seconds
   * @type {number}
   */
  maxLife = 0;

  /**
   * Current age in seconds
   * @type {number}
   */
  age = 0;

  /**
   * Pre-calculated 1/maxLife for performance
   * @type {number}
   */
  oneOverLife = 0;

  /**
   * Current age as percentage (0-1)
   * @type {number}
   */
  get agePercent() {
    return this.age * this.oneOverLife;
  }

  /**
   * Velocity vector
   * @type {{x: number, y: number}}
   */
  velocity = { x: 0, y: 0 };

  /**
   * Rotation speed in radians/sec
   * @type {number}
   */
  rotationSpeed = 0;

  /**
   * Custom config storage for behaviors
   * @type {Object}
   */
  config = {};

  /**
   * Next particle in linked list
   * @type {Particle|null}
   */
  next = null;

  /**
   * Previous particle in linked list
   * @type {Particle|null}
   */
  prev = null;

  constructor(emitter) {
    super();
    this.emitter = emitter;
    this.anchor.set(0.5, 0.5);
  }

  /**
   * Initialize particle for a new lifecycle
   * @param {number} maxLife - Maximum lifetime in seconds
   */
  init(maxLife) {
    this.maxLife = maxLife;
    this.age = 0;
    this.oneOverLife = 1 / maxLife;

    // Reset sprite properties
    this.rotation = 0;
    this.position.set(0, 0);
    this.scale.set(1, 1);
    this.tint = 0xffffff;
    this.alpha = 1;
    this.visible = true;

    // Reset physics
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.rotationSpeed = 0;

    // Clear behavior config
    this.config = {};
  }

  /**
   * Kill this particle (return to pool)
   */
  kill() {
    this.emitter.recycle(this);
  }

  /**
   * Clean up for garbage collection
   */
  destroy() {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.emitter = null;
    this.next = null;
    this.prev = null;
    super.destroy();
  }
}
