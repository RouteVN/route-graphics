/**
 * Particle Emitter - Core emitter implementation.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

import { Particle } from "./particle.js";
import { getBehavior } from "../util/registries.js";
import { SeededRandom } from "./seededRandom.js";

/**
 * Particle Emitter
 *
 * Manages particle lifecycle, spawning, recycling, and behavior execution.
 */
export class Emitter {
  /**
   * Container holding all particles
   * @type {Container}
   */
  container = null;

  /**
   * Particle texture
   * @type {Texture}
   */
  texture = null;

  /**
   * First active particle (linked list head)
   * @type {Particle|null}
   */
  _activeFirst = null;

  /**
   * Last active particle (linked list tail)
   * @type {Particle|null}
   */
  _activeLast = null;

  /**
   * First pooled particle (for recycling)
   * @type {Particle|null}
   */
  _poolFirst = null;

  /**
   * Number of active particles
   * @type {number}
   */
  particleCount = 0;

  /**
   * Maximum particles allowed
   * @type {number}
   */
  maxParticles = 1000;

  /**
   * Particle lifetime range
   * @type {{min: number, max: number}}
   */
  lifetime = { min: 1, max: 2 };

  /**
   * Spawn frequency in seconds (0 = spawn all at once)
   * @type {number}
   */
  frequency = 0.1;

  /**
   * Particles to emit per spawn
   * @type {number}
   */
  particlesPerWave = 1;

  /**
   * Time since last spawn
   * @type {number}
   */
  _spawnTimer = 0;

  /**
   * Emitter lifetime (-1 = infinite)
   * @type {number}
   */
  emitterLifetime = -1;

  /**
   * Current emitter age
   * @type {number}
   */
  _emitterAge = 0;

  /**
   * Whether emitter is actively emitting
   * @type {boolean}
   */
  emit = true;

  /**
   * Whether emitter is destroyed
   * @type {boolean}
   */
  destroyed = false;

  /**
   * Init behaviors (run once per particle on spawn)
   * @type {Array}
   */
  initBehaviors = [];

  /**
   * Update behaviors (run every frame)
   * @type {Array}
   */
  updateBehaviors = [];

  /**
   * Recycle behaviors (run when particle dies)
   * @type {Array}
   */
  recycleBehaviors = [];

  /**
   * Spawn area bounds (for recycling particles that go off-screen)
   * @type {{x: number, y: number, width: number, height: number}|null}
   */
  spawnBounds = null;

  /**
   * Whether to recycle particles that leave spawn bounds
   * @type {boolean}
   */
  recycleOnBounds = false;

  /**
   * Seeded random number generator (null = use Math.random)
   * @type {SeededRandom|null}
   */
  rng = null;

  /**
   * Create a new Emitter
   * @param {Container} container - Container to add particles to
   * @param {Object} config - Emitter configuration
   */
  constructor(container, config) {
    this.container = container;
    this.init(config);
  }

  /**
   * Initialize emitter with config
   * @param {Object} config
   */
  init(config) {
    // Initialize seeded RNG if seed is provided
    if (config.seed !== undefined && config.seed !== null) {
      this.rng = new SeededRandom(config.seed);
    }

    // Set texture
    if (config.texture) {
      this.texture = config.texture;
    }

    // Lifetime
    if (config.lifetime) {
      this.lifetime.min = config.lifetime.min ?? 1;
      this.lifetime.max = config.lifetime.max ?? config.lifetime.min ?? 2;
    }

    // Spawn settings
    this.frequency = config.frequency ?? 0.1;
    this.particlesPerWave = config.particlesPerWave ?? 1;
    this.maxParticles = config.maxParticles ?? 1000;
    this.emitterLifetime = config.emitterLifetime ?? -1;

    // Bounds
    if (config.spawnBounds) {
      this.spawnBounds = config.spawnBounds;
      this.recycleOnBounds = config.recycleOnBounds ?? false;
    }

    // Parse behaviors
    this.initBehaviors = [];
    this.updateBehaviors = [];
    this.recycleBehaviors = [];

    if (config.behaviors) {
      for (const behaviorConfig of config.behaviors) {
        const BehaviorClass = getBehavior(behaviorConfig.type);
        if (!BehaviorClass) {
          console.warn(`Unknown behavior type: ${behaviorConfig.type}`);
          continue;
        }

        const behavior = new BehaviorClass(behaviorConfig.config);

        // All behaviors can init
        if (behavior.initParticles) {
          this.initBehaviors.push(behavior);
        }

        // Check if behavior has update method
        if (behavior.updateParticle) {
          this.updateBehaviors.push(behavior);
        }

        // Check if behavior has recycle method
        if (behavior.recycleParticle) {
          this.recycleBehaviors.push(behavior);
        }
      }
    }

    // Reset state
    this._spawnTimer = 0;
    this._emitterAge = 0;
    this.emit = config.emit ?? true;
  }

  /**
   * Create a new particle or get one from the pool
   * @returns {Particle}
   */
  _createParticle() {
    let particle;

    if (this._poolFirst) {
      // Reuse from pool
      particle = this._poolFirst;
      this._poolFirst = particle.next;
      particle.next = null;
    } else {
      // Create new
      particle = new Particle(this);
    }

    // Set texture
    particle.texture = this.texture;

    return particle;
  }

  /**
   * Spawn a wave of particles
   * @param {number} count - Number to spawn
   * @returns {Particle|null} - First particle in spawned chain
   */
  spawn(count) {
    if (this.destroyed || count <= 0) return null;

    // Respect max particles
    const available = this.maxParticles - this.particleCount;
    count = Math.min(count, available);

    if (count <= 0) return null;

    // Create particle chain
    let first = null;
    let last = null;

    for (let i = 0; i < count; i++) {
      const particle = this._createParticle();

      // Calculate lifetime
      const lifetime =
        this.lifetime.min +
        this.random() * (this.lifetime.max - this.lifetime.min);
      particle.init(lifetime);

      // Add to chain
      if (!first) {
        first = particle;
      }
      if (last) {
        last.next = particle;
        particle.prev = last;
      }
      last = particle;

      // Add to display
      this.container.addChild(particle);
    }

    // Run init behaviors on the chain
    for (const behavior of this.initBehaviors) {
      behavior.initParticles(first);
    }

    // Add chain to active list
    if (this._activeLast) {
      this._activeLast.next = first;
      first.prev = this._activeLast;
    } else {
      this._activeFirst = first;
    }
    this._activeLast = last;

    this.particleCount += count;

    return first;
  }

  /**
   * Spawn a single wave immediately
   */
  emitNow() {
    this.spawn(this.particlesPerWave);
  }

  /**
   * Recycle a particle back to the pool
   * @param {Particle} particle
   */
  recycle(particle) {
    // Run recycle behaviors
    for (const behavior of this.recycleBehaviors) {
      behavior.recycleParticle(particle);
    }

    // Remove from active list
    if (particle.prev) {
      particle.prev.next = particle.next;
    } else {
      this._activeFirst = particle.next;
    }

    if (particle.next) {
      particle.next.prev = particle.prev;
    } else {
      this._activeLast = particle.prev;
    }

    // Reset links
    particle.prev = null;
    particle.next = null;

    // Remove from display
    if (particle.parent) {
      particle.parent.removeChild(particle);
    }

    // Add to pool
    particle.next = this._poolFirst;
    this._poolFirst = particle;

    this.particleCount--;
  }

  /**
   * Update emitter and all particles
   * @param {number} deltaSec - Time delta in seconds
   */
  update(deltaSec) {
    if (this.destroyed) return;

    // Update emitter lifetime
    if (this.emitterLifetime > 0) {
      this._emitterAge += deltaSec;
      if (this._emitterAge >= this.emitterLifetime) {
        this.emit = false;
      }
    }

    // Spawn new particles
    if (this.emit) {
      if (this.frequency <= 0) {
        // Burst mode: spawn all particles at once immediately
        this.spawn(this.particlesPerWave);
        this.emit = false; // Only spawn once for burst
      } else {
        this._spawnTimer += deltaSec;
        while (this._spawnTimer >= this.frequency) {
          this._spawnTimer -= this.frequency;
          this.spawn(this.particlesPerWave);
        }
      }
    }

    // Update active particles
    let particle = this._activeFirst;
    while (particle) {
      const next = particle.next; // Store next before potential recycle

      // Age particle
      particle.age += deltaSec;

      // Check if particle should die
      if (particle.age >= particle.maxLife) {
        this.recycle(particle);
        particle = next;
        continue;
      }

      // Check bounds if enabled
      if (this.recycleOnBounds && this.spawnBounds) {
        const bounds = this.spawnBounds;
        if (
          particle.x < bounds.x ||
          particle.x > bounds.x + bounds.width ||
          particle.y < bounds.y ||
          particle.y > bounds.y + bounds.height
        ) {
          this.recycle(particle);
          particle = next;
          continue;
        }
      }

      // Run update behaviors
      for (const behavior of this.updateBehaviors) {
        behavior.updateParticle(particle, deltaSec);
      }

      particle = next;
    }
  }

  /**
   * Stop emitting and optionally kill all particles
   * @param {boolean} [killParticles=false]
   */
  stop(killParticles = false) {
    this.emit = false;

    if (killParticles) {
      while (this._activeFirst) {
        this.recycle(this._activeFirst);
      }
    }
  }

  /**
   * Restart emitter
   */
  restart() {
    this._emitterAge = 0;
    this._spawnTimer = 0;
    this.emit = true;
  }

  /**
   * Get a random number between 0 and 1.
   * Uses seeded RNG if available, otherwise Math.random().
   * @returns {number} Random value in [0, 1)
   */
  random() {
    return this.rng ? this.rng.next() : Math.random();
  }

  /**
   * Clean up emitter
   */
  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;
    this.emit = false;

    // Destroy all active particles
    let particle = this._activeFirst;
    while (particle) {
      const next = particle.next;
      particle.destroy();
      particle = next;
    }

    // Destroy pooled particles
    particle = this._poolFirst;
    while (particle) {
      const next = particle.next;
      particle.destroy();
      particle = next;
    }

    this._activeFirst = null;
    this._activeLast = null;
    this._poolFirst = null;

    this.initBehaviors = [];
    this.updateBehaviors = [];
    this.recycleBehaviors = [];
  }
}
