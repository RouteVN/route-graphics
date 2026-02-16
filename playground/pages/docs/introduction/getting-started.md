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
});

await app.loadAssets(assetBufferManager.getBufferMap());
document.body.appendChild(app.canvas);
```

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
