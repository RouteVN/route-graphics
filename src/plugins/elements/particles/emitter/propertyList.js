/**
 * PropertyList - Manages interpolated values over time.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

/**
 * Linear interpolation between two values
 * @param {number} start
 * @param {number} end
 * @param {number} t - 0 to 1
 * @returns {number}
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Parse hex color string to integer
 * @param {string} color - Hex color (#fff, #ffffff, 0xffffff)
 * @returns {number}
 */
export function parseColor(color) {
  if (typeof color === "number") return color;
  // Remove # or 0x prefix
  const hex = color.replace(/^(#|0x)/, "");
  return parseInt(hex, 16);
}

/**
 * Interpolate between two colors
 * @param {number} start - Start color as integer
 * @param {number} end - End color as integer
 * @param {number} t - 0 to 1
 * @returns {number}
 */
export function lerpColor(start, end, t) {
  const startR = (start >> 16) & 0xff;
  const startG = (start >> 8) & 0xff;
  const startB = start & 0xff;

  const endR = (end >> 16) & 0xff;
  const endG = (end >> 8) & 0xff;
  const endB = end & 0xff;

  const r = Math.round(lerp(startR, endR, t));
  const g = Math.round(lerp(startG, endG, t));
  const b = Math.round(lerp(startB, endB, t));

  return (r << 16) | (g << 8) | b;
}

/**
 * A node in the property list
 */
export class PropertyNode {
  /**
   * @param {number|string} value - The value at this node
   * @param {number} time - Time position (0-1)
   * @param {boolean} isColor - Whether this is a color value
   */
  constructor(value, time, isColor = false) {
    this.value = isColor ? parseColor(value) : value;
    this.time = time;
    this.next = null;
  }

  /**
   * Create a PropertyNode list from config
   * @param {Array<{value: number|string, time: number}>} list
   * @param {boolean} isColor
   * @returns {PropertyNode}
   */
  static createList(list, isColor = false) {
    const sorted = [...list].sort((a, b) => a.time - b.time);
    const first = new PropertyNode(sorted[0].value, sorted[0].time, isColor);

    let current = first;
    for (let i = 1; i < sorted.length; i++) {
      current.next = new PropertyNode(sorted[i].value, sorted[i].time, isColor);
      current = current.next;
    }

    return first;
  }
}

/**
 * Manages a list of values that can be interpolated over a particle's lifetime
 */
export class PropertyList {
  /**
   * @param {boolean} isColor - Whether values are colors
   */
  constructor(isColor = false) {
    this.first = null;
    this.isColor = isColor;
    this.ease = null;
  }

  /**
   * Reset with new list data
   * @param {PropertyNode|Array<{value: number|string, time: number}>} data
   */
  reset(data) {
    if (Array.isArray(data)) {
      this.first = PropertyNode.createList(data, this.isColor);
    } else {
      this.first = data;
    }
  }

  /**
   * Get interpolated value at time t
   * @param {number} t - Time position (0-1)
   * @returns {number}
   */
  getValue(t) {
    // Apply easing if set
    if (this.ease) {
      t = this.ease(t);
    }

    // Single value or at start
    if (!this.first.next || t <= this.first.time) {
      return this.first.value;
    }

    // Find the correct segment
    let current = this.first;
    while (current.next && current.next.time < t) {
      current = current.next;
    }

    // At or past end
    if (!current.next || t >= current.next.time) {
      return current.next ? current.next.value : current.value;
    }

    // Interpolate within segment
    const segmentT = (t - current.time) / (current.next.time - current.time);

    if (this.isColor) {
      return lerpColor(current.value, current.next.value, segmentT);
    }
    return lerp(current.value, current.next.value, segmentT);
  }
}
