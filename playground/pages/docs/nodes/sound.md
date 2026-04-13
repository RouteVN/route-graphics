---
template: docs-documentation
title: Sound Node
tags: documentation
sidebarId: node-sound
---

`sound` is the built-in audio node for one-shot SFX and looping BGM.

Try it in the [Playground](/playground/?template=sound-demo).

## Used In

- `audio[]`

## Field Reference

| Field    | Type    | Required | Default | Notes                                               |
| -------- | ------- | -------- | ------- | --------------------------------------------------- |
| `id`     | string  | Yes      | -       | Audio id.                                           |
| `type`   | string  | Yes      | -       | Must be `sound`.                                    |
| `src`    | string  | Yes      | -       | Audio source alias/URL.                             |
| `volume` | number  | No       | `80`    | Runtime maps to `volume / 100`.                      |
| `loop`   | boolean | No       | `false` | Loop playback.                                      |
| `delay`  | number  | No       | `0`     | Delay in ms before adding to audio stage.           |

## Behavior Notes

- Delayed sounds are scheduled and can be canceled by updates/deletes with the same `id`.
- Updating a sound with delay reschedules from scratch.
- If a pending delayed sound is updated to immediate playback, the pending timer is canceled and sound is added immediately.

## Example: Minimal SFX

```yaml
audio:
  - id: click-sound
    type: sound
    src: sfx-1
```

## Example: Looping Background Music

```yaml
audio:
  - id: bgm-main
    type: sound
    src: bgm-1
    volume: 70
    loop: true
```

## Example: Delayed Sound Cue

```yaml
audio:
  - id: stage-announce
    type: sound
    src: sfx-announce
    delay: 1200
    volume: 90
```
