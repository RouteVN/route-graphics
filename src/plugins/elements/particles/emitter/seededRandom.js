/**
 * Seeded Pseudo-Random Number Generator
 * Uses a simple mulberry32 algorithm for deterministic randomness.
 * This enables reproducible particle effects for visual testing.
 */

export class SeededRandom {
  /**
   * Create a new seeded RNG
   * @param {number} seed - Initial seed value
   */
  constructor(seed) {
    this.seed = seed;
    this.state = seed;
  }

  /**
   * Generate the next random number between 0 and 1
   * Uses mulberry32 algorithm - fast and has good distribution
   * @returns {number} Random value in [0, 1)
   */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Reset the RNG to its initial seed
   */
  reset() {
    this.state = this.seed;
  }
}
