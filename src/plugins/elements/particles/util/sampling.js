/**
 * Shared particle sampling helpers.
 */

/**
 * Clamp a value into a range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sample a numeric range using an optional distribution.
 * Accepts either a fixed number or { min, max, distribution }.
 *
 * @param {() => number} random
 * @param {number | { min: number, max?: number, distribution?: Object }} config
 * @returns {number}
 */
export function sampleRange(random, config) {
  if (typeof config === "number") return config;

  const min = config.min;
  const max = config.max ?? config.min;
  if (min === max) return min;

  const distribution = config.distribution;
  if (!distribution || distribution.kind === "uniform") {
    return min + random() * (max - min);
  }

  if (distribution.kind === "bias") {
    return min + sampleBias(random, distribution) * (max - min);
  }

  if (distribution.kind === "normal") {
    return sampleNormal(random, min, max, distribution);
  }

  return min + random() * (max - min);
}

/**
 * Biased sampling in normalized space [0, 1].
 * @param {() => number} random
 * @param {Object} distribution
 * @returns {number}
 */
function sampleBias(random, distribution) {
  const toward = distribution.toward ?? "min";
  const strength = clamp(distribution.strength ?? 0.5, 0, 1);
  const exponent = 1 + strength * 4;

  if (toward === "max") {
    return 1 - Math.pow(1 - random(), exponent);
  }

  if (toward === "center") {
    const centered = (random() + random()) / 2;
    return random() * (1 - strength) + centered * strength;
  }

  return Math.pow(random(), exponent);
}

/**
 * Approximate normal distribution with Box-Muller and clamp to the range.
 * Mean and deviation are expressed in the same units as min/max.
 *
 * @param {() => number} random
 * @param {number} min
 * @param {number} max
 * @param {Object} distribution
 * @returns {number}
 */
function sampleNormal(random, min, max, distribution) {
  const mean = distribution.mean ?? (min + max) / 2;
  const deviation = distribution.deviation ?? (max - min) / 6;

  const u1 = Math.max(random(), 1e-7);
  const u2 = random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  return clamp(mean + gaussian * deviation, min, max);
}
