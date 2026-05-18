import { describe, expect, it } from "vitest";
import { Container, Texture } from "pixi.js";
import { Emitter } from "./emitter.js";

describe("Emitter", () => {
  it("ignores particles that were destroyed by an external parent teardown", () => {
    const container = new Container();
    const emitter = new Emitter(container, {
      texture: Texture.EMPTY,
      lifetime: { min: 10, max: 10 },
      frequency: 0,
      particlesPerWave: 1,
      maxParticles: 1,
    });

    emitter.spawn(1);
    const particle = emitter._activeFirst;
    particle.destroy();

    expect(() => emitter.update(0.016)).not.toThrow();
    expect(emitter.particleCount).toBe(0);
    expect(emitter._activeFirst).toBeNull();
    expect(emitter._activeLast).toBeNull();
  });

  it("keeps particle counts accurate when recycling live particles", () => {
    const container = new Container();
    const emitter = new Emitter(container, {
      texture: Texture.EMPTY,
      lifetime: { min: 10, max: 10 },
      frequency: 0,
      particlesPerWave: 2,
      maxParticles: 2,
    });

    emitter.spawn(2);
    const firstParticle = emitter._activeFirst;

    emitter.recycle(firstParticle);

    expect(emitter.particleCount).toBe(1);

    emitter.recycle(emitter._activeFirst);

    expect(emitter.particleCount).toBe(0);

    emitter.spawn(2);

    expect(emitter.particleCount).toBe(2);
  });
});
