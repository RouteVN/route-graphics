---
template: docs-documentation
title: Assets & Loading
tags: documentation
sidebarId: guide-assets-loading
---

Route Graphics renders from aliases, not from raw URLs in the middle of a render call. The intended flow is:

1. Build an alias map.
2. Fetch those assets into memory with `createAssetBufferManager()`.
3. Hand the resulting buffer map to `app.loadAssets(...)`.
4. Reference aliases like `circle-red` or `video-sample` from `elements[]` and `audio[]`.

## Minimal Flow

```js
import createRouteGraphics, {
  createAssetBufferManager,
  spritePlugin,
  videoPlugin,
  soundPlugin,
} from "/RouteGraphics.js";

const assets = {
  "hero-texture": { url: "/public/hero.png", type: "image/png" },
  "intro-video": { url: "/public/intro.mp4", type: "video/mp4" },
  "bgm-main": { url: "/public/bgm.mp3", type: "audio/mpeg" },
};

const assetBufferManager = createAssetBufferManager();
await assetBufferManager.load(assets);

const app = createRouteGraphics();
await app.init({
  width: 1280,
  height: 720,
  plugins: {
    elements: [spritePlugin, videoPlugin],
    audio: [soundPlugin],
  },
});

await app.loadAssets(assetBufferManager.getBufferMap());
```

## What The Runtime Loads

- Images and other Pixi-compatible textures are loaded into `Assets` and can be used by `sprite`, `slider`, `animated-sprite`, `text-revealing`, and particle textures.
- Audio assets are loaded into the internal audio stage and can be used by `sound` nodes or interaction props such as `soundSrc`.
- Video assets are converted to blob URLs, registered with Pixi's video loader, and then used by `video` elements.
- Font assets are registered with `FontFace`; the alias key becomes the `textStyle.fontFamily` value.

## Practical Notes

- The alias key is the public name you use in YAML. Keep it stable and readable.
- `assetBufferManager.load()` is cached, so calling it again with the same aliases does not refetch them.
- `render(...)` does not fetch missing assets for you. Load before render.
- The playground preloads its built-in sample aliases for circles, sliders, audio, and video so the example templates work without extra setup.

Try the built-in examples in the [Playground](/playground/?template=sprite-demo), [video demo](/playground/?template=video-demo), and [sound demo](/playground/?template=sound-demo).
