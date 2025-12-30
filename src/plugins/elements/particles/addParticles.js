import { Container, Texture, Graphics } from "pixi.js";
import { Emitter } from "./emitter/index.js";
import { getTexture } from "./registries.js";

/**
 * @typedef {import('pixi.js').Application} Application
 * @typedef {import('../../../types.js').ParticleTextureShape} ParticleTextureShape
 */

/**
 * Create a texture from inline shape definition.
 * Used when user specifies `texture: { shape: "circle", radius: 5 }` instead of a named texture.
 * @param {Application} app - PixiJS app for renderer access
 * @param {ParticleTextureShape} shapeConfig - Shape definition with shape, color, radius/width/height
 * @return {import('pixi.js').Texture}
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
 * Add a particle effect to the stage using custom behavior configs.
 * @param {import("../elementPlugin.js").AddElementOptions} params
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

  // Build emitter config from custom behaviors
  const emitterConfig = {
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

  // Resolve texture: custom shape > named texture > circle
  let texture;
  if (typeof element.texture === "object" && element.texture.shape) {
    texture = createCustomTexture(app, element.texture);
  } else {
    const textureName = element.texture ?? "circle";
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
