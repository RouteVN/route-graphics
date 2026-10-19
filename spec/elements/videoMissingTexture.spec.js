import { Assets, Container, Texture, TextureSource } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addVideo } from "../../src/plugins/elements/video/addVideo.js";
import { updateVideo } from "../../src/plugins/elements/video/updateVideo.js";
import { deleteVideo } from "../../src/plugins/elements/video/deleteVideo.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";

// A video src that is not in the cache, because its file did not load or its
// texture was unloaded, shows nothing, like a sprite without a texture, and
// does not hold the render's completion.

const CACHED_SRC = "video-missing-texture-cached.mp4";
const MISSING_SRC = "video-missing-texture-missing.mp4";

const createVideo = () => {
  const video = new EventTarget();
  Object.assign(video, {
    videoWidth: 640,
    videoHeight: 360,
    currentTime: 0,
    duration: 5,
    ended: false,
    error: null,
    volume: 1,
    muted: false,
    loop: false,
    pause: vi.fn(),
    play: vi.fn(),
  });
  return video;
};

const cacheVideo = () => {
  const video = createVideo();
  const texture = new Texture({
    source: new TextureSource({ resource: video, width: 640, height: 360 }),
  });
  Assets.cache.set(CACHED_SRC, texture);
  return { video, texture };
};

const createElement = (src, overrides = {}) => ({
  id: "video-1",
  type: "video",
  src,
  x: 0,
  y: 0,
  width: 320,
  height: 180,
  loop: false,
  ...overrides,
});

// The render holds the tracker while it mounts elements, as
// RouteGraphics.renderInternal does, then releases it.
const startRender = () => {
  const events = [];
  const completionTracker = createCompletionTracker((name, payload) =>
    events.push({ name, payload }),
  );
  completionTracker.reset("state-1");
  const version = completionTracker.getVersion();
  completionTracker.track(version);
  const finish = () => {
    completionTracker.complete(version);
    completionTracker.completeIfEmpty();
    return events;
  };
  return { completionTracker, finish };
};

const AUTO_SCALE_ANIMATION = {
  id: "video-scale-auto",
  targetId: "video-1",
  type: "update",
  tween: {
    scaleX: { auto: { duration: 300, easing: "linear" } },
    scaleY: { auto: { duration: 300, easing: "linear" } },
  },
};

describe("video element with a src that is not in the cache", () => {
  afterEach(() => {
    if (Assets.cache.has(CACHED_SRC)) {
      Assets.cache.remove(CACHED_SRC);
    }
  });

  it("is added without a texture and lets the render complete", () => {
    const parent = new Container();
    const { completionTracker, finish } = startRender();

    expect(() =>
      addVideo({
        parent,
        element: createElement(MISSING_SRC),
        animations: [],
        animationBus: { dispatch: vi.fn() },
        completionTracker,
        zIndex: 0,
        signal: new AbortController().signal,
      }),
    ).not.toThrow();

    const sprite = parent.getChildByLabel("video-1");
    expect(sprite.texture).toBe(Texture.EMPTY);
    expect(finish()).toEqual([
      { name: "renderComplete", payload: { id: "state-1", aborted: false } },
    ]);
  });

  it("starts an auto scale tween without waiting for texture dimensions", () => {
    const parent = new Container();
    const animationBus = { dispatch: vi.fn() };
    const { completionTracker } = startRender();

    addVideo({
      parent,
      element: createElement(MISSING_SRC, { scaleX: 1, scaleY: 1 }),
      animations: [AUTO_SCALE_ANIMATION],
      animationBus,
      completionTracker,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    // The tween starts at once; it holds the render only while it plays.
    expect(animationBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "START" }),
    );
  });

  it("is updated to a missing src without a texture, then back to a cached src", () => {
    const { video, texture } = cacheVideo();
    const parent = new Container();
    const cachedElement = createElement(CACHED_SRC, { loop: true });
    addVideo({
      parent,
      element: cachedElement,
      animations: [],
      zIndex: 0,
    });
    const sprite = parent.getChildByLabel("video-1");
    expect(sprite.texture).toBe(texture);

    const missingElement = createElement(MISSING_SRC, { loop: true });
    const { completionTracker, finish } = startRender();
    expect(() =>
      updateVideo({
        parent,
        prevElement: cachedElement,
        nextElement: missingElement,
        animations: [],
        animationBus: { dispatch: vi.fn() },
        completionTracker,
        zIndex: 0,
      }),
    ).not.toThrow();
    expect(sprite.texture).toBe(Texture.EMPTY);
    expect(video.pause).toHaveBeenCalled();
    expect(finish()).toEqual([
      { name: "renderComplete", payload: { id: "state-1", aborted: false } },
    ]);

    video.play.mockClear();
    updateVideo({
      parent,
      prevElement: missingElement,
      nextElement: cachedElement,
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: createCompletionTracker(),
      zIndex: 0,
    });
    expect(sprite.texture).toBe(texture);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it("is deleted without destroying the shared empty texture", () => {
    const parent = new Container();
    const element = createElement(MISSING_SRC);
    addVideo({ parent, element, animations: [], zIndex: 0 });
    const sprite = parent.getChildByLabel("video-1");

    expect(() =>
      deleteVideo({ parent, element, animations: [] }),
    ).not.toThrow();

    expect(sprite.destroyed).toBe(true);
    expect(Texture.EMPTY.destroyed).toBe(false);
    expect(Texture.EMPTY.source.destroyed).toBe(false);
  });
});
