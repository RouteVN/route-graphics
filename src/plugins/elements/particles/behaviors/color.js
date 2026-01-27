/**
 * Color behaviors for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

import { PropertyList, parseColor } from "../emitter/propertyList.js";

/**
 * Applies interpolated color (tint) values over particle lifetime.
 *
 * Config example:
 * {
 *   type: 'color',
 *   config: {
 *     list: [
 *       { value: '#ffffff', time: 0 },
 *       { value: '#ff0000', time: 0.5 },
 *       { value: '#000000', time: 1 }
 *     ]
 *   }
 * }
 */
export class ColorBehavior {
  static type = "color";

  /**
   * @param {Object} config
   * @param {Array<{value: string, time: number}>} config.list - Color keyframes
   */
  constructor(config) {
    this.list = new PropertyList(true); // true = isColor
    this.list.reset(config.list);
  }

  initParticles(first) {
    let particle = first;
    const startColor = this.list.getValue(0);
    while (particle) {
      particle.tint = startColor;
      particle = particle.next;
    }
  }

  updateParticle(particle, _deltaSec) {
    particle.tint = this.list.getValue(particle.agePercent);
  }
}

/**
 * Applies a static color at initialization.
 *
 * Config example:
 * {
 *   type: 'colorStatic',
 *   config: { color: '#88ccff' }
 * }
 */
export class StaticColorBehavior {
  static type = "colorStatic";

  /**
   * @param {Object} config
   * @param {string|number} config.color - Color value
   */
  constructor(config) {
    this.color = parseColor(config.color);
  }

  initParticles(first) {
    let particle = first;
    while (particle) {
      particle.tint = this.color;
      particle = particle.next;
    }
  }

  updateParticle(_particle, _deltaSec) {
    // Static - no update
  }
}
