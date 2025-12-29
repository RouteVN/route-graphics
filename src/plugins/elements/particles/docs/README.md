# Particles Plugin

Renders particle-based visual effects: snow, rain, fire, sparkles, etc.

## Quick Start

```yaml
# Simple - use a preset
- type: particles
  id: snow-effect
  preset: snow
  count: 200
  width: 1280
  height: 720

# Custom - define your own
- type: particles
  id: sparkles
  width: 1280
  height: 720
  texture: { shape: circle, radius: 2 }
  behaviors:
    - type: spawnShape
      config: { type: rect, data: { x: 0, y: 0, w: 1280, h: 720 } }
    - type: alpha
      config:
        list:
          - { value: 0, time: 0 }
          - { value: 1, time: 0.5 }
          - { value: 0, time: 1 }
  emitter:
    lifetime: { min: 0.5, max: 1 }
    frequency: 0.05
```

---

## Properties

| Property           | Type             | Required | Description                                      |
| ------------------ | ---------------- | -------- | ------------------------------------------------ |
| `type`             | string           | Yes      | Must be `"particles"`                            |
| `id`               | string           | Yes      | Unique identifier                                |
| `width`, `height`  | number           | Yes      | Effect area dimensions                           |
| `preset`           | string           | No\*     | Built-in preset: `snow`, `rain`, `fire`, `burst` |
| `count`            | number           | No       | Max particles. Default: 100                      |
| `texture`          | string \| object | No       | Particle appearance. Default: `circle`           |
| `behaviors`        | array            | No\*     | How particles behave                             |
| `disableBehaviors` | array            | No       | Preset behaviors to remove                       |
| `emitter`          | object           | No       | Spawning settings (all fields have defaults)     |
| `x`, `y`           | number           | No       | Container position. Default: 0                   |
| `alpha`            | number           | No       | Container opacity (0-1). Default: 1              |
| `emitX`, `emitY`   | number           | No       | Emission point for fire/burst presets            |

\* Either `preset` or `behaviors` must be provided.

---

## Presets

### snow

Falling snowflakes with drift and rotation.

- Texture: `snowflake`
- Behaviors: spawnShape (top edge), movePoint (downward), scaleStatic, alpha, rotation

### rain

Fast falling raindrops.

- Texture: `raindrop`
- Behaviors: spawnShape (top edge), movePoint (down-angled), scaleStatic, alpha, noRotation

### fire

Rising sparks with color gradient.

- Texture: `circle`
- Behaviors: spawnShape (point), acceleration (upward), scale, alpha, color
- Use `emitX`/`emitY` to set fire position

### burst

One-shot outward explosion.

- Texture: `circle`
- Behaviors: spawnShape (circle), speedStatic (outward), scale, alpha
- Use `emitX`/`emitY` to set burst center

See `presets/` folder for YAML documentation of each preset's full configuration.

---

## Customizing Presets

Override any preset default:

```yaml
- type: particles
  id: custom-snow
  preset: snow
  width: 1280
  height: 720
  count: 500 # More particles
  texture: my-custom-flake # Different texture
  disableBehaviors: [rotation] # Remove spinning
  behaviors:
    - type: color # Add color gradient
      config:
        list:
          - { value: "#ffffff", time: 0 }
          - { value: "#aaaaff", time: 1 }
  emitter:
    frequency: 0.02 # Faster spawning
    lifetime: { min: 5, max: 8 } # Longer life
```

### Override Rules

| Action                 | How                           |
| ---------------------- | ----------------------------- |
| Replace behavior       | Add behavior with same `type` |
| Add behavior           | Add behavior with new `type`  |
| Remove behavior        | List in `disableBehaviors`    |
| Change emitter setting | Set in `emitter` object       |
| Change texture         | Set `texture`                 |

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
| `rotation`       | Spin over time                     |
| `rotationStatic` | Random fixed rotation              |
| `noRotation`     | No rotation                        |
| `color`          | Tint over lifetime (keyframe list) |
| `colorStatic`    | Fixed tint                         |
| `spawnShape`     | Where particles spawn              |

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

---

## Emitter Settings

| Property           | Type           | Description                           | Default          |
| ------------------ | -------------- | ------------------------------------- | ---------------- |
| `lifetime`         | `{ min, max }` | Particle lifespan in seconds          | Preset-dependent |
| `frequency`        | number         | Seconds between spawns (0 = burst)    | Preset-dependent |
| `particlesPerWave` | number         | Particles per spawn                   | Preset-dependent |
| `maxParticles`     | number         | Maximum active particles              | 100              |
| `emitterLifetime`  | number         | How long emitter runs (-1 = infinite) | -1               |
| `seed`             | number         | For deterministic randomness          | null             |

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
  preset: snow
  width: 1280
  height: 720
  alpha: 0.5 # Whole effect at 50%
  behaviors:
    - type: alpha # Each particle also fades
      config:
        list:
          - { value: 0, time: 0 }
          - { value: 1, time: 0.2 }
          - { value: 0, time: 1 }
```
