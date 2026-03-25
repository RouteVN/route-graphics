# Route Graphics

Route Graphics is a declarative 2D UI/rendering system built on PixiJS. You describe states with JSON, then Route Graphics handles element lifecycle, animations, audio, and interaction events for you.

This README stays intentionally short. The hosted docs are the source of truth for setup guides, node reference pages, events, asset loading, plugin authoring, and live examples.

## Start Here

- [Documentation](http://route-graphics.routevn.com/docs/introduction/introduction/)
- [Playground](http://route-graphics.routevn.com/playground/)
- [Tasks & Roadmap](http://route-graphics.routevn.com/tasks)

## Installation

```bash
bun install route-graphics
```

## Minimal Usage

```javascript
import createRouteGraphics, {
  createAssetBufferManager,
  textPlugin,
  rectPlugin,
  spritePlugin,
  containerPlugin,
  tweenPlugin,
  soundPlugin,
} from "route-graphics";

const assets = {
  "circle-red": { url: "/public/circle-red.png", type: "image/png" },
  "bgm-1": { url: "/public/bgm-1.mp3", type: "audio/mpeg" },
};

const assetBufferManager = createAssetBufferManager();
await assetBufferManager.load(assets);

const app = createRouteGraphics();
await app.init({
  width: 1280,
  height: 720,
  backgroundColor: 0x000000,
  plugins: {
    elements: [textPlugin, rectPlugin, spritePlugin, containerPlugin],
    animations: [tweenPlugin],
    audio: [soundPlugin],
  },
  eventHandler: (eventName, payload) => {
    console.log(eventName, payload);
  },
});

await app.loadAssets(assetBufferManager.getBufferMap());
document.body.appendChild(app.canvas);

app.render({
  id: "hello-state",
  elements: [
    {
      id: "title",
      type: "text",
      x: 40,
      y: 40,
      content: "Hello Route Graphics",
      textStyle: {
        fill: "#ffffff",
        fontSize: 36,
      },
    },
  ],
  animations: [],
  audio: [],
});
```

`createAssetBufferManager()` may keep image and video assets as direct source
URLs when possible, while audio and font assets remain buffer-backed.

For complete usage details, go to:

- [Getting Started](http://route-graphics.routevn.com/docs/introduction/getting-started/)
- [Assets & Loading](http://route-graphics.routevn.com/docs/guides/assets-loading/)
- [Events & Render Complete](http://route-graphics.routevn.com/docs/guides/events-render-complete/)
- [Custom Plugins](http://route-graphics.routevn.com/docs/guides/custom-plugins/)

## Development

```bash
# Run tests
bun run test

# Ensure VT assets are real binaries, not Git LFS pointer files
git lfs pull
git lfs checkout

# Build the local docs/playground site
cd playground
bun install
bun run build
```

The docs site and playground source live under `playground/`.

Visual regression assets under `vt/static/public` and `vt/reference` are stored in Git LFS. If those files are not checked out, VT pages will render blank and browser logs will show image/audio decode errors.

## Community

Join us on [Discord](https://discord.gg/8J9dyZSu9C) to ask questions, report bugs, and stay up to date.

## License

This project is licensed under the [MIT License](LICENSE).
