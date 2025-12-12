import {
  createSnowflakeTexture,
  createRaindropTexture,
  createCircleTexture,
} from "./textures/index.js";
import { AlphaBehavior, StaticAlphaBehavior } from "./behaviors/alpha.js";
import { ScaleBehavior, StaticScaleBehavior } from "./behaviors/scale.js";
import {
  SpeedBehavior,
  StaticSpeedBehavior,
  PointMovementBehavior,
} from "./behaviors/speed.js";
import {
  AccelerationBehavior,
  GravityBehavior,
} from "./behaviors/acceleration.js";
import {
  RotationBehavior,
  StaticRotationBehavior,
  NoRotationBehavior,
} from "./behaviors/rotation.js";
import { ColorBehavior, StaticColorBehavior } from "./behaviors/color.js";
import {
  SpawnShapeBehavior,
  BurstSpawnBehavior,
} from "./behaviors/spawnShape.js";

const presetRegistry = new Map();
const textureRegistry = new Map();
const behaviorRegistry = new Map();

const presetDefaultTextures = {
  snow: "snowflake",
  rain: "raindrop",
  fire: "circle",
  burst: "circle",
  explosion: "circle",
};

function validateBehavior(behavior, index, presetName) {
  if (!behavior || typeof behavior !== "object") {
    console.warn(
      `[particles] Preset "${presetName}" behavior[${index}] is not an object, skipping`,
    );
    return { valid: false };
  }
  if (!behavior.type || typeof behavior.type !== "string") {
    console.warn(
      `[particles] Preset "${presetName}" behavior[${index}] missing type, skipping`,
    );
    return { valid: false };
  }
  if (!getBehavior(behavior.type)) {
    console.warn(
      `[particles] Preset "${presetName}" behavior[${index}] unknown type "${behavior.type}", skipping`,
    );
    return { valid: false };
  }
  return { valid: true };
}

function validateLifetime(lifetime, presetName) {
  const defaultLifetime = { min: 1, max: 2 };

  if (!lifetime) return defaultLifetime;

  if (typeof lifetime !== "object") {
    console.warn(
      `[particles] Preset "${presetName}" lifetime must be an object, using default`,
    );
    return defaultLifetime;
  }

  const min =
    typeof lifetime.min === "number" ? lifetime.min : defaultLifetime.min;
  const max =
    typeof lifetime.max === "number" ? lifetime.max : defaultLifetime.max;

  if (min > max) {
    console.warn(
      `[particles] Preset "${presetName}" lifetime.min > max, swapping`,
    );
    return { min: max, max: min };
  }

  return { min, max };
}

// Public API

/**
 * Register a particle preset for use with `preset: "name"` in YAML.
 * @param {string} name - Preset name (e.g., "snow", "confetti")
 * @param {Function} factory - Function that receives options and returns emitter config
 */
export function registerParticlePreset(name, factory) {
  presetRegistry.set(name, factory);
}

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
 * Get a preset config by name.
 * @param {string} name - Preset name
 * @param {Object} options - Options passed to factory (width, height, x, y, count)
 * @returns {Object|null} Emitter config or null if not found
 */
export function getPreset(name, options) {
  const factory = presetRegistry.get(name);
  return factory ? factory(options) : null;
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

/**
 * Get the default texture for a preset.
 * @param {string} presetName - Preset name
 * @returns {string} Texture name (defaults to "circle")
 */
export function getPresetDefaultTexture(presetName) {
  return presetDefaultTextures[presetName] ?? "circle";
}

/**
 * Set the default texture for a preset.
 * @param {string} presetName - Preset name
 * @param {string} textureName - Texture name to use as default
 */
export function setPresetDefaultTexture(presetName, textureName) {
  presetDefaultTextures[presetName] = textureName;
}

/**
 * Load custom presets from config object (typically parsed from YAML).
 * Invalid presets are skipped with console warnings.
 * @param {Object} config - Config with `presets` object mapping names to definitions
 * @returns {{ loaded: string[], skipped: string[] }} Lists of successfully loaded and skipped preset names
 */
export function loadParticlePresets(config) {
  const result = { loaded: [], skipped: [] };

  if (!config?.presets) return result;

  if (typeof config.presets !== "object" || Array.isArray(config.presets)) {
    console.warn("[particles] config.presets must be an object");
    return result;
  }

  for (const [name, presetDef] of Object.entries(config.presets)) {
    if (!name || typeof name !== "string") {
      console.warn("[particles] Invalid preset name, skipping");
      result.skipped.push(String(name));
      continue;
    }

    if (
      !presetDef ||
      typeof presetDef !== "object" ||
      Array.isArray(presetDef)
    ) {
      console.warn(`[particles] Preset "${name}" must be an object, skipping`);
      result.skipped.push(name);
      continue;
    }

    if (!Array.isArray(presetDef.behaviors)) {
      console.warn(
        `[particles] Preset "${name}" missing behaviors array, skipping`,
      );
      result.skipped.push(name);
      continue;
    }

    const validBehaviors = presetDef.behaviors.filter(
      (b, i) => validateBehavior(b, i, name).valid,
    );

    if (validBehaviors.length === 0) {
      console.warn(
        `[particles] Preset "${name}" has no valid behaviors, skipping`,
      );
      result.skipped.push(name);
      continue;
    }

    if (typeof presetDef.texture === "string") {
      setPresetDefaultTexture(name, presetDef.texture);
    }

    const lifetime = validateLifetime(presetDef.lifetime, name);

    const factory = (options) => {
      const config = {
        lifetime: { ...lifetime },
        frequency:
          typeof presetDef.frequency === "number" ? presetDef.frequency : 0.1,
        particlesPerWave:
          typeof presetDef.particlesPerWave === "number"
            ? presetDef.particlesPerWave
            : 1,
        maxParticles:
          options.count ??
          (typeof presetDef.maxParticles === "number"
            ? presetDef.maxParticles
            : 100),
        emitterLifetime:
          typeof presetDef.emitterLifetime === "number"
            ? presetDef.emitterLifetime
            : -1,
        behaviors: validBehaviors,
      };

      if (presetDef.spawnBounds && typeof presetDef.spawnBounds === "object") {
        config.spawnBounds = presetDef.spawnBounds;
      }
      if (typeof presetDef.recycleOnBounds === "boolean") {
        config.recycleOnBounds = presetDef.recycleOnBounds;
      }

      return config;
    };

    registerParticlePreset(name, factory);
    result.loaded.push(name);
  }

  return result;
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
