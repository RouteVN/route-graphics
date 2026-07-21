---
template: docs-documentation
title: Assets & Loading
tags: documentation
sidebarId: guide-assets-loading
---

Route Graphics renders from aliases, not from raw URLs in the middle of a render call. The intended flow is:

1. Build an alias map.
2. Normalize those assets with `createAssetBufferManager()`.
3. Hand the resulting asset map to `app.loadAssets(...)`.
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

## Load Errors

Asset loading errors are safe to show in application UI. The thrown
`error.message` and `error.userMessage` use plain language and explain what the
user can act on:

```text
Could not load image "hero-texture". Missing, inaccessible, or unsupported image file.
```

When several assets fail in the same load call, Route Graphics throws an
`AggregateError` with a short summary:

```text
Could not load 2 assets: audio "bgm-main", image "hero-texture". Check that the files exist and are supported.
```

Use `error.userMessage ?? error.message` for alerts or toasts, and log the full
error object for debugging. The original low-level failure is preserved in
`error.cause`. Route Graphics also attaches structured diagnostics to
`error.details`:

```js
try {
  await assetBufferManager.load(assets);
  await app.loadAssets(assetBufferManager.getBufferMap());
} catch (error) {
  showToast(error.userMessage ?? error.message);
  console.error("Failed to load route graphics assets", error);
}
```

For a single asset failure, `error.details` may include:

- `assetKey`: alias that failed
- `assetKind`: user-facing kind, such as `image`, `audio`, `video`, or `font`
- `assetCategory`: runtime category, such as `texture`, `audio`, `video`, or
  `font`
- `type`: MIME type
- `source`: `url` or `buffer`
- `url`: source URL, truncated if very long
- `bufferBytes`: byte length for buffer-backed assets
- `phase`: loader step that failed
- `cause`: original low-level error message

For multi-asset failures, `error.details.failures` contains one diagnostic
object per failed asset. Use that for logs or a separate details view instead of
putting the full list in the alert.

## What The Runtime Loads

- Images and other Pixi-compatible textures are loaded into `Assets` and can be used by `sprite`, `slider`, `spritesheet-animation`, `text-revealing`, and particle textures. When possible, images are loaded directly from their source URLs instead of being buffered into JS first.
- Audio assets are loaded into the internal audio stage and can be used by `sound` nodes or interaction props such as `soundSrc`. Audio remains buffer-backed because the runtime still needs decoded audio data.
- Video assets are loaded through Pixi's video loader. When possible, Route Graphics passes the original source URL directly; blob URLs are only used as a fallback for buffer-backed video inputs.
- Font assets are registered with `FontFace`; use the alias key as `textStyle.fontFamily` or as an entry in its ordered fallback array.

## Practical Notes

- The alias key is the public name you use in YAML. Keep it stable and readable.
- `assetBufferManager.load()` is cached, so calling it again with the same aliases does not refetch them.
- `assetBufferManager.getBufferMap()` may now contain a mix of URL-backed and buffer-backed entries. Images and videos prefer direct URLs when available; audio and fonts stay buffer-backed.
- `render(...)` does not fetch missing assets for you. Load before render.
- The playground preloads its built-in sample aliases for circles, sliders, audio, and video so the example templates work without extra setup.

Try the built-in examples in the [Playground](/playground/?template=sprite-demo), [video demo](/playground/?template=video-demo), and [sound demo](/playground/?template=sound-demo).
