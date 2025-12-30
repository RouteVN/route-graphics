# Particles Plugin - Internals

Implementation details for developers who want to understand or extend the particle system.

## Attribution

The core emitter code is adapted from [@pixi/particle-emitter](https://github.com/pixijs-userland/particle-emitter) (MIT License, Copyright (c) 2015 CloudKid).

**What was borrowed:**

- `emitter/emitter.js` - Particle spawning, pooling, and lifecycle management
- `emitter/particle.js` - Particle class structure (extends Sprite)
- `emitter/propertyList.js` - Value interpolation system
- `behaviors/*.js` - Behavior patterns and interfaces

**What was changed:**

- Simplified API for route-graphics integration
- Converted from TypeScript to JavaScript
- Added seeded RNG for visual testing
- Added registry system for extensibility
- Removed features not needed for visual novels (emitter path animation, blend modes, orderer system)

Note: No PixiJS v8-specific changes were needed. The Sprite-based approach from the original library still works in v8.

See `docs/LICENSE` for the full license text.

## Architecture Overview

```
particles/
├── index.js              # Plugin entry point, re-exports public API
├── addParticles.js       # Creates particle elements
├── updateParticles.js    # Updates particle elements
├── deleteParticles.js    # Removes particle elements
├── parseParticles.js     # Parses YAML config to internal format
├── registries.js         # Texture/behavior registries
│
├── emitter/              # Core particle engine
│   ├── emitter.js        # Emitter class - spawns and manages particles
│   ├── particle.js       # Particle class - extends PixiJS Sprite
│   ├── propertyList.js   # Value interpolation over time
│   └── seededRandom.js   # Deterministic RNG for visual testing
│
├── behaviors/            # Particle behaviors
│   ├── alpha.js          # Opacity changes
│   ├── scale.js          # Size changes
│   ├── speed.js          # Movement
│   ├── acceleration.js   # Physics forces
│   ├── rotation.js       # Spinning
│   ├── color.js          # Tint changes
│   └── spawnShape.js     # Spawn positioning
│
└── textures/             # Built-in texture generators
    ├── circle.js
    ├── snowflake.js
    └── raindrop.js
```

---

## Core Classes

### Emitter (`emitter/emitter.js`)

The main controller that spawns, updates, and recycles particles.

```
┌─────────────────────────────────────────────────────────┐
│                      Emitter                            │
│                                                         │
│  Config:                                                │
│  - lifetime { min, max }    Particle lifespan           │
│  - frequency                Spawn interval              │
│  - particlesPerWave         Particles per spawn         │
│  - maxParticles             Pool size limit             │
│  - emitterLifetime          How long emitter runs       │
│                                                         │
│  State:                                                 │
│  - _activeFirst → particle → particle → _activeLast     │
│  - _poolFirst → recycled particles (for reuse)          │
│                                                         │
│  Behaviors:                                             │
│  - initBehaviors[]          Run once on spawn           │
│  - updateBehaviors[]        Run every frame             │
│  - recycleBehaviors[]       Run when particle dies      │
└─────────────────────────────────────────────────────────┘
```

**Key methods:**

- `spawn(count)` - Create particles from pool or new
- `update(deltaSec)` - Age particles, run behaviors, recycle dead ones
- `recycle(particle)` - Return particle to pool
- `random()` - Get random number (seeded or Math.random)

**Linked list design:** Particles are stored in a doubly-linked list for O(1) insertion/removal. Each particle has `next` and `prev` pointers.

### Particle (`emitter/particle.js`)

Extends PixiJS `Sprite` with lifecycle properties.

```javascript
class Particle extends Sprite {
  emitter       // Reference to parent Emitter
  maxLife       // Lifetime in seconds
  age           // Current age in seconds
  oneOverLife   // Pre-calculated 1/maxLife
  agePercent    // Computed: age * oneOverLife (0 to 1)
  velocity      // { x, y } for movement behaviors
  rotationSpeed // Radians per second
  config        // {} for behaviors to store per-particle data
  next, prev    // Linked list pointers
}
```

**Why Sprite?** This implementation is adapted from `@pixi/particle-emitter` which used Sprites. PixiJS v8 has a native `ParticleContainer` + `Particle` that's faster (1M particles vs 200K), but the Sprite approach is sufficient for visual novel use cases (~100-500 particles).

### PropertyList (`emitter/propertyList.js`)

Interpolates values over a particle's normalized lifetime (0 to 1).

```javascript
// Config format
{
  list: [
    { value: 0, time: 0 },     // invisible at birth
    { value: 0.8, time: 0.1 }, // fade in
    { value: 0.8, time: 0.8 }, // stay visible
    { value: 0, time: 1 },     // fade out at death
  ]
}

// Usage in behavior
updateParticle(particle) {
  particle.alpha = this.list.getValue(particle.agePercent);
}
```

**Structure:** Linked list of `PropertyNode` objects, sorted by time. `getValue(t)` finds the correct segment and interpolates.

**Utility functions:**

- `lerp(start, end, t)` - Linear interpolation for numbers
- `lerpColor(start, end, t)` - RGB component interpolation
- `parseColor(color)` - Hex string to integer

### SeededRandom (`emitter/seededRandom.js`)

Deterministic pseudo-random number generator using mulberry32 algorithm.

```javascript
const rng = new SeededRandom(12345);
rng.next(); // Always returns same sequence for same seed
rng.reset(); // Restart sequence
```

**Purpose:** Enables reproducible particle effects for visual testing. Same seed = same particle positions/sizes/lifetimes.

---

## Behavior System

Behaviors modify particles at different lifecycle stages.

### Behavior Interface

```javascript
class MyBehavior {
  static type = "myBehavior"; // Registry key

  constructor(config) {
    // Parse config, set up PropertyLists, etc.
  }

  // Called once when particle spawns (optional)
  initParticles(first) {
    let p = first;
    while (p) {
      // Initialize particle properties
      p = p.next;
    }
  }

  // Called every frame (optional)
  updateParticle(particle, deltaSec) {
    // Modify particle properties based on age, time, etc.
  }

  // Called when particle dies (optional)
  recycleParticle(particle) {
    // Clean up per-particle state
  }
}
```

### Built-in Behaviors

| Behavior         | Init | Update | Description                 |
| ---------------- | ---- | ------ | --------------------------- |
| `alpha`          | -    | Yes    | Fade via PropertyList       |
| `alphaStatic`    | Yes  | -      | Random fixed alpha          |
| `scale`          | -    | Yes    | Size via PropertyList       |
| `scaleStatic`    | Yes  | -      | Random fixed scale          |
| `color`          | -    | Yes    | Tint via PropertyList       |
| `colorStatic`    | Yes  | -      | Fixed tint                  |
| `movePoint`      | Yes  | Yes    | Direction + speed           |
| `speed`          | Yes  | Yes    | Speed with acceleration     |
| `speedStatic`    | Yes  | -      | Fixed outward speed         |
| `acceleration`   | Yes  | Yes    | Apply forces (gravity)      |
| `gravity`        | -    | Yes    | Simple gravity force        |
| `rotation`       | Yes  | Yes    | Spin with acceleration      |
| `rotationStatic` | Yes  | -      | Random fixed rotation       |
| `noRotation`     | Yes  | -      | Fixed angle, no spin        |
| `spawnShape`     | Yes  | -      | Position particles in shape |
| `spawnBurst`     | Yes  | -      | Radial burst positioning    |

### Adding a Custom Behavior

```javascript
import { registerParticleBehavior } from "route-graphics";

class WindBehavior {
  static type = "wind";

  constructor(config) {
    this.strength = config.strength || 50;
    this.frequency = config.frequency || 2;
  }

  initParticles(first) {
    let p = first;
    while (p) {
      // Store per-particle phase offset
      p.config.windPhase = p.emitter.random() * Math.PI * 2;
      p = p.next;
    }
  }

  updateParticle(particle, deltaSec) {
    const offset = Math.sin(
      particle.age * this.frequency + particle.config.windPhase,
    );
    particle.x += offset * this.strength * deltaSec;
  }
}

registerParticleBehavior(WindBehavior);
```

---

## Registry System (`registries.js`)

Two registries store extensible components:

```javascript
const textureRegistry = new Map(); // name → Texture or generator function
const behaviorRegistry = new Map(); // type → Behavior class
```

### Texture Registry

Textures can be:

1. **Pre-made Texture** - A PixiJS Texture object
2. **Generator function** - Called with app, returns Texture

```javascript
// Pre-made texture
registerParticleTexture("star", starTexture);

// Generator function (receives app for renderer access)
registerParticleTexture("star", (app) => {
  const g = new Graphics();
  g.star(0, 0, 5, 8, 4);
  g.fill({ color: 0xffffff });
  return app.renderer.generateTexture(g);
});
```

### Behavior Registry

Behaviors are registered by their class:

```javascript
import { registerParticleBehavior } from "route-graphics";

registerParticleBehavior(MyCustomBehavior);
// Uses MyCustomBehavior.type as the registry key
```

---

## Data Flow

```
YAML Element Config
        │
        ▼
┌───────────────────┐
│  parseParticles   │ → Validates required fields
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   addParticles    │ → Creates Container + Emitter
└───────────────────┘
        │
        ▼
┌───────────────────┐
│     Emitter       │ → Spawns particles, runs behaviors
└───────────────────┘
        │
        ▼
┌───────────────────┐
│    Particles      │ → Rendered as Sprites in Container
└───────────────────┘
```

---

## Performance Notes

### Object Pooling

Dead particles are recycled, not destroyed:

1. Particle dies (age >= maxLife)
2. Removed from active list
3. Added to pool list
4. Reused on next spawn

This avoids GC pressure from constant object creation.

---

## Visual Testing

The `seed` emitter option enables deterministic behavior:

```yaml
emitter:
  seed: 12345 # Same seed = same particle positions
```

This is used by the visual testing system to generate reproducible screenshots.
