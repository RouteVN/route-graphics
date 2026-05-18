# Particles Schema Reference

Field-by-field reference for the public `particles` authoring model.

This document is about the structured `modules` API, not the older internal `texture + behaviors + emitter` runtime shape.

## Element Shape

```yaml
- type: particles
  id: snow
  x: 0
  y: 0
  width: 1280
  height: 720
  alpha: 1
  seed: 12345

  modules:
    emission: ...
    movement: ...
    appearance: ...
    bounds: ...
```

## Top-Level Fields

| Field     | Type        | Required | Default | Notes                                 |
| --------- | ----------- | -------- | ------- | ------------------------------------- |
| `id`      | string      | Yes      | -       | Element id.                           |
| `type`    | `particles` | Yes      | -       | Must be `particles`.                  |
| `width`   | number      | Yes      | -       | Effect area width. Must be positive.  |
| `height`  | number      | Yes      | -       | Effect area height. Must be positive. |
| `modules` | object      | Yes      | -       | Structured particle configuration.    |
| `x`       | number      | No       | `0`     | Local x position.                     |
| `y`       | number      | No       | `0`     | Local y position.                     |
| `alpha`   | number      | No       | `1`     | Element opacity from `0` to `1`.      |
| `seed`    | number      | No       | unset   | Deterministic randomness.             |

## Top-Level Rules

- `modules` cannot be mixed with legacy `texture`, `behaviors`, `emitter`, or `count`.
- `modules.emission` is required.
- `modules.appearance` is required.
- `modules.movement` is optional.
- `modules.bounds` is optional.

## Shared Shapes

### Scalar Or Range Value

Many numeric fields accept either a single number or a range object.

```yaml
speed: 120
```

```yaml
speed:
  min: 50
  max: 150
```

Range object fields:

| Field          | Type   | Required | Notes                           |
| -------------- | ------ | -------- | ------------------------------- |
| `min`          | number | Yes      | Lower bound.                    |
| `max`          | number | No       | Upper bound. Defaults to `min`. |
| `distribution` | object | No       | Sampling distribution.          |

### Distribution

```yaml
distribution:
  kind: normal
  mean: 90
  deviation: 20
```

Supported kinds:

| Kind      | Fields                 | Notes                                           |
| --------- | ---------------------- | ----------------------------------------------- |
| `uniform` | none                   | Even spread across the range.                   |
| `normal`  | `mean?`, `deviation?`  | Clusters around a typical value.                |
| `bias`    | `toward?`, `strength?` | Pulls samples toward `min`, `max`, or `center`. |

`bias.toward` supports:

- `min`
- `max`
- `center`

### Curve Keys

Curve channels use sorted key arrays:

```yaml
keys:
  - { time: 0, value: 0 }
  - { time: 0.2, value: 1 }
  - { time: 1, value: 0 }
```

Rules:

- `time` must be between `0` and `1`
- keys must be sorted by `time`
- the allowed `value` shape depends on the channel

### Color Value

Color values accept:

- string colors like `"#ffffff"`
- numeric tints like `16777215`

### Texture Shape

Inline textures can be declared with:

```yaml
shape: circle | ellipse | rect
radius: 4 # circle
width: 8 # ellipse or rect
height: 8 # ellipse or rect
color: "#fff" # string or number
```

## `modules.emission`

Controls when particles are created, how many can exist, how long they live, and where they spawn.

### Fields

| Field              | Type                    | Required        | Default                                      | Notes                                                      |
| ------------------ | ----------------------- | --------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `mode`             | `continuous` \| `burst` | Yes             | -                                            | Emission style.                                            |
| `rate`             | number                  | Continuous only | -                                            | Particles per second. Must be positive.                    |
| `burstCount`       | integer                 | Burst only      | -                                            | Number of particles to emit immediately. Must be positive. |
| `maxActive`        | integer                 | No              | `100` for continuous, `burstCount` for burst | Max active particles.                                      |
| `duration`         | number \| `infinite`    | No              | `infinite`                                   | How long the emitter runs.                                 |
| `particleLifetime` | number \| range         | Yes             | -                                            | Lifetime of each particle. Must be non-negative.           |
| `source`           | object                  | Yes             | -                                            | Spawn source definition.                                   |

### `emission.mode`

Continuous emission:

```yaml
emission:
  mode: continuous
  rate: 40
```

Burst emission:

```yaml
emission:
  mode: burst
  burstCount: 24
  duration: 0.1
```

### `emission.source`

Spawn coordinates are in the particle element's local space.

#### `source.kind: point`

```yaml
source:
  kind: point
  data:
    x: 640
    y: 360
```

#### `source.kind: rect`

```yaml
source:
  kind: rect
  data:
    x: 0
    y: -20
    width: 1280
    height: 10
```

#### `source.kind: circle`

```yaml
source:
  kind: circle
  data:
    x: 200
    y: 200
    radius: 24
    innerRadius: 8
    affectRotation: true
```

Circle fields:

| Field            | Type    | Required | Notes                                          |
| ---------------- | ------- | -------- | ---------------------------------------------- |
| `x`              | number  | Yes      | Center x.                                      |
| `y`              | number  | Yes      | Center y.                                      |
| `radius`         | number  | Yes      | Outer radius. Must be positive.                |
| `innerRadius`    | number  | No       | Optional inner cutout from `0` to `radius`.    |
| `affectRotation` | boolean | No       | Initializes rotation from the spawn direction. |

#### `source.kind: line`

```yaml
source:
  kind: line
  data:
    x1: 0
    y1: 0
    x2: 1280
    y2: 0
```

## `modules.movement`

Controls initial velocity and ongoing forces.

If `movement` is present, it must define at least one of:

- `velocity`
- `acceleration`

### Fields

| Field          | Type    | Required | Default | Notes                                          |
| -------------- | ------- | -------- | ------- | ---------------------------------------------- |
| `velocity`     | object  | No       | unset   | Initial velocity model.                        |
| `acceleration` | object  | No       | unset   | Constant acceleration vector.                  |
| `maxSpeed`     | number  | No       | `0`     | Speed clamp. `0` means no clamp.               |
| `faceVelocity` | boolean | No       | `false` | Rotate the particle to match travel direction. |

### `movement.velocity`

| Field       | Type                      | Required         | Notes                                                                                           |
| ----------- | ------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `kind`      | `directional` \| `radial` | Yes              | Velocity model.                                                                                 |
| `speed`     | number \| range           | Yes              | Initial speed. Must be non-negative.                                                            |
| `direction` | number \| range           | Directional only | Degrees. Signed values are allowed.                                                             |
| `angle`     | number \| range           | Radial only      | Limits the radial angle range. Signed values are allowed. Defaults internally to full `0..360`. |

Directional example:

```yaml
movement:
  velocity:
    kind: directional
    direction: 90
    speed:
      min: 50
      max: 150
```

Radial example:

```yaml
movement:
  velocity:
    kind: radial
    angle:
      min: -30
      max: 30
    speed:
      min: 200
      max: 400
```

Acceleration-only example:

```yaml
movement:
  acceleration:
    x: 0
    y: -200
```

### `movement.acceleration`

```yaml
acceleration:
  x: 0
  y: -200
```

Fields:

| Field | Type   | Required | Notes                    |
| ----- | ------ | -------- | ------------------------ |
| `x`   | number | Yes      | Horizontal acceleration. |
| `y`   | number | Yes      | Vertical acceleration.   |

### `faceVelocity` Rule

`faceVelocity: true` cannot be combined with an explicit `appearance.rotation` unless that rotation is `mode: none`.

This is an ownership rule: either movement owns rotation, or appearance owns rotation.

## `modules.appearance`

Controls texture, size, opacity, tint, and rotation.

### Fields

| Field      | Type                        | Required | Default | Notes             |
| ---------- | --------------------------- | -------- | ------- | ----------------- |
| `texture`  | string \| shape \| selector | Yes      | -       | Texture source.   |
| `scale`    | object                      | No       | unset   | Size control.     |
| `alpha`    | object                      | No       | unset   | Opacity control.  |
| `color`    | object                      | No       | unset   | Tint control.     |
| `rotation` | object                      | No       | unset   | Rotation control. |

### `appearance.texture`

Three forms are supported.

#### 1. Bare texture alias

```yaml
texture: snowflake
```

Use this for the common single-texture case.

#### 2. Inline shape texture

```yaml
texture:
  shape: circle
  radius: 4
  color: "#ffffff"
```

#### 3. Texture selector

```yaml
texture:
  mode: random
  pick: perParticle
  items:
    - src: spark-a
      weight: 3
    - src: spark-b
      weight: 1
```

Selector fields:

| Field   | Type                            | Required | Default       | Notes                            |
| ------- | ------------------------------- | -------- | ------------- | -------------------------------- |
| `mode`  | `single` \| `random` \| `cycle` | Yes      | -             | Selection behavior.              |
| `pick`  | `perParticle` \| `perWave`      | No       | `perParticle` | Pick frequency.                  |
| `items` | array                           | Yes      | -             | Non-empty list of texture items. |

Selector item fields:

| Field    | Type                            | Required                     | Notes                       |
| -------- | ------------------------------- | ---------------------------- | --------------------------- |
| `src`    | string                          | Either `src` or shape fields | Named or asset texture.     |
| `shape`  | `circle` \| `ellipse` \| `rect` | Either `src` or `shape`      | Inline shape texture.       |
| `radius` | number                          | No                           | Shape-specific.             |
| `width`  | number                          | No                           | Shape-specific.             |
| `height` | number                          | No                           | Shape-specific.             |
| `color`  | string \| number                | No                           | Shape tint.                 |
| `weight` | number                          | No                           | Positive. Used by `random`. |

Notes:

- `mode: single` requires exactly one item.
- `weight` is only meaningful for `mode: random`.
- `pick: perWave` uses one chosen texture for the whole spawn wave.
- `pick: perParticle` chooses independently for each particle.

### `appearance.scale`

Scale controls particle size.

#### `mode: single`

```yaml
scale:
  mode: single
  value: 0.75
```

#### `mode: range`

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

#### `mode: curve`

```yaml
scale:
  mode: curve
  keys:
    - { time: 0, value: 0.4 }
    - { time: 0.5, value: 1.2 }
    - { time: 1, value: 0.2 }
```

Rules:

- scale values must be non-negative

### `appearance.alpha`

Alpha controls opacity.

#### `mode: single`

```yaml
alpha:
  mode: single
  value: 0.8
```

#### `mode: curve`

```yaml
alpha:
  mode: curve
  keys:
    - { time: 0, value: 0 }
    - { time: 0.1, value: 1 }
    - { time: 1, value: 0 }
```

Rules:

- alpha values must stay between `0` and `1`

### `appearance.color`

Color controls tint.

#### `mode: single`

```yaml
color:
  mode: single
  value: "#ffffff"
```

#### `mode: gradient`

```yaml
color:
  mode: gradient
  keys:
    - { time: 0, value: "#ffff00" }
    - { time: 0.5, value: "#ff6600" }
    - { time: 1, value: "#ff0000" }
```

### `appearance.rotation`

Rotation supports four modes.

#### `mode: none`

```yaml
rotation:
  mode: none
```

#### `mode: fixed`

```yaml
rotation:
  mode: fixed
  value: -5
```

#### `mode: random`

```yaml
rotation:
  mode: random
  min: 0
  max: 360
```

#### `mode: spin`

```yaml
rotation:
  mode: spin
  start:
    min: 0
    max: 360
  speed:
    min: -45
    max: 45
```

Notes:

- rotation values are in degrees
- signed values are allowed for rotation ranges and spin speed

## `modules.bounds`

Controls what happens when particles leave the allowed region.

### Fields

| Field     | Type                | Required     | Default | Notes                             |
| --------- | ------------------- | ------------ | ------- | --------------------------------- |
| `mode`    | `none` \| `recycle` | No           | `none`  | Bounds behavior.                  |
| `source`  | `area` \| `custom`  | Recycle only | -       | Bounds source.                    |
| `padding` | number \| object    | No           | `0`     | Extra area around `source: area`. |
| `custom`  | object              | Custom only  | -       | Explicit local-space bounds.      |

### `bounds.mode: recycle`

#### `source: area`

Uses the particle element's `width` and `height` as the base region.

```yaml
bounds:
  mode: recycle
  source: area
  padding: 50
```

Per-side padding:

```yaml
bounds:
  mode: recycle
  source: area
  padding:
    top: 50
    right: 10
    bottom: 100
    left: 10
```

#### `source: custom`

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

## Editor Guidance

- Prefer the shortest valid form in authored content.
- For single textures, use `appearance.texture: snowflake` instead of a selector.
- Omit optional fields when they are not doing anything. For example, do not write `acceleration: { x: 0, y: 0 }` or `maxSpeed: 0` unless the editor needs explicit placeholders.
- Use multiple `particles` elements when two particle families need different emission, movement, appearance, or bounds settings.

## Compact Example

This is the earlier snow example, trimmed to the meaningful fields only:

```yaml
elements:
  - id: snow
    type: particles
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
        color:
          mode: single
          value: "#ffffff"
        rotation:
          mode: spin
          start:
            min: 0
            max: 360
          speed:
            min: -45
            max: 45
      bounds:
        mode: recycle
        source: area
        padding: 50
```
