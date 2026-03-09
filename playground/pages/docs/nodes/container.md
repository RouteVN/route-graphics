---
template: docs-documentation
title: Container Node
tags: documentation
sidebarId: node-container
---

`container` groups child elements and optionally applies layout + clipping scroll behavior.

Try it in the [Playground](/playground/?template=container-layout).

## Used In

- `elements[]`

## Field Reference

| Field        | Type                                     | Required            | Default                  | Notes                                                |
| ------------ | ---------------------------------------- | ------------------- | ------------------------ | ---------------------------------------------------- |
| `id`         | string                                   | Yes                 | -                        | Element id.                                          |
| `type`       | string                                   | Yes                 | -                        | Must be `container`.                                 |
| `x`          | number                                   | Yes (public schema) | `0` at runtime           | Position before anchor transform.                    |
| `y`          | number                                   | Yes (public schema) | `0` at runtime           | Position before anchor transform.                    |
| `width`      | number                                   | No                  | auto                     | Derived from children if omitted.                    |
| `height`     | number                                   | No                  | auto                     | Derived from children if omitted.                    |
| `anchorX`    | number                                   | No                  | `0`                      | For containers, use `0`, `0.5`, or `1`.              |
| `anchorY`    | number                                   | No                  | `0`                      | For containers, use `0`, `0.5`, or `1`.              |
| `alpha`      | number                                   | No                  | `1`                      | Opacity `0..1`.                                      |
| `children`   | array                                    | No                  | `[]`                     | Any registered element plugin type can be nested.    |
| `direction`  | `absolute` \| `horizontal` \| `vertical` | No                  | `""` (absolute behavior) | Auto-positioning for children in non-absolute modes. |
| `gap`        | number                                   | No                  | `0`                      | Space between children in layout mode.               |
| `rotation`   | number                                   | No                  | `0`                      | Degrees.                                             |
| `scroll`     | boolean                                  | No                  | `false`                  | Enables clipping and wheel scrolling for overflow.   |
| `hover`      | object                                   | No                  | -                        | Hover event config.                                  |
| `click`      | object                                   | No                  | -                        | Click event config.                                  |
| `rightClick` | object                                   | No                  | -                        | Right click event config.                            |

## Layout Behavior Notes

- `absolute`: child `x`/`y` are used as-is.
- `horizontal` / `vertical`: parser repositions children and can wrap by container `width`/`height` when provided and `scroll` is false.
- Child nodes are parsed with the active parser plugin set.

## Emitted Events

| Event Name   | Fired When               | Payload Shape                                     |
| ------------ | ------------------------ | ------------------------------------------------- |
| `hover`      | pointer enters container | `{ _event: { id }, ...hover.actionPayload }`      |
| `click`      | pointer up               | `{ _event: { id }, ...click.actionPayload }`      |
| `rightclick` | right click              | `{ _event: { id }, ...rightClick.actionPayload }` |

## Example: Minimal Group

```yaml
elements:
  - id: hud
    type: container
    x: 40
    y: 40
    children:
      - id: hp-label
        type: text
        x: 0
        y: 0
        content: "HP"
```

## Example: Vertical Menu Layout

```yaml
elements:
  - id: menu
    type: container
    x: 120
    y: 120
    direction: vertical
    gap: 10
    children:
      - id: btn-start
        type: rect
        width: 260
        height: 56
        fill: "0x2a2a2a"
      - id: btn-options
        type: rect
        width: 260
        height: 56
        fill: "0x2a2a2a"
      - id: btn-exit
        type: rect
        width: 260
        height: 56
        fill: "0x2a2a2a"
```

## Example: Scrollable Container

```yaml
elements:
  - id: inventory
    type: container
    x: 760
    y: 80
    width: 420
    height: 560
    direction: vertical
    gap: 8
    scroll: true
    children:
      - id: item-1
        type: text
        x: 0
        y: 0
        content: "Potion"
      - id: item-2
        type: text
        x: 0
        y: 0
        content: "Ether"
      - id: item-3
        type: text
        x: 0
        y: 0
        content: "Elixir"
```
