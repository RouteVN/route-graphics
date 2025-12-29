import { Container, Texture, Graphics } from "pixi.js";
import { Emitter } from "./emitter/index.js";
import {
  getPreset,
  getTexture,
  getPresetDefaultTexture,
} from "./registries.js";

/**
 * Create a texture from inline shape definition.
 * Used when user specifies `texture: { shape: "circle", radius: 5 }` instead of a named texture.
 * @param {Application} app - PixiJS app for renderer access
 * @param {Object} shapeConfig - Shape definition with shape, color, radius/width/height
 */
function createCustomTexture(app, shapeConfig) {
  const g = new Graphics();
  const color = shapeConfig.color ?? "#ffffff";

  switch (shapeConfig.shape) {
    case "circle": {
      const radius = shapeConfig.radius ?? 3;
      g.circle(0, 0, radius);
      g.fill({ color });
      break;
    }
    case "ellipse": {
      const width = shapeConfig.width ?? 2;
      const height = shapeConfig.height ?? 6;
      g.ellipse(0, 0, width / 2, height / 2);
      g.fill({ color });
      break;
    }
    case "rect": {
      const width = shapeConfig.width ?? 4;
      const height = shapeConfig.height ?? 4;
      g.rect(-width / 2, -height / 2, width, height);
      g.fill({ color });
      break;
    }
    default:
      g.circle(0, 0, 3);
      g.fill({ color });
  }

  return app.renderer.generateTexture(g);
}

/**
 * Merge preset and custom behaviors.
 * Custom behaviors override preset behaviors of the same type.
 * @param {Array} presetBehaviors - Behaviors from the preset
 * @param {Array} customBehaviors - User-provided behaviors to add or override
 * @param {Array} disableBehaviors - Behavior types to remove (e.g., ["rotation"])
 */
function mergeBehaviors(
  presetBehaviors = [],
  customBehaviors = [],
  disableBehaviors = [],
) {
  const disableSet = new Set(disableBehaviors);
  const merged = presetBehaviors.filter((b) => !disableSet.has(b.type));

  for (const customBehavior of customBehaviors) {
    const existingIndex = merged.findIndex(
      (b) => b.type === customBehavior.type,
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = customBehavior;
    } else {
      merged.push(customBehavior);
    }
  }

  return merged;
}

/** Emitter properties that can be overridden by user config. */
const EMITTER_SCALAR_PROPS = [
  "frequency",
  "particlesPerWave",
  "maxParticles",
  "emitterLifetime",
  "recycleOnBounds",
  "seed",
];

/**
 * Merge user emitter overrides with preset defaults.
 * @param {Object} presetConfig - Default config from preset
 * @param {Object} customEmitter - User-provided emitter overrides
 */
function mergeEmitterConfig(presetConfig, customEmitter) {
  if (!customEmitter) return presetConfig;

  const merged = { ...presetConfig };

  if (customEmitter.lifetime) {
    merged.lifetime = { ...presetConfig.lifetime, ...customEmitter.lifetime };
  }
  if (customEmitter.spawnBounds) {
    merged.spawnBounds = {
      ...presetConfig.spawnBounds,
      ...customEmitter.spawnBounds,
    };
  }

  for (const prop of EMITTER_SCALAR_PROPS) {
    if (customEmitter[prop] !== undefined) {
      merged[prop] = customEmitter[prop];
    }
  }

  return merged;
}

/**
 * Add a particle effect to the stage.
 * Supports presets (snow, rain, fire, burst) or custom behavior configs.
 */
export const addParticle = async ({ app, parent, element, signal }) => {
  if (signal?.aborted) return;

  const container = new Container();
  container.label = element.id;
  parent.addChild(container);

  const width = element.width;
  const height = element.height;
  container.x = element.x ?? 0;
  container.y = element.y ?? 0;

  // Build emitter config from preset or custom behaviors
  let emitterConfig;

  if (element.preset) {
    const presetConfig = getPreset(element.preset, {
      width,
      height,
      count: element.count ?? 100,
      x: element.emitX ?? width / 2,
      y: element.emitY ?? height / 2,
    });

    if (!presetConfig) {
      console.warn(`Unknown particle preset: ${element.preset}`);
      return;
    }

    emitterConfig = mergeEmitterConfig(presetConfig, element.emitter);
    emitterConfig.behaviors = mergeBehaviors(
      presetConfig.behaviors,
      element.behaviors,
      element.disableBehaviors,
    );
  } else {
    // Custom behaviors (no preset)
    emitterConfig = {
      lifetime: element.emitter?.lifetime ?? { min: 1, max: 2 },
      frequency: element.emitter?.frequency ?? 0.1,
      particlesPerWave: element.emitter?.particlesPerWave ?? 1,
      maxParticles: element.emitter?.maxParticles ?? element.count ?? 100,
      emitterLifetime: element.emitter?.emitterLifetime ?? -1,
      spawnBounds: element.emitter?.spawnBounds,
      recycleOnBounds: element.emitter?.recycleOnBounds ?? false,
      seed: element.emitter?.seed,
      behaviors: element.behaviors,
    };
  }

  // Resolve texture: custom shape > named texture > preset default > circle
  let texture;
  if (typeof element.texture === "object" && element.texture.shape) {
    texture = createCustomTexture(app, element.texture);
  } else {
    const textureName =
      element.texture ?? getPresetDefaultTexture(element.preset) ?? "circle";
    texture = getTexture(textureName, app);
    if (!texture) {
      try {
        texture = Texture.from(textureName);
      } catch (e) {
        console.warn(`Failed to load particle texture: ${textureName}`);
        return;
      }
    }
  }
  emitterConfig.texture = texture;

  const emitter = new Emitter(container, emitterConfig);
  container.emitter = emitter;

  // Pre-fill weather effects so they don't start empty
  if (emitterConfig.recycleOnBounds) {
    const initialCount = Math.min(
      element.count ?? 100,
      emitterConfig.maxParticles,
    );
    emitter.spawn(initialCount);

    let particle = emitter._activeFirst;
    while (particle) {
      particle.y = emitter.random() * height;
      particle.age = emitter.random() * particle.maxLife * 0.8;
      particle = particle.next;
    }
  }

  // Set up ticker for updates
  const tickerCallback = (ticker) => {
    if (emitter.destroyed) {
      app.ticker.remove(tickerCallback);
      return;
    }
    emitter.update(ticker.deltaTime / 60);
  };
  container.tickerCallback = tickerCallback;

  if (app?.debug) {
    // VT mode: use snapShotKeyFrame events for deterministic testing
    const customTickerHandler = (event) => {
      if (emitter.destroyed) {
        window.removeEventListener("snapShotKeyFrame", customTickerHandler);
        return;
      }
      if (event?.detail?.deltaMS) {
        emitter.update(Number(event.detail.deltaMS) / 1000);
      }
    };
    window.addEventListener("snapShotKeyFrame", customTickerHandler);
    container.customTickerHandler = customTickerHandler;
  } else {
    app.ticker.add(tickerCallback);
  }

  if (element.alpha !== undefined) {
    container.alpha = element.alpha;
  }
};
