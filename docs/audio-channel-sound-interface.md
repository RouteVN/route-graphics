# Audio Channel And Sound Interface

Last updated: 2026-07-12

Status: proposal for the next Route Graphics audio interface expansion.

This document describes the Route Graphics level interface for audio channels,
sounds, and audio transitions. It intentionally does not
include Route Engine or Creator concepts such as BGM, SFX, voice, ducking,
dialogue, or resource pickers. Those higher-level concepts should compile down
to the declarative Route Graphics shape described here.

## Design Goals

- keep Route Graphics audio declarative
- keep current audio state in `audio`
- keep transition behavior in `audioEffects`
- use `audio-channel` for grouped/bus behavior
- use `sound` for playable source behavior
- use `audio-transition` for smoothing state changes

## Non-Goals

- no `play`, `pause`, `queue`, or `stop` commands in render state
- no BGM/SFX/voice concepts in Route Graphics
- no Creator-specific field names such as `fadeInMs` or `crossfadeMs`
- no audio filters or general-purpose DSP graph
- no arbitrary scripting or callback hooks in the audio interface

## Naming Rules

Route Graphics type discriminators should use kebab-case:

```yaml
type: audio-channel
type: audio-transition
```

The previous `audioTransition` spelling is only a legacy alias for
compatibility. New render state should emit `audio-transition`.

## Top-Level Shape

Route Graphics audio render state has two top-level arrays:

```yaml
audio: []
audioEffects: []
```

`audio` contains audio graph nodes. `audioEffects` contains transition effects
that target audio node IDs.

All IDs in `audio` and `audioEffects` share one namespace per render state. This
makes `targetId` resolution unambiguous. An ID must keep the same object kind
across render states; changing an ID between `sound` and `audio-channel` is
invalid.

## Audio Channel

An `audio-channel` is a bus/container. It does not load or play an audio file.
It owns child sounds and applies group-level output properties.

```yaml
id: music
type: audio-channel
volume: 80
muted: false
pan: 0
children: []
```

| Field      | Type            | Default  | Meaning                                                     |
| ---------- | --------------- | -------- | ----------------------------------------------------------- |
| `id`       | string          | required | Stable globally unique channel ID                           |
| `type`     | `audio-channel` | required | Node type                                                   |
| `volume`   | number          | `100`    | Channel gain, from `0` to `100`                             |
| `muted`    | boolean         | `false`  | Forces channel output to zero                               |
| `pan`      | number          | `0`      | Stereo position, `-1` full left, `0` center, `1` full right |
| `children` | sound[]         | `[]`     | Sound nodes owned by this channel                           |

First implementation rule:

- channel children may contain `sound` nodes only
- nested channels remain unsupported until explicitly designed
- child array order does not control playback order; sounds are mixed in
  parallel and may use `startDelayMs` for scheduled sequences

## Sound

A `sound` is a playable source. It loads one audio asset and represents one
logical playback identity.

```yaml
id: bgm
type: sound
src: theme
volume: 100
muted: false
pan: 0
loop: true
startDelayMs: 0
playbackRate: 1
startAt: 0
endAt: null
```

| Field          | Type        | Default  | Meaning                                                     |
| -------------- | ----------- | -------- | ----------------------------------------------------------- |
| `id`           | string      | required | Stable globally unique playback identity                    |
| `type`         | `sound`     | required | Node type                                                   |
| `src`          | string      | required | Audio asset alias or source URL                             |
| `volume`       | number      | `100`    | Sound gain, from `0` to `100`                               |
| `muted`        | boolean     | `false`  | Forces only this sound output to zero                       |
| `pan`          | number      | `0`      | Stereo position, `-1` full left, `0` center, `1` full right |
| `loop`         | boolean     | `false`  | Whether the sound loops                                     |
| `startDelayMs` | number      | `0`      | Delay before playback starts, in milliseconds               |
| `playbackRate` | number      | `1`      | Playback speed and pitch multiplier                         |
| `startAt`      | number      | `0`      | Start offset inside the audio file, in seconds              |
| `endAt`        | number/null | `null`   | Optional stop offset inside the audio file, in seconds      |

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

This avoids silently ignoring changes to creation-time scheduling fields.

## Channel Versus Sound Fields

| Field          | `audio-channel` | `sound` | Notes                                  |
| -------------- | --------------- | ------- | -------------------------------------- |
| `volume`       | yes             | yes     | Multiplies together                    |
| `muted`        | yes             | yes     | Channel mute affects every child sound |
| `pan`          | yes             | yes     | Channel pan applies to the whole group |
| `src`          | no              | yes     | Sounds only                            |
| `loop`         | no              | yes     | Sounds only                            |
| `startDelayMs` | no              | yes     | Sounds only                            |
| `playbackRate` | no              | yes     | Sounds only                            |
| `startAt`      | no              | yes     | Sounds only                            |
| `endAt`        | no              | yes     | Sounds only                            |
| `children`     | yes             | no      | Channels only                          |

## Cross-State Identity Summary

| Object          | Continues when                                       | Replaced when                                        |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `audio-channel` | Its `id` exists as an `audio-channel` in both states | It is removed and later added                        |
| `sound`         | Its `id` and all source identity fields match        | `src`, `startAt`, `endAt`, or `startDelayMs` changes |

Changing an ID from one object kind to another is invalid rather than a
replacement. Property changes not listed in the replacement column update the
continuing instance.

## Signal Flow

For one sound inside a channel, the signal flow is:

```text
sound source
-> sound pan
-> sound output gain and mute
-> channel mix
-> channel pan
-> channel output gain and mute
-> destination
```

Sound controls apply before the sound joins its channel. Channel controls apply
to the combined output of every child sound. A mute is an immediate hard gate
that overrides, but does not change, the corresponding volume value.

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

`audio-transition` smooths changes to audio node properties. It keeps the
existing Route Graphics property-centric shape so one effect can describe enter,
update, and exit behavior without a second lifecycle discriminator.

| Field        | Type               | Meaning                             |
| ------------ | ------------------ | ----------------------------------- |
| `id`         | string             | Globally unique transition ID       |
| `type`       | `audio-transition` | Effect type                         |
| `targetId`   | string             | Globally unique sound or channel ID |
| `properties` | object             | Property automation map             |

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

Do not transition these fields:

| Field          | Reason                                                  |
| -------------- | ------------------------------------------------------- |
| `muted`        | Boolean switch; use `volume` transition for smooth mute |
| `loop`         | Playback mode, not a continuous value                   |
| `startDelayMs` | Source identity; changing it replaces the sound         |
| `startAt`      | Source identity; changing it replaces the sound         |
| `endAt`        | Source identity; changing it replaces the sound         |
| `src`          | Source identity; changing it replaces the sound         |

`from` and `to` use the same units and validation range as their target
property. Volume uses `0` to `100`, pan uses `-1` to `1`, and playback rate must
be non-negative.

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

## Recommended Implementation Order

1. Enforce one `audio-transition` per target while preserving the existing
   transition shape.
2. Extend `audio-transition` from `volume` to `pan`.
3. Extend `audio-transition` to `playbackRate` on sounds.

## Backward Compatibility

The interface expansion preserves every implemented audio render-state shape:

- flat top-level `sound` nodes remain valid and use the implicit root channel
- `audioTransition` remains accepted as a legacy alias; new state emits
  `audio-transition`
- existing `properties.volume.enter`, `update`, and `exit` objects remain valid
- `kind` and `targetType` are not introduced

The previously documented `audioFilter` proposal was not implemented and is no
longer part of this interface.

## Example Full Render State

```yaml
audio:
  - id: music
    type: audio-channel
    volume: 80
    pan: 0
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

audioEffects:
  - id: music-volume-update
    type: audio-transition
    targetId: music
    properties:
      volume:
        update: { duration: 300, easing: linear }
      pan:
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
update transitions smooth changes to node properties.
