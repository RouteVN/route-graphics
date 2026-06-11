# Audio Channel And Sound Interface

Last updated: 2026-06-11

Status: proposal for the next Route Graphics audio interface expansion.

This document describes the Route Graphics level interface for audio channels,
sounds, node-owned filters, and audio transitions. It intentionally does not
include Route Engine or Creator concepts such as BGM, SFX, voice, ducking,
dialogue, or resource pickers. Those higher-level concepts should compile down
to the declarative Route Graphics shape described here.

## Design Goals

- keep Route Graphics audio declarative
- keep current audio state in `audio`
- keep transition behavior in `audioEffects`
- use `audio-channel` for grouped/bus behavior
- use `sound` for playable source behavior
- use `filters` on channels and sounds for Web Audio processing
- use `audio-transition` for smoothing state changes
- keep filter instances local to one channel or sound while still giving every
  filter a stable ID for transitions

## Non-Goals

- no `play`, `pause`, `queue`, or `stop` commands in render state
- no BGM/SFX/voice concepts in Route Graphics
- no Creator-specific field names such as `fadeInMs` or `crossfadeMs`
- no top-level `audio-filter` effect item
- no reusable filter instances shared across multiple targets
- no arbitrary scripting or callback hooks in the audio interface

## Naming Rules

Route Graphics type discriminators should use kebab-case:

```yaml
type: audio-channel
type: audio-transition
```

The previous `audioTransition` spelling is only a legacy alias for
compatibility. New render state should emit `audio-transition`.

Filter objects do not need a `type` field because their ownership is already
defined by the containing node's `filters` array. They use `filterType` instead:

```yaml
filters:
  - id: music-lowpass
    filterType: lowpass
```

`targetType: audio-filter` is still valid for transitions that target filter
IDs. It identifies the target kind; it is not a filter object's `type` field.

## Top-Level Shape

Route Graphics audio render state has two top-level arrays:

```yaml
audio: []
audioEffects: []
```

`audio` contains audio graph nodes. `audioEffects` contains transition effects
that target audio node IDs or nested filter IDs.

All IDs in `audio`, nested `filters`, and `audioEffects` share one namespace per
render state. This makes `targetId` resolution unambiguous and lets transitions
target sounds, channels, and filters consistently.

## Audio Channel

An `audio-channel` is a bus/container. It does not load or play an audio file.
It owns child sounds, applies group-level output properties, and may own an
ordered filter chain.

```yaml
id: music
type: audio-channel
volume: 80
muted: false
pan: 0
filters:
  - id: music-lowpass
    filterType: lowpass
    frequency: 900
    q: 1
    wet: 100
children: []
```

| Field      | Type            | Default  | Meaning                                                     |
| ---------- | --------------- | -------- | ----------------------------------------------------------- |
| `id`       | string          | required | Stable globally unique channel ID                           |
| `type`     | `audio-channel` | required | Node type                                                   |
| `volume`   | number          | `100`    | Channel gain, from `0` to `100`                             |
| `muted`    | boolean         | `false`  | Forces channel output to zero                               |
| `pan`      | number          | `0`      | Stereo position, `-1` full left, `0` center, `1` full right |
| `filters`  | audioFilter[]   | `[]`     | Ordered filters applied to this channel                     |
| `children` | sound[]         | `[]`     | Sound nodes owned by this channel                           |

First implementation rule:

- channel children may contain `sound` nodes only
- nested channels remain unsupported until explicitly designed

## Sound

A `sound` is a playable source. It loads one audio asset, represents one logical
playback identity, and may own an ordered filter chain.

```yaml
id: bgm
type: sound
src: theme
volume: 100
muted: false
pan: 0
filters:
  - id: bgm-radio
    filterType: bandpass
    frequency: 1200
    q: 0.8
    wet: 100
loop: true
startDelayMs: 0
playbackRate: 1
startAt: 0
endAt: null
```

| Field          | Type          | Default  | Meaning                                                     |
| -------------- | ------------- | -------- | ----------------------------------------------------------- |
| `id`           | string        | required | Stable globally unique playback identity                    |
| `type`         | `sound`       | required | Node type                                                   |
| `src`          | string        | required | Audio asset alias or source URL                             |
| `volume`       | number        | `100`    | Sound gain, from `0` to `100`                               |
| `muted`        | boolean       | `false`  | Forces only this sound output to zero                       |
| `pan`          | number        | `0`      | Stereo position, `-1` full left, `0` center, `1` full right |
| `filters`      | audioFilter[] | `[]`     | Ordered filters applied to this sound                       |
| `loop`         | boolean       | `false`  | Whether the sound loops                                     |
| `startDelayMs` | number        | `0`      | Delay before playback starts, in milliseconds               |
| `playbackRate` | number        | `1`      | Playback speed and pitch multiplier                         |
| `startAt`      | number        | `0`      | Start offset inside the audio file, in seconds              |
| `endAt`        | number/null   | `null`   | Optional stop offset inside the audio file, in seconds      |

`startDelayMs` is a scheduling delay before the sound starts. `startAt` and
`endAt` are positions inside the audio file. They are different concepts.

## Channel Versus Sound Fields

| Field          | `audio-channel` | `sound` | Notes                                  |
| -------------- | --------------- | ------- | -------------------------------------- |
| `volume`       | yes             | yes     | Multiplies together                    |
| `muted`        | yes             | yes     | Channel mute affects every child sound |
| `pan`          | yes             | yes     | Channel pan applies to the whole group |
| `filters`      | yes             | yes     | Ordered local filter chain             |
| `src`          | no              | yes     | Sounds only                            |
| `loop`         | no              | yes     | Sounds only                            |
| `startDelayMs` | no              | yes     | Sounds only                            |
| `playbackRate` | no              | yes     | Sounds only                            |
| `startAt`      | no              | yes     | Sounds only                            |
| `endAt`        | no              | yes     | Sounds only                            |
| `children`     | yes             | no      | Channels only                          |

## Audio Filter

An audio filter is a Web Audio processing node owned by a `sound` or
`audio-channel`. Filters are stored in a `filters` array on the node they
process.

```yaml
filters:
  - id: music-lowpass
    filterType: lowpass
    frequency: 900
    q: 1
    wet: 100
```

| Field        | Type   | Default  | Meaning                                |
| ------------ | ------ | -------- | -------------------------------------- |
| `id`         | string | required | Globally unique filter ID              |
| `filterType` | string | required | Filter algorithm                       |
| `enabled`    | bool   | `true`   | Immediate bypass flag                  |
| `wet`        | number | `100`    | Universal wet/dry amount, `0` to `100` |

Filter-specific fields depend on `filterType`. `wet` should be supported for
every filter at the Route Graphics wrapper level, even when the underlying Web
Audio node does not have native wet/dry control. This gives every filter a
consistent smooth enter/exit and bypass path.

Recommended filter types:

| `filterType` | Common use                        | Typical fields                                    |
| ------------ | --------------------------------- | ------------------------------------------------- |
| `lowpass`    | Muffle, underwater, behind a wall | `frequency`, `q`, `wet`                           |
| `highpass`   | Thin speaker, radio, phone        | `frequency`, `q`, `wet`                           |
| `bandpass`   | Radio/phone band limiting         | `frequency`, `q`, `wet`                           |
| `notch`      | Remove a frequency band           | `frequency`, `q`, `wet`                           |
| `allpass`    | Phase shaping                     | `frequency`, `q`, `wet`                           |
| `lowshelf`   | Bass cut/boost                    | `frequency`, `gain`, `wet`                        |
| `highshelf`  | Treble cut/boost                  | `frequency`, `gain`, `wet`                        |
| `peaking`    | EQ band boost/cut                 | `frequency`, `q`, `gain`, `wet`                   |
| `delay`      | Echo                              | `delayTime`, `feedback`, `wet`                    |
| `reverb`     | Room/space                        | `impulseSrc` or preset fields, `wet`              |
| `compressor` | Dynamic range control             | `threshold`, `knee`, `ratio`, `attack`, `release` |

Filters are not reusable runtime instances. A filter object is one concrete
processing node in one sound or channel signal chain. Reusable filter presets
can exist in higher-level tools, but Route Graphics should receive expanded
filter instances with unique IDs.

## Filter Ordering

Filters are ordered by their array position.

For one sound inside a channel, the intended signal chain is:

```text
sound source
-> sound gain
-> sound pan
-> sound filters, in array order
-> channel gain
-> channel pan
-> channel filters, in array order
-> destination
```

This means sound filters affect only one sound, while channel filters affect the
mixed output of all child sounds.

Filter order is part of render state. Reordering filters with the same IDs is a
real signal-chain change and should be supported as an update: Route Graphics
should reconnect the existing filter instances in the new array order when
possible, preserving each filter's current parameter values and active
transitions.

## Volume Stacking

Channel and sound volume multiply.

```yaml
audio:
  - id: music
    type: audio-channel
    volume: 50
    children:
      - id: bgm
        type: sound
        src: theme
        volume: 50
```

Effective volume:

```text
channel 50% * sound 50% = 25%
```

This allows a channel to act like a mixer bus while each sound keeps its own
local gain.

## Audio Transition

`audio-transition` smooths changes to audio node or filter properties. It uses
the same lifecycle vocabulary as visual animations:

- `kind: update` means a persistent target changed property values
- `kind: transition` means target lifecycle handoff: enter, exit, or replacement

Every `audio-transition` should declare:

| Field        | Type                  | Meaning                       |
| ------------ | --------------------- | ----------------------------- |
| `id`         | string                | Globally unique transition ID |
| `type`       | `audio-transition`    | Effect type                   |
| `kind`       | `update`/`transition` | Lifecycle model               |
| `targetType` | string                | Expected target kind          |
| `targetId`   | string                | Target ID                     |

Allowed `targetType` values:

- `sound`
- `audio-channel`
- `audio-filter`

Validation rule:

```text
targetId must resolve to a sound, audio-channel, or filter object matching targetType.
```

For new render state, `kind` and `targetType` should be required. For
compatibility, Route Graphics may accept legacy `audio-transition` effects that
omit them and infer the target from `targetId`.

## Update Transitions

Use `kind: update` when the target exists before and after the render-state
change. Destination values come from the next render state.

```yaml
audioEffects:
  - id: music-volume-update
    type: audio-transition
    kind: update
    targetType: audio-channel
    targetId: music
    properties:
      volume:
        duration: 300
        easing: linear
      pan:
        duration: 500
        easing: linear
```

This means "ramp from current values to the next state's `volume` and `pan`
values."

For `kind: update`, `targetId` must resolve in both previous and next render
state. If the target is a filter, the filter must be present in both states.
Update transitions are invalid for enter-only or exit-only targets.

`kind: update` properties use this shape:

```yaml
propertyName:
  duration: 300
  easing: linear
```

## Lifecycle Transitions

Use `kind: transition` when the target appears, disappears, or is replaced.

```yaml
audioEffects:
  - id: bgm-lifecycle
    type: audio-transition
    kind: transition
    targetType: sound
    targetId: bgm
    enter:
      properties:
        volume: { from: 0, duration: 1000, easing: linear }
    exit:
      properties:
        volume: { to: 0, duration: 1000, easing: linear }
```

`enter` applies when the target appears in the next render state. `exit` applies
when the target disappears from the next render state. Same `sound.id` with a
different `src` is treated as replacement, so the old internal source uses
`exit` and the new internal source uses `enter`.

For `kind: transition`, `enter` targets resolve against the next render state
and `exit` targets resolve against the previous render state. This lets removed
sounds, channels, and filters still use their exit transitions without staying
present in the next `audio` tree.

`kind: transition` property shapes:

```yaml
enter:
  properties:
    propertyName:
      from: 0
      duration: 1000
      easing: linear

exit:
  properties:
    propertyName:
      to: 0
      duration: 1000
      easing: linear
```

## Transitionable Properties

Recommended support:

| Target type     | Properties                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `audio-channel` | `volume`, `pan`                                                                                    |
| `sound`         | `volume`, `pan`, `playbackRate`                                                                    |
| `audio-filter`  | filter-specific continuous fields such as `frequency`, `q`, `gain`, `wet`, `delayTime`, `feedback` |

Do not transition these fields:

| Field          | Reason                                                  |
| -------------- | ------------------------------------------------------- |
| `muted`        | Boolean switch; use `volume` transition for smooth mute |
| `enabled`      | Boolean switch; use `wet` transition for smooth bypass  |
| `loop`         | Playback mode, not a continuous value                   |
| `startDelayMs` | Scheduling input before playback starts                 |
| `startAt`      | Source start offset, not a continuous runtime value     |
| `endAt`        | Source end offset, not a continuous runtime value       |
| `src`          | Source identity; replace/crossfade through enter/exit   |

## Crossfade By Declarative Replacement

Route Graphics should treat the same `sound.id` with a different `src` as
replacement. The old internal source exits while the new internal source enters.

Previous state:

```yaml
audio:
  - id: music
    type: audio-channel
    children:
      - id: bgm
        type: sound
        src: track-a

audioEffects:
  - id: bgm-lifecycle
    type: audio-transition
    kind: transition
    targetType: sound
    targetId: bgm
    exit:
      properties:
        volume: { to: 0, duration: 1000, easing: linear }
```

Next state:

```yaml
audio:
  - id: music
    type: audio-channel
    children:
      - id: bgm
        type: sound
        src: track-b

audioEffects:
  - id: bgm-lifecycle
    type: audio-transition
    kind: transition
    targetType: sound
    targetId: bgm
    enter:
      properties:
        volume: { from: 0, duration: 1000, easing: linear }
```

No explicit `crossfade` command is needed at Route Graphics level.

## Transitioning Filters

Because every filter has a unique ID, `audio-transition` can target filter
properties directly.

```yaml
audio:
  - id: music
    type: audio-channel
    filters:
      - id: music-lowpass
        filterType: lowpass
        frequency: 12000
        q: 1
        wet: 100
    children:
      - id: bgm
        type: sound
        src: theme

audioEffects:
  - id: music-lowpass-update
    type: audio-transition
    kind: update
    targetType: audio-filter
    targetId: music-lowpass
    properties:
      frequency:
        duration: 500
        easing: linear
      wet:
        duration: 300
        easing: linear
```

This avoids a top-level `audio-filter` item while still keeping filter
properties transitionable.

## Recommended Implementation Order

1. Add `kind` and `targetType` to `audio-transition`, with compatibility for the
   existing shape.
2. Extend `audio-transition` from `volume` to `pan`.
3. Extend `audio-transition` to `playbackRate` on sounds.
4. Add nested `filters` to `sound` and `audio-channel`.
5. Add `lowpass`, `highpass`, and `bandpass`.
6. Let `audio-transition` target nested filter IDs.
7. Add `delay` and `reverb` filters.

## Example Full Render State

```yaml
audio:
  - id: music
    type: audio-channel
    volume: 80
    pan: 0
    filters:
      - id: music-lowpass
        filterType: lowpass
        frequency: 12000
        q: 1
        wet: 100
    children:
      - id: bgm
        type: sound
        src: theme
        loop: true
        volume: 100
        pan: 0
        playbackRate: 1
        startDelayMs: 0
        startAt: 0
        endAt: null

  - id: sfx
    type: audio-channel
    volume: 100
    pan: 0
    children:
      - id: door-knock-001
        type: sound
        src: door-knock
        volume: 90
        pan: -0.5
        playbackRate: 1
        filters:
          - id: door-knock-room
            filterType: reverb
            wet: 25

audioEffects:
  - id: music-volume-update
    type: audio-transition
    kind: update
    targetType: audio-channel
    targetId: music
    properties:
      volume:
        duration: 300
        easing: linear
      pan:
        duration: 500
        easing: linear

  - id: music-lowpass-update
    type: audio-transition
    kind: update
    targetType: audio-filter
    targetId: music-lowpass
    properties:
      frequency:
        duration: 500
        easing: linear

  - id: bgm-lifecycle
    type: audio-transition
    kind: transition
    targetType: sound
    targetId: bgm
    enter:
      properties:
        volume: { from: 0, duration: 800, easing: linear }
    exit:
      properties:
        volume: { to: 0, duration: 1000, easing: linear }
```

This remains fully declarative: adding nodes starts audio, removing nodes stops
audio, replacing sound sources crossfades when lifecycle transitions exist, and
update transitions smooth changes to node and filter properties.
