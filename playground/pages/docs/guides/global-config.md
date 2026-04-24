---
template: docs-documentation
title: Global Config
tags: documentation
sidebarId: guide-global-config
---

`state.global` is where Route Graphics applies renderer-wide behavior that is not tied to a single element.

Today that includes:

- `cursorStyles`
- `keyboard`

## Cursor Styles

`global.cursorStyles` writes into Pixi's renderer cursor map and also updates the canvas cursor directly when the default style changes.

```yaml
global:
  cursorStyles:
    default: crosshair
    hover: pointer
```

If you remove `global.cursorStyles` in a later render, the runtime resets the defaults back to `default` and `pointer`.

## Keyboard Bindings

`global.keyboard` registers global hotkeys through `hotkeys-js`. Each binding can emit `keydown` and `keyup` events through the shared `eventHandler`.

```yaml
global:
  keyboard:
    r:
      keydown:
        payload:
          action: reset-demo
      keyup:
        payload:
          action: reset-demo-finished
    shift+s:
      keydown:
        payload:
          action: save-demo
```

The public keyboard phases are `keydown` and `keyup`. Route Graphics does not expose browser `keypress` as a public event.

The emitted payload shape is:

```js
{
  _event: { key: "r" },
  action: "reset-demo"
}
```

## Render Semantics

- Keyboard bindings are re-registered on every render from the latest `state.global.keyboard`.
- Removed keys and removed phases are unbound automatically.
- Cursor styles and keyboard mappings are independent from element-level hover/click handlers.

Use the [Global Config Demo](/playground/?template=global-config-demo) to see cursor changes and keyboard payloads in the playground event log.
