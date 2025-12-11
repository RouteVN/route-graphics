/**
 * Spawn shape behaviors for particles.
 * Adapted from @pixi/particle-emitter (MIT License)
 * Original Copyright (c) 2015 CloudKid
 */

/**
 * Rectangle spawn shape - particles spawn randomly within a rectangle.
 */
export class RectangleShape {
  /**
   * @param {Object} data
   * @param {number} data.x - Left edge
   * @param {number} data.y - Top edge
   * @param {number} data.w - Width
   * @param {number} data.h - Height
   */
  constructor(data) {
    this.x = data.x;
    this.y = data.y;
    this.w = data.w;
    this.h = data.h;
  }

  /**
   * Get a random position within the rectangle
   * @param {Object} point - Point to modify {x, y}
   * @param {Object} emitter - Emitter instance for seeded random
   */
  getRandPos(point, emitter) {
    point.x = this.x + emitter.random() * this.w;
    point.y = this.y + emitter.random() * this.h;
  }
}

/**
 * Circle/Torus spawn shape - particles spawn within a ring or circle.
 */
export class TorusShape {
  /**
   * @param {Object} data
   * @param {number} data.x - Center X
   * @param {number} data.y - Center Y
   * @param {number} data.radius - Outer radius
   * @param {number} [data.innerRadius=0] - Inner radius (0 = filled circle)
   * @param {boolean} [data.affectRotation=false] - Set particle rotation to point outward
   */
  constructor(data) {
    this.x = data.x;
    this.y = data.y;
    this.radius = data.radius;
    this.innerRadius = data.innerRadius ?? 0;
    this.affectRotation = data.affectRotation ?? false;
  }

  getRandPos(point, emitter) {
    // Random angle
    const angle = emitter.random() * Math.PI * 2;

    // Random radius between inner and outer
    const radiusRange = this.radius - this.innerRadius;
    const dist = emitter.random() * radiusRange + this.innerRadius;

    point.x = this.x + Math.cos(angle) * dist;
    point.y = this.y + Math.sin(angle) * dist;

    if (this.affectRotation) {
      point.rotation = angle;
    }
  }
}

/**
 * Point spawn - all particles spawn at a single point.
 */
export class PointShape {
  /**
   * @param {Object} data
   * @param {number} data.x - X position
   * @param {number} data.y - Y position
   */
  constructor(data) {
    this.x = data.x;
    this.y = data.y;
  }

  getRandPos(point, emitter) {
    point.x = this.x;
    point.y = this.y;
  }
}

/**
 * Line spawn shape - particles spawn along a line.
 */
export class LineShape {
  /**
   * @param {Object} data
   * @param {number} data.x1 - Start X
   * @param {number} data.y1 - Start Y
   * @param {number} data.x2 - End X
   * @param {number} data.y2 - End Y
   */
  constructor(data) {
    this.x1 = data.x1;
    this.y1 = data.y1;
    this.x2 = data.x2;
    this.y2 = data.y2;
  }

  getRandPos(point, emitter) {
    const t = emitter.random();
    point.x = this.x1 + (this.x2 - this.x1) * t;
    point.y = this.y1 + (this.y2 - this.y1) * t;
  }
}

// Shape registry
const shapes = {
  rect: RectangleShape,
  rectangle: RectangleShape,
  torus: TorusShape,
  circle: TorusShape,
  point: PointShape,
  line: LineShape,
};

/**
 * Register a custom shape
 * @param {string} type - Shape type name
 * @param {Function} ShapeClass - Shape class constructor
 */
export function registerShape(type, ShapeClass) {
  shapes[type] = ShapeClass;
}

/**
 * Spawn shape behavior - positions particles according to a shape.
 *
 * Config example:
 * {
 *   type: 'spawnShape',
 *   config: {
 *     type: 'rect',
 *     data: { x: 0, y: 0, w: 800, h: 50 }
 *   }
 * }
 */
export class SpawnShapeBehavior {
  static type = "spawnShape";

  /**
   * @param {Object} config
   * @param {string} config.type - Shape type
   * @param {Object} config.data - Shape configuration data
   */
  constructor(config) {
    const ShapeClass = shapes[config.type];
    if (!ShapeClass) {
      throw new Error(`Unknown spawn shape type: ${config.type}`);
    }
    this.shape = new ShapeClass(config.data);
  }

  initParticles(first) {
    let particle = first;
    const point = { x: 0, y: 0, rotation: undefined };

    while (particle) {
      this.shape.getRandPos(point, particle.emitter);
      particle.x = point.x;
      particle.y = point.y;
      if (point.rotation !== undefined) {
        particle.rotation = point.rotation;
      }
      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    // Spawn shapes don't update
  }
}

/**
 * Burst spawn - spawns at a point with optional direction spread.
 *
 * Config example:
 * {
 *   type: 'spawnBurst',
 *   config: {
 *     x: 400,
 *     y: 300,
 *     spacing: 30,  // Degrees between particles
 *     startAngle: 0
 *   }
 * }
 */
export class BurstSpawnBehavior {
  static type = "spawnBurst";

  /**
   * @param {Object} config
   * @param {number} config.x - Spawn X position
   * @param {number} config.y - Spawn Y position
   * @param {number} [config.spacing=0] - Degrees between particles
   * @param {number} [config.startAngle=0] - Starting angle in degrees
   */
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.spacing = ((config.spacing ?? 0) * Math.PI) / 180;
    this.startAngle = ((config.startAngle ?? 0) * Math.PI) / 180;
  }

  initParticles(first) {
    let particle = first;
    let angle = this.startAngle;

    while (particle) {
      particle.x = this.x;
      particle.y = this.y;
      particle.rotation = angle;
      angle += this.spacing;
      particle = particle.next;
    }
  }

  updateParticle(particle, deltaSec) {
    // Burst spawn doesn't update
  }
}
