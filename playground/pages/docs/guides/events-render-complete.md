---
template: docs-documentation
title: Events & Render Complete
tags: documentation
sidebarId: guide-events-render-complete
---

Every interactive or lifecycle signal in Route Graphics flows through the single `eventHandler(eventName, payload)` callback passed to `init(...)`.

## Common Event Names

- `hover`
- `click`
- `rightClick`
- `scrollUp`
- `scrollDown`
- `dragStart`
- `dragMove`
- `dragEnd`
- `change`
- `keydown`
- `renderComplete`

## Naming Convention

- Public Route Graphics event names use `camelCase`.
- Public config keys also use `camelCase`.
- Native Pixi events such as `pointerdown`, `rightdown`, and `rightup` stay internal implementation details.

Element events include `_event` metadata plus any `actionPayload` you configured in the node.

```js
await app.init({
  width: 1280,
  height: 720,
  plugins,
  eventHandler: (eventName, payload) => {
    console.log(eventName, payload);
  },
});
```

## `renderComplete`

`renderComplete` is the main lifecycle event for knowing when a render has fully settled.

It fires after the current render finishes all tracked asynchronous work:

- tweens
- `text-revealing`
- non-looping video playback

Payload shape:

```js
{
  id: "state-id-or-null",
  aborted: false
}
```

If a new render interrupts a previous one before its tracked work finishes, the old render emits:

```js
{
  id: "previous-state-id",
  aborted: true
}
```

## Recommendations

- Give states stable `id` values if you plan to react to `renderComplete`.
- Treat `aborted: true` as cancellation, not success.
- Keep element-level `actionPayload` small and serializable so event handling stays predictable.

You can inspect these events directly in the [Interactive Elements](/playground/?template=interactive-elements), [Animation Showcase](/playground/?template=animations-showcase), [Global Config Demo](/playground/?template=global-config-demo), and [Video Demo](/playground/?template=video-demo) templates.
