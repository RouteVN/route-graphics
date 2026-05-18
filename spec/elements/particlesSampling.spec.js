import { describe, expect, it } from "vitest";

import { sampleRange } from "../../src/plugins/elements/particles/util/sampling.js";

describe("particle sampling", () => {
  it("returns fixed numbers unchanged", () => {
    expect(sampleRange(() => 0.99, 12)).toBe(12);
  });

  it("samples bias distributions toward the requested side", () => {
    const values = [0.25, 0.25, 0.25, 0.25];
    let index = 0;
    const random = () => values[index++ % values.length];

    const towardMin = sampleRange(random, {
      min: 0,
      max: 100,
      distribution: { kind: "bias", toward: "min", strength: 1 },
    });

    index = 0;
    const towardMax = sampleRange(random, {
      min: 0,
      max: 100,
      distribution: { kind: "bias", toward: "max", strength: 1 },
    });

    expect(towardMin).toBeLessThan(25);
    expect(towardMax).toBeGreaterThan(25);
  });

  it("clamps normal distributions to the provided range", () => {
    const values = [1e-7, 0];
    let index = 0;
    const random = () => values[index++ % values.length];

    const sampled = sampleRange(random, {
      min: 10,
      max: 20,
      distribution: { kind: "normal", mean: 1000, deviation: 500 },
    });

    expect(sampled).toBe(20);
  });
});
