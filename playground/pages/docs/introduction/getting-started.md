---
template: docs-documentation
title: Getting Started
tags: documentation
sidebarId: getting-started
---

This guide shows how to use Route Graphics in a web page.

The setup below follows the same runtime flow used in `vt/templates/default.html`.

## 1. Import Route Graphics

You can load from your built bundle (or CDN equivalent):

```html
<script type="module">
  import createRouteGraphics, {
    textPlugin,
    rectPlugin,
    spritePlugin,
    videoPlugin,
    sliderPlugin,
    containerPlugin,
    textRevealingPlugin,
    animatedSpritePlugin,
    particlesPlugin,
    tweenPlugin,
    soundPlugin,
    createAssetBufferManager,
  } from "/RouteGraphics.js";
</script>
```

## 2. Prepare and load assets

```js
const assetsObject = {
  "circle-red": { url: "/public/circle-red.png", type: "image/png" },
  "bgm-1": { url: "/public/bgm-1.mp3", type: "audio/mpeg" },
  "intro-video": { url: "/public/video_sample.mp4", type: "video/mp4" },
};

const assetBufferManager = createAssetBufferManager();
await assetBufferManager.load(assetsObject);
```

## 3. Initialize app with plugins

```js
const app = createRouteGraphics();

await app.init({
  width: 1280,
  height: 720,
  plugins: {
    elements: [
      textPlugin,
      rectPlugin,
      spritePlugin,
      videoPlugin,
      sliderPlugin,
      containerPlugin,
      textRevealingPlugin,
      animatedSpritePlugin,
      particlesPlugin,
    ],
    animations: [tweenPlugin],
    audio: [soundPlugin],
  },
  eventHandler: (eventName, payload) => {
    console.log(eventName, payload);
  },
  rendererOptions: {
    resolution: 1,
    preserveDrawingBuffer: false,
    clearBeforeRender: true,
  },
});

await app.loadAssets(assetBufferManager.getBufferMap());
document.body.appendChild(app.canvas);
```

`rendererOptions` is intentionally narrow. Route Graphics currently allows only:

- `resolution`
- `preserveDrawingBuffer`
- `clearBeforeRender`

This keeps the public init contract explicit instead of passing arbitrary Pixi application options through the library.

## 4. Render state

```js
app.render({
  id: "state-0",
  elements: [
    {
      id: "title",
      type: "text",
      x: 40,
      y: 40,
      content: "Hello Route Graphics",
      textStyle: {
        fill: "#FFFFFF",
        fontSize: 36,
      },
    },
  ],
  animations: [],
  audio: [],
  global: {},
});
```

## 5. Multi-state updates

Call `app.render(nextState)` whenever your UI state changes.
Route Graphics diffs the previous and next tree, then applies add/update/delete and animations automatically.

From here:

- [Assets & Loading](/docs/guides/assets-loading/) explains aliases and runtime asset classes.
- [Events & Render Complete](/docs/guides/events-render-complete/) covers lifecycle timing.
- [Using the Playground](/docs/guides/playground/) shows how to iterate on examples and inspect emitted events.
