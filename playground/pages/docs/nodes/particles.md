---
template: docs-documentation
title: Particles Node
tags: documentation
sidebarId: node-particles
---

`particles` renders a particle emitter with configurable textures, behaviors, and emission rules.

Try it in the [Playground](/playground/?template=particles-demo).

## Used In

- `elements[]`

## Field Reference

| Field       | Type             | Required | Default | Notes                                                 |
| ----------- | ---------------- | -------- | ------- | ----------------------------------------------------- |
| `id`        | string           | Yes      | -       | Element id.                                           |
| `type`      | string           | Yes      | -       | Must be `particles`.                                  |
| `width`     | number           | Yes      | -       | Effect area width.                                    |
| `height`    | number           | Yes      | -       | Effect area height.                                   |
| `texture`   | string \| object | Yes      | -       | Built-in texture name, alias, or custom shape object. |
| `behaviors` | array            | Yes      | -       | Non-empty behavior list.                              |
| `emitter`   | object           | Yes      | -       | Emission settings.                                    |
| `x`         | number           | No       | `0`     | Container x.                                          |
| `y`         | number           | No       | `0`     | Container y.                                          |
| `alpha`     | number           | No       | `1`     | Container alpha.                                      |
| `count`     | number           | No       | `100`   | Fallback max particle count.                          |

### Custom texture object

| Field    | Type                            | Required | Default        |
| -------- | ------------------------------- | -------- | -------------- |
| `shape`  | `circle` \| `ellipse` \| `rect` | Yes      | -              |
| `radius` | number                          | No       | `3`            |
| `width`  | number                          | No       | shape-specific |
| `height` | number                          | No       | shape-specific |
| `color`  | string                          | No       | `#ffffff`      |

### `emitter`

| Field              | Type    | Required | Default      | Notes                                     |
| ------------------ | ------- | -------- | ------------ | ----------------------------------------- |
| `lifetime.min`     | number  | Yes      | -            | Particle lifespan minimum (seconds).      |
| `lifetime.max`     | number  | Yes      | -            | Particle lifespan maximum (seconds).      |
| `frequency`        | number  | Yes      | -            | Seconds between waves (`0` for burst).    |
| `particlesPerWave` | number  | Yes      | -            | Spawn count per wave.                     |
| `maxParticles`     | number  | No       | from `count` | Hard cap.                                 |
| `emitterLifetime`  | number  | No       | `-1`         | `-1` means infinite.                      |
| `spawnBounds`      | object  | No       | -            | Recycling bounds.                         |
| `recycleOnBounds`  | boolean | No       | `false`      | Enables weather-like recycling.           |
| `seed`             | number  | No       | -            | Deterministic randomness (useful for VT). |

## Behavior Notes

- Built-in behavior implementations include `alpha`, `scale`, `speed`, `acceleration`, `rotation`, `color`, and spawn-shape/burst variants.
- Unknown texture names are attempted as external textures.
- No element-level interaction events are emitted by particles.

## Example: Minimal Burst

```yaml
elements:
  - id: burst
    type: particles
    x: 640
    y: 360
    width: 1
    height: 1
    texture: circle
    behaviors:
      - type: alpha
        config:
          alpha:
            list:
              - { value: 1, time: 0 }
              - { value: 0, time: 1 }
    emitter:
      lifetime: { min: 0.2, max: 0.5 }
      frequency: 0
      particlesPerWave: 20
      maxParticles: 20
```

## Example: Full-Screen Sparkle

```yaml
elements:
  - id: sparkles
    type: particles
    x: 0
    y: 0
    width: 1280
    height: 720
    texture:
      shape: circle
      radius: 2
      color: "#ffffff"
    behaviors:
      - type: speed
        config:
          speed:
            list:
              - { value: 20, time: 0 }
              - { value: 5, time: 1 }
      - type: alpha
        config:
          alpha:
            list:
              - { value: 0.8, time: 0 }
              - { value: 0, time: 1 }
    emitter:
      lifetime: { min: 0.6, max: 1.2 }
      frequency: 0.02
      particlesPerWave: 3
      maxParticles: 160
      seed: 42
```

## Example: Rain With Recycling

```yaml
elements:
  - id: rain
    type: particles
    width: 1280
    height: 720
    texture: raindrop
    behaviors:
      - type: acceleration
        config:
          accel:
            x: 0
            y: 600
    emitter:
      lifetime: { min: 1.2, max: 2.2 }
      frequency: 0.01
      particlesPerWave: 4
      maxParticles: 500
      recycleOnBounds: true
      spawnBounds:
        x: -20
        y: -20
        width: 1320
        height: 780
```
