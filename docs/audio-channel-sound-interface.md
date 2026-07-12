# Audio Channel And Sound Interface

Last updated: 2026-07-12

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

Filter objects use `type` as their algorithm discriminator, matching other
Route Graphics discriminated objects:

```yaml
filters:
  - id: music-lowpass
    type: lowpass
```

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
target sounds, channels, and filters consistently. An ID must keep the same
object kind across render states; changing an ID between `sound`,
`audio-channel`, and audio filter is invalid.

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
    type: lowpass
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
| `filters`  | audio filter[]  | `[]`     | Ordered filters applied to this channel                     |
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
    type: bandpass
    frequency: 1200
    q: 0.8
    wet: 100
loop: true
startDelayMs: 0
playbackRate: 1
startAt: 0
endAt: null
```

| Field          | Type           | Default  | Meaning                                                     |
| -------------- | -------------- | -------- | ----------------------------------------------------------- |
| `id`           | string         | required | Stable globally unique playback identity                    |
| `type`         | `sound`        | required | Node type                                                   |
| `src`          | string         | required | Audio asset alias or source URL                             |
| `volume`       | number         | `100`    | Sound gain, from `0` to `100`                               |
| `muted`        | boolean        | `false`  | Forces only this sound output to zero                       |
| `pan`          | number         | `0`      | Stereo position, `-1` full left, `0` center, `1` full right |
| `filters`      | audio filter[] | `[]`     | Ordered filters applied to this sound                       |
| `loop`         | boolean        | `false`  | Whether the sound loops                                     |
| `startDelayMs` | number         | `0`      | Delay before playback starts, in milliseconds               |
| `playbackRate` | number         | `1`      | Playback speed and pitch multiplier                         |
| `startAt`      | number         | `0`      | Start offset inside the audio file, in seconds              |
| `endAt`        | number/null    | `null`   | Optional stop offset inside the audio file, in seconds      |

`startDelayMs` is a scheduling delay before the sound starts. `startAt` and
`endAt` are positions inside the audio file. They are different concepts.

## Sound Identity And Updates

`sound.id` is the logical playback identity. Route Graphics compares the
previous and next objects with that ID to decide whether playback continues or
a new source instance replaces it.

The source identity fields are:

- `src`
- `startAt`
- `endAt`
- `startDelayMs`

If any source identity field changes, Route Graphics treats the sound as a
replacement. The old instance may run its exit transition while the new
instance runs its enter transition.

Other sound changes update the continuing instance:

- moving the sound between channels reroutes it without restarting playback
- `volume`, `muted`, and `pan` update its output controls
- `loop` updates its playback mode
- `playbackRate` updates its current source rate
- filter additions, removals, updates, and reordering follow the filter identity
  rules below

This avoids silently ignoring changes to creation-time scheduling fields.

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
    type: lowpass
    frequency: 900
    q: 1
    wet: 100
```

| Field       | Type                            | Default  | Meaning                                   |
| ----------- | ------------------------------- | -------- | ----------------------------------------- |
| `id`        | string                          | required | Globally unique filter ID                 |
| `type`      | `lowpass`/`highpass`/`bandpass` | required | Filter algorithm                          |
| `enabled`   | boolean                         | `true`   | Immediate bypass flag                     |
| `wet`       | number                          | `100`    | Linear wet/dry amount, from `0` to `100`  |
| `frequency` | number                          | required | Cutoff or center frequency in hertz       |
| `q`         | number                          | `1`      | Non-negative resonance or bandwidth value |

The first filter implementation should support `lowpass`, `highpass`, and
`bandpass`. Route Graphics validates `frequency` as positive and clamps it to
the current audio context's Nyquist frequency. `q` must be non-negative.

`wet` is implemented by the Route Graphics wrapper for every filter, even when
the underlying Web Audio node has no native wet/dry control. Every filter stage
uses a linear mix:

```text
input -> dry gain -----------\
     \-> filter -> wet gain ---> output
```

At `wet: 0`, the dry gain is `1` and wet gain is `0`. At `wet: 100`, dry gain is
`0` and wet gain is `1`. `enabled: false` immediately bypasses the stage and is
not a smooth transition; use a `wet` transition for a smooth bypass.

Delay, reverb, compressor, shelf, peaking, notch, and all-pass filters remain
future work. They should not enter the public schema until their units, ranges,
defaults, resource loading, and feedback behavior are specified.

Filters are not reusable runtime instances. A filter object is one concrete
processing node in one sound or channel signal chain. Reusable filter presets
can exist in higher-level tools, but Route Graphics should receive expanded
filter instances with unique IDs.

Filter identity includes its `id`, owning sound or channel, and `type`:

- the same ID, owner, and type continues the existing filter instance
- changing the owner or type replaces the filter instance
- replacement lets the old filter exit while the new filter enters
- changing an ID between a filter and an audio node is invalid

## Cross-State Identity Summary

| Object          | Continues when                                       | Replaced when                                        |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `audio-channel` | Its `id` exists as an `audio-channel` in both states | It is removed and later added                        |
| `sound`         | Its `id` and all source identity fields match        | `src`, `startAt`, `endAt`, or `startDelayMs` changes |
| audio filter    | Its `id`, owner, and `type` match                    | Its owner or `type` changes                          |

Changing an ID from one object kind to another is invalid rather than a
replacement. Property changes not listed in the replacement column update the
continuing instance.

## Filter Ordering

Filters are ordered by their array position.

For one sound inside a channel, the intended signal chain is:

```text
sound source
-> sound filters, in array order
-> sound pan
-> sound output gain and mute
-> channel mix
-> channel filters, in array order
-> channel pan
-> channel output gain and mute
-> destination
```

This means sound filters affect only one sound, while channel filters affect the
mixed output of all child sounds. Placing gain and mute after each scope's
filters guarantees that `muted: true` produces silence, including delay or
reverb tails added by future filters. It also makes volume scale the complete
filtered output.

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

`audio-transition` smooths changes to audio node or filter properties. It keeps
the existing Route Graphics property-centric shape so one effect can describe
enter, update, and exit behavior without a second lifecycle discriminator.

| Field        | Type               | Meaning                                      |
| ------------ | ------------------ | -------------------------------------------- |
| `id`         | string             | Globally unique transition ID                |
| `type`       | `audio-transition` | Effect type                                  |
| `targetId`   | string             | Globally unique sound, channel, or filter ID |
| `properties` | object             | Property automation map                      |

`targetId` resolves the target kind directly, so `targetType` is unnecessary.
Route Graphics should reject more than one `audio-transition` targeting the
same `targetId` in one render state. Authors combine automation for that target
inside one `properties` map.

```yaml
audioEffects:
  - id: music-transitions
    type: audio-transition
    targetId: music
    properties:
      volume:
        enter: { from: 0, duration: 800, easing: linear }
        update: { duration: 300, easing: linear }
        exit: { to: 0, duration: 1000, easing: linear }
      pan:
        update: { duration: 500, easing: linear }
```

Each property may contain any applicable lifecycle phases:

```yaml
propertyName:
  enter: { from: 0, duration: 1000, easing: linear }
  update: { duration: 300, easing: linear }
  exit: { to: 0, duration: 1000, easing: linear }
```

Lifecycle resolution rules:

- `enter` applies to a target that appears or is the incoming side of a
  replacement; it resolves the target and effect from the next state
- `update` requires the same continuing target in both states; its destination
  is the next state's declared property value and its effect comes from the
  next state
- `exit` applies to a target that disappears or is the outgoing side of a
  replacement; it resolves the target and effect from the previous state
- if a new render interrupts automation, the next ramp starts from the current
  audible value after holding or cancelling prior scheduled automation
- cleanup waits for the longest exit duration affecting the removed instance

An omitted phase means that lifecycle change is immediate for that property.
`duration` is measured in milliseconds. `easing` is required; the first
implementation supports `linear`.

## Transitionable Properties

Recommended support:

| Target type     | Properties                      |
| --------------- | ------------------------------- |
| `audio-channel` | `volume`, `pan`                 |
| `sound`         | `volume`, `pan`, `playbackRate` |
| audio filter    | `frequency`, `q`, `wet`         |

Do not transition these fields:

| Field          | Reason                                                  |
| -------------- | ------------------------------------------------------- |
| `muted`        | Boolean switch; use `volume` transition for smooth mute |
| `enabled`      | Boolean switch; use `wet` transition for smooth bypass  |
| `loop`         | Playback mode, not a continuous value                   |
| `startDelayMs` | Source identity; changing it replaces the sound         |
| `startAt`      | Source identity; changing it replaces the sound         |
| `endAt`        | Source identity; changing it replaces the sound         |
| `src`          | Source identity; changing it replaces the sound         |

`from` and `to` use the same units and validation range as their target
property. For example, volume and wet use `0` to `100`, pan uses `-1` to `1`,
frequency uses hertz, and playback rate must be non-negative.

## Crossfade By Declarative Replacement

Route Graphics should treat the same `sound.id` with any changed source identity
field as replacement. The old internal source exits while the new internal
source enters. This example changes `src`.

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
    targetId: bgm
    properties:
      volume:
        exit: { to: 0, duration: 1000, easing: linear }
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
    targetId: bgm
    properties:
      volume:
        enter: { from: 0, duration: 1000, easing: linear }
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
        type: lowpass
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
    targetId: music-lowpass
    properties:
      frequency:
        update: { duration: 500, easing: linear }
      wet:
        update: { duration: 300, easing: linear }
```

This avoids a top-level `audio-filter` item while still keeping filter
properties transitionable.

## Recommended Implementation Order

1. Enforce one `audio-transition` per target while preserving the existing
   transition shape.
2. Extend `audio-transition` from `volume` to `pan`.
3. Extend `audio-transition` to `playbackRate` on sounds.
4. Add nested `filters` to `sound` and `audio-channel`.
5. Add precisely specified `lowpass`, `highpass`, and `bandpass` filters.
6. Let `audio-transition` target nested filter IDs and continuous fields.
7. Design delay, reverb, and dynamics filters separately.

## Backward Compatibility

The interface expansion preserves every implemented audio render-state shape:

- flat top-level `sound` nodes remain valid and use the implicit root channel
- `audioTransition` remains accepted as a legacy alias; new state emits
  `audio-transition`
- existing `properties.volume.enter`, `update`, and `exit` objects remain valid
- `kind` and `targetType` are not introduced
- node-owned filters are additive because no audio filter interface has shipped

The previously documented top-level `audioFilter` proposal is superseded by
node-owned `filters` arrays. It was not implemented and therefore does not need
a runtime compatibility alias.

## Example Full Render State

```yaml
audio:
  - id: music
    type: audio-channel
    volume: 80
    pan: 0
    filters:
      - id: music-lowpass
        type: lowpass
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
          - id: door-knock-bandpass
            type: bandpass
            frequency: 1400
            q: 0.8
            wet: 25

audioEffects:
  - id: music-volume-update
    type: audio-transition
    targetId: music
    properties:
      volume:
        update: { duration: 300, easing: linear }
      pan:
        update: { duration: 500, easing: linear }

  - id: music-lowpass-update
    type: audio-transition
    targetId: music-lowpass
    properties:
      frequency:
        update: { duration: 500, easing: linear }

  - id: bgm-lifecycle
    type: audio-transition
    targetId: bgm
    properties:
      volume:
        enter: { from: 0, duration: 800, easing: linear }
        exit: { to: 0, duration: 1000, easing: linear }
```

This remains fully declarative: adding nodes starts audio, removing nodes stops
audio, replacing sound sources crossfades when lifecycle transitions exist, and
update transitions smooth changes to node and filter properties.
