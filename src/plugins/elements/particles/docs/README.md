# Particles Plugin

Renders particle-based visual effects: snow, rain, fire, sparkles, etc.

## Quick Start

```yaml
- type: particles
  id: snow-effect
  width: 1280
  height: 720
  texture: snowflake
  behaviors:
    - type: spawnShape
      config:
        type: rect
        data: { x: 0, y: -20, w: 1280, h: 10 }
    - type: movePoint
      config:
        speed: { min: 50, max: 150 }
        direction: 90
    - type: scaleStatic
      config: { min: 0.3, max: 1.0 }
    - type: alpha
      config:
        list:
          - { value: 0, time: 0 }
          - { value: 0.8, time: 0.1 }
          - { value: 0.8, time: 0.8 }
          - { value: 0, time: 1 }
    - type: rotation
      config:
        minStart: 0
        maxStart: 360
        minSpeed: -45
        maxSpeed: 45
  emitter:
    lifetime: { min: 4, max: 8 }
    frequency: 0.05
    particlesPerWave: 2
    maxParticles: 100
```

See `examples/` directory for more complete effect examples (snow, rain, fire, burst).

---

## Properties

| Property          | Type             | Required | Description                                  |
| ----------------- | ---------------- | -------- | -------------------------------------------- |
| `type`            | string           | Yes      | Must be `"particles"`                        |
| `id`              | string           | Yes      | Unique identifier                            |
| `width`, `height` | number           | Yes      | Effect area dimensions                       |
| `texture`         | string \| object | Yes      | Particle appearance (string or shape config) |
| `behaviors`       | array            | Yes      | How particles behave (non-empty array)       |
| `emitter`         | object           | Yes      | Spawning settings                            |
| `x`, `y`          | number           | No       | Container position. Default: 0               |
| `alpha`           | number           | No       | Container opacity (0-1). Default: 1          |

---

## Textures

### Built-in

| Name        | Description               |
| ----------- | ------------------------- |
| `circle`    | White circle, radius 4    |
| `snowflake` | White circle, radius 3    |
| `raindrop`  | Light blue rectangle, 1x8 |

### Custom Shape

```yaml
texture:
  shape: circle # circle, ellipse, or rect
  radius: 5 # For circle
  width: 4 # For ellipse/rect
  height: 4 # For ellipse/rect
  color: "#ffffff"
```

### Asset Texture

```yaml
texture: my-particle-image # Loaded via Assets.load()
```

---

## Behaviors

Control how particles change over time.

### Available Behaviors

| Type             | Description                        |
| ---------------- | ---------------------------------- |
| `alpha`          | Fade over lifetime (keyframe list) |
| `alphaStatic`    | Fixed opacity                      |
| `scale`          | Size over lifetime (keyframe list) |
| `scaleStatic`    | Random fixed size                  |
| `movePoint`      | Move in a direction                |
| `speed`          | Movement with acceleration         |
| `speedStatic`    | Fixed speed (for burst)            |
| `acceleration`   | Apply forces (gravity, wind)       |
| `gravity`        | Apply downward gravity force       |
| `rotation`       | Spin over time                     |
| `rotationStatic` | Random fixed rotation              |
| `noRotation`     | No rotation                        |
| `color`          | Tint over lifetime (keyframe list) |
| `colorStatic`    | Fixed tint                         |
| `spawnShape`     | Where particles spawn              |
| `spawnBurst`     | Radial burst spawn pattern         |

### Keyframe List Format

For `alpha`, `scale`, `color`:

- `time`: 0 = birth, 1 = death (normalized)
- `value`: property value at that time

```yaml
- type: alpha
  config:
    list:
      - { value: 0, time: 0 } # Invisible at birth
      - { value: 1, time: 0.2 } # Fade in
      - { value: 1, time: 0.8 } # Stay visible
      - { value: 0, time: 1 } # Fade out at death
```

### Movement

```yaml
- type: movePoint
  config:
    speed: { min: 50, max: 150 }
    direction: 90 # Degrees: 0=right, 90=down, -90=up
```

### Spawn Shape

```yaml
# Rectangle area
- type: spawnShape
  config:
    type: rect
    data: { x: 0, y: -10, w: 1280, h: 10 }

# Circle area
- type: spawnShape
  config:
    type: circle
    data: { x: 640, y: 360, radius: 50 }

# Single point
- type: spawnShape
  config:
    type: point
    data: { x: 640, y: 360 }
```

### Burst Spawn

For radial burst effects:

```yaml
- type: spawnBurst
  config:
    x: 640 # Center X
    y: 360 # Center Y
    spacing: 30 # Degrees between particles
    startAngle: 0 # Starting angle in degrees
```

---

## Emitter Settings

| Property           | Type           | Description                           | Default |
| ------------------ | -------------- | ------------------------------------- | ------- |
| `lifetime`         | `{ min, max }` | Particle lifespan in seconds          | *       |
| `frequency`        | number         | Seconds between spawns (0 = burst)    | *       |
| `particlesPerWave` | number         | Particles per spawn                   | *       |
| `maxParticles`     | number         | Maximum active particles              | 100     |
| `emitterLifetime`  | number         | How long emitter runs (-1 = infinite) | -1      |
| `seed`             | number         | For deterministic randomness          | null    |

\* Required fields with no defaults - must be specified in your configuration.

```yaml
emitter:
  lifetime: { min: 2, max: 4 }
  frequency: 0.05
  particlesPerWave: 2
  maxParticles: 300
```

---

## Top-Level vs Behavior Properties

Some properties exist at both levels with different effects:

| Top-Level | Behavior     | Top-Level Effect      | Behavior Effect     |
| --------- | ------------ | --------------------- | ------------------- |
| `alpha`   | `alpha`      | Entire effect opacity | Per-particle fade   |
| `x`, `y`  | `spawnShape` | Container position    | Spawn area position |

Example using both:

```yaml
- type: particles
  id: faded-snow
  width: 1280
  height: 720
  texture: snowflake
  alpha: 0.5 # Whole effect at 50%
  behaviors:
    - type: spawnShape
      config: { type: rect, data: { x: 0, y: -20, w: 1280, h: 10 } }
    - type: movePoint
      config: { speed: { min: 50, max: 150 }, direction: 90 }
    - type: alpha # Each particle also fades
      config:
        list:
          - { value: 0, time: 0 }
          - { value: 1, time: 0.2 }
          - { value: 0, time: 1 }
  emitter:
    lifetime: { min: 4, max: 8 }
    frequency: 0.05
    particlesPerWave: 2
    maxParticles: 100
```
