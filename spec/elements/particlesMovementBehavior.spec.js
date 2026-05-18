import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";

import { Emitter } from "../../src/plugins/elements/particles/emitter/emitter.js";

function firstParticle(emitter) {
  return emitter._activeFirst;
}

describe("particle movement behavior", () => {
  it("applies directional velocity, acceleration, and faceVelocity over time", () => {
    const emitter = new Emitter(new Container(), {
      texture: null,
      lifetime: { min: 2, max: 2 },
      frequency: 1,
      particlesPerWave: 1,
      maxParticles: 4,
      emit: false,
      seed: 123,
      behaviors: [
        {
          type: "movement",
          config: {
            velocity: {
              kind: "directional",
              direction: 0,
              speed: 100,
            },
            acceleration: {
              x: 0,
              y: 50,
            },
            faceVelocity: true,
          },
        },
      ],
    });

    emitter.spawn(1);
    const particle = firstParticle(emitter);

    expect(particle.velocity.x).toBeCloseTo(100, 5);
    expect(particle.velocity.y).toBeCloseTo(0, 5);
    expect(particle.rotation).toBeCloseTo(0, 5);

    emitter.update(1);

    expect(particle.x).toBeCloseTo(100, 5);
    expect(particle.y).toBeCloseTo(25, 5);
    expect(particle.velocity.x).toBeCloseTo(100, 5);
    expect(particle.velocity.y).toBeCloseTo(50, 5);
    expect(particle.rotation).toBeCloseTo(Math.atan2(50, 100), 5);
  });

  it("supports radial velocity and maxSpeed clamping", () => {
    const emitter = new Emitter(new Container(), {
      texture: null,
      lifetime: { min: 2, max: 2 },
      frequency: 1,
      particlesPerWave: 1,
      maxParticles: 4,
      emit: false,
      seed: 12345,
      behaviors: [
        {
          type: "movement",
          config: {
            velocity: {
              kind: "radial",
              angle: { min: 0, max: 0 },
              speed: 200,
            },
            acceleration: {
              x: 200,
              y: 0,
            },
            maxSpeed: 150,
          },
        },
      ],
    });

    emitter.spawn(1);
    const particle = firstParticle(emitter);

    expect(particle.velocity.x).toBeCloseTo(200, 5);
    expect(particle.velocity.y).toBeCloseTo(0, 5);

    emitter.update(1);

    expect(Math.hypot(particle.velocity.x, particle.velocity.y)).toBeCloseTo(
      150,
      5,
    );
    expect(particle.x).toBeGreaterThan(149);
    expect(particle.y).toBeCloseTo(0, 5);
  });
});
