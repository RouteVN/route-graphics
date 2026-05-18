# Particles Plugin

Renders particle-based visual effects such as snow, rain, fire, sparks, and bursts.

For a field-by-field reference of every supported module shape and variant, see [SCHEMA.md](./SCHEMA.md).

## Quick Start

```yaml
- type: particles
  id: snow-effect
  width: 1280
  height: 720
  seed: 12345

  modules:
    emission:
      mode: continuous
      rate: 40
      maxActive: 180
      duration: infinite
      particleLifetime:
        min: 4
        max: 8
      source:
        kind: rect
        data:
          x: 0
          y: -20
          width: 1280
          height: 10

    movement:
      velocity:
        kind: directional
        direction: 90
        speed:
          min: 50
          max: 150

    appearance:
      texture: snowflake
      scale:
        mode: range
        min: 0.3
        max: 1
      alpha:
        mode: curve
        keys:
          - { time: 0, value: 0 }
          - { time: 0.1, value: 0.8 }
          - { time: 0.8, value: 0.8 }
          - { time: 1, value: 0 }
      rotation:
        mode: spin
        start: { min: 0, max: 360 }
        speed: { min: -45, max: 45 }

    bounds:
      mode: recycle
      source: area
      padding: 50
```

See `examples/` for complete snow, rain, fire, and burst setups.

---

## Top-Level Properties

| Property          | Type   | Required | Description                        |
| ----------------- | ------ | -------- | ---------------------------------- |
| `type`            | string | Yes      | Must be `"particles"`              |
| `id`              | string | Yes      | Unique identifier                  |
| `width`, `height` | number | Yes      | Effect area dimensions             |
| `modules`         | object | Yes      | Structured particle modules        |
| `x`, `y`          | number | No       | Container position. Default: `0`   |
| `alpha`           | number | No       | Effect opacity from `0` to `1`     |
| `seed`            | number | No       | Deterministic randomness for tests |

---

## Modules

### `modules.emission`

Controls when particles are created, how many can exist, how long they live, and where they spawn.

```yaml
emission:
  mode: continuous # continuous | burst
  rate: 40 # particles/sec, for continuous
  burstCount: 30 # required for burst
  maxActive: 180
  duration: infinite # or seconds
  particleLifetime:
    min: 4
    max: 8
  source:
    kind: rect # point | rect | circle | line
    data:
      x: 0
      y: -20
      width: 1280
      height: 10
```

### `modules.movement`

Controls the initial velocity and any ongoing forces.

```yaml
movement:
  velocity:
    kind: directional # directional | radial
    direction: 90
    speed:
      min: 50
      max: 150
  acceleration:
    x: 0
    y: 10
  maxSpeed: 200
  faceVelocity: false
```

### `modules.appearance`

Controls texture, size, opacity, tint, and rotation.

```yaml
appearance:
  texture:
    mode: random # single | random | cycle
    pick: perParticle # perParticle | perWave
    items:
      - src: spark-a
        weight: 3
      - src: spark-b
        weight: 1
  scale:
    mode: range # single | range | curve
    min: 0.3
    max: 1
  alpha:
    mode: curve # single | curve
    keys:
      - { time: 0, value: 0 }
      - { time: 0.2, value: 1 }
      - { time: 1, value: 0 }
  color:
    mode: single # single | gradient
    value: "#ffffff"
  rotation:
    mode: spin # none | fixed | random | spin
    start: { min: 0, max: 360 }
    speed: { min: -45, max: 45 }
```

`texture` also accepts a single texture directly:

```yaml
appearance:
  texture: snowflake
```

Inline shapes are supported anywhere a texture item is accepted:

```yaml
appearance:
  texture:
    mode: single
    items:
      - shape: circle
        radius: 4
        color: "#ffffff"
```

### `modules.bounds`

Controls what happens when particles leave the allowed region.

```yaml
bounds:
  mode: recycle # none | recycle
  source: area # area | custom
  padding: 50
```

Custom bounds:

```yaml
bounds:
  mode: recycle
  source: custom
  custom:
    x: -100
    y: -100
    width: 1480
    height: 920
```

---

## Sampling And Distributions

Numeric randomized values can include a `distribution` block:

```yaml
scale:
  mode: range
  min: 0.3
  max: 1
  distribution:
    kind: normal
    mean: 0.55
    deviation: 0.1
```

Supported distribution kinds:

| Kind      | Use case                              |
| --------- | ------------------------------------- |
| `uniform` | Even spread between `min` and `max`   |
| `normal`  | Cluster around a typical value        |
| `bias`    | Bias toward `min`, `max`, or `center` |

---

## Textures

### Built-In

| Name        | Description               |
| ----------- | ------------------------- |
| `circle`    | White circle, radius 4    |
| `snowflake` | White circle, radius 3    |
| `raindrop`  | Light blue rectangle, 1x8 |

### Asset Texture

```yaml
appearance:
  texture: my-particle-image
```

### Inline Shape Texture

```yaml
appearance:
  texture:
    mode: single
    items:
      - shape: rect
        width: 4
        height: 12
        color: "#7ec8ff"
```

---

## Notes

- The public particle API is the structured `modules` model.
- Internally, Route Graphics still compiles modules into the existing emitter and behavior runtime.
- Use separate `particles` elements when two particle families need different emission, movement, or bounds settings.
