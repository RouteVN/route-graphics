import {
  createSnowflakeTexture,
  createRaindropTexture,
  createCircleTexture,
} from "../textures/index.js";
import { AlphaBehavior, StaticAlphaBehavior } from "../behaviors/alpha.js";
import { ScaleBehavior, StaticScaleBehavior } from "../behaviors/scale.js";
import {
  SpeedBehavior,
  StaticSpeedBehavior,
  PointMovementBehavior,
} from "../behaviors/speed.js";
import {
  AccelerationBehavior,
  GravityBehavior,
} from "../behaviors/acceleration.js";
import {
  RotationBehavior,
  StaticRotationBehavior,
  NoRotationBehavior,
} from "../behaviors/rotation.js";
import { ColorBehavior, StaticColorBehavior } from "../behaviors/color.js";
import {
  SpawnShapeBehavior,
  BurstSpawnBehavior,
} from "../behaviors/spawnShape.js";

const textureRegistry = new Map();
const behaviorRegistry = new Map();

// Public API

/**
 * Register a named texture for particles.
 * @param {string} name - Texture name (e.g., "circle", "snowflake")
 * @param {Function} factory - Function that receives app and returns a Texture
 */
export function registerParticleTexture(name, factory) {
  textureRegistry.set(name, factory);
}

/**
 * Register a behavior class. Uses BehaviorClass.type as the registry key.
 * @param {Function} BehaviorClass - Behavior class with static `type` property
 */
export function registerParticleBehavior(BehaviorClass) {
  behaviorRegistry.set(BehaviorClass.type, BehaviorClass);
}

/**
 * Get a texture by name.
 * @param {string} name - Texture name
 * @param {Application} app - PixiJS app for texture generation
 * @returns {Texture|null} Texture or null if not found
 */
export function getTexture(name, app) {
  const factory = textureRegistry.get(name);
  return factory ? factory(app) : null;
}

/**
 * Get a behavior class by type name.
 * @param {string} type - Behavior type (e.g., "alpha", "scale")
 * @returns {Function|undefined} Behavior class or undefined
 */
export function getBehavior(type) {
  return behaviorRegistry.get(type);
}

/** Get the full behavior registry Map. Used internally for validation. */
export function getBehaviorRegistry() {
  return behaviorRegistry;
}

// Register built-in textures
registerParticleTexture("circle", createCircleTexture);
registerParticleTexture("snowflake", createSnowflakeTexture);
registerParticleTexture("raindrop", createRaindropTexture);

// Register built-in behaviors
registerParticleBehavior(AlphaBehavior);
registerParticleBehavior(StaticAlphaBehavior);
registerParticleBehavior(ScaleBehavior);
registerParticleBehavior(StaticScaleBehavior);
registerParticleBehavior(SpeedBehavior);
registerParticleBehavior(StaticSpeedBehavior);
registerParticleBehavior(PointMovementBehavior);
registerParticleBehavior(AccelerationBehavior);
registerParticleBehavior(GravityBehavior);
registerParticleBehavior(RotationBehavior);
registerParticleBehavior(StaticRotationBehavior);
registerParticleBehavior(NoRotationBehavior);
registerParticleBehavior(ColorBehavior);
registerParticleBehavior(StaticColorBehavior);
registerParticleBehavior(SpawnShapeBehavior);
registerParticleBehavior(BurstSpawnBehavior);
