import { Container, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";

import { Emitter } from "../../src/plugins/elements/particles/emitter/emitter.js";

function collectTextures(emitter) {
  const textures = [];
  let particle = emitter._activeFirst;
  while (particle) {
    textures.push(particle.texture);
    particle = particle.next;
  }
  return textures;
}

describe("particle texture selector", () => {
  it("cycles textures per particle in a deterministic order", () => {
    const container = new Container();
    const textureA = Texture.EMPTY;
    const textureB = Texture.WHITE;

    const emitter = new Emitter(container, {
      texture: {
        mode: "cycle",
        pick: "perParticle",
        items: [{ texture: textureA }, { texture: textureB }],
      },
      lifetime: { min: 1, max: 1 },
      frequency: 1,
      particlesPerWave: 1,
      maxParticles: 10,
      emit: false,
    });

    emitter.spawn(4);

    expect(collectTextures(emitter)).toEqual([
      textureA,
      textureB,
      textureA,
      textureB,
    ]);
  });

  it("applies one shared texture per wave when requested", () => {
    const container = new Container();
    const textureA = Texture.EMPTY;
    const textureB = Texture.WHITE;

    const emitter = new Emitter(container, {
      texture: {
        mode: "cycle",
        pick: "perWave",
        items: [{ texture: textureA }, { texture: textureB }],
      },
      lifetime: { min: 1, max: 1 },
      frequency: 1,
      particlesPerWave: 1,
      maxParticles: 10,
      emit: false,
    });

    emitter.spawn(3);
    expect(collectTextures(emitter)).toEqual([textureA, textureA, textureA]);

    emitter.spawn(2);
    expect(collectTextures(emitter)).toEqual([
      textureA,
      textureA,
      textureA,
      textureB,
      textureB,
    ]);
  });

  it("keeps weighted random texture selection deterministic under a seed", () => {
    const createEmitter = () =>
      new Emitter(new Container(), {
        texture: {
          mode: "random",
          pick: "perParticle",
          items: [
            { texture: Texture.EMPTY, weight: 3 },
            { texture: Texture.WHITE, weight: 1 },
          ],
        },
        lifetime: { min: 1, max: 1 },
        frequency: 1,
        particlesPerWave: 1,
        maxParticles: 10,
        seed: 12345,
        emit: false,
      });

    const first = createEmitter();
    const second = createEmitter();

    first.spawn(6);
    second.spawn(6);

    expect(collectTextures(first)).toEqual(collectTextures(second));
  });
});
