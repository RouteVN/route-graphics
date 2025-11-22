/**
 * Complete Snow Effect Example for PixiJS
 * This demonstrates all key concepts for weather effects
 */

import {
  Application,
  ParticleContainer,
  Sprite,
  Texture,
  Graphics,
  Particle,
} from "pixi.js";
import { createSnowflakeTexture } from "./snowTexture";
import { createRaindropTexture } from "./rainTexture";

export const addParticle = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  let texture;
  switch (element.preset) {
    case "snow":
      texture = createSnowflakeTexture(app);
    case "rain":
      texture = createRaindropTexture(app);
  }

  const particleContainer = new ParticleContainer(500, {
    position: true,
    alpha: true,
    scale: true,
    rotation: false,
  });

  app.stage.addChild(particleContainer);

  const particles = [];
  const particleCount = element.count;

  for (let i = 0; i < particleCount; i++) {
    const particleConf = createParticles(texture);
    particles.push(particleConf);
    particleContainer.addParticle(particleConf.particle);
  }

  function createParticles(texture) {
    const particle = new Particle(texture);

    // Random starting position
    particle.x = Math.random() * app.screen.width;
    particle.y = Math.random() * app.screen.height;

    // Random properties for variety
    const scale = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
    // particle.scale.set(scale);
    particle.scaleX = scale;
    particle.scaleY = scale;
    particle.alpha = Math.random() * 0.5 + 0.5; // 0.5 to 1.0

    return {
      particle: particle,
      // Physics properties
      speedY: Math.random() * 1 + 0.5, // Fall speed (0.5 to 1.5)
      speedX: Math.random() * 0.5 - 0.25, // Slight horizontal drift
      wobble: Math.random() * Math.PI * 2, // For sine wave motion
      wobbleSpeed: Math.random() * 0.05 + 0.02, // How fast it wobbles
      wobbleAmount: Math.random() * 20 + 10, // How far it wobbles
    };
  }

  app.ticker.add((ticker) => {
    particles.forEach((particle) => {
      const p = particle.particle;
      const delta = ticker.deltaTime;

      // Move down (falling)
      p.y += particle.speedY * delta;

      // Wobble side to side (sine wave)
      particle.wobble += particle.wobbleSpeed * delta;
      p.x += Math.sin(particle.wobble) * 0.5 * delta;

      // Horizontal drift
      p.x += particle.speedX * delta;

      // Reset when off screen (recycling particles)
      if (p.y > app.screen.height + 10) {
        p.y = -10;
        p.x = Math.random() * app.screen.width;
      }

      // Wrap around horizontal edges
      if (p.x > app.screen.width) {
        p.x = 0;
      } else if (p.x < 0) {
        p.x = app.screen.width;
      }
    });
  });
};
