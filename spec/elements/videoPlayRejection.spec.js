import { Assets, Container, Texture, TextureSource } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addVideo } from "../../src/plugins/elements/video/addVideo.js";
import { deleteVideo } from "../../src/plugins/elements/video/deleteVideo.js";
import { updateVideo } from "../../src/plugins/elements/video/updateVideo.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";

// A video whose play() promises the test settles. Like a browser, pause()
// interrupts a play() that has not started yet. play() is a plain function:
// a vi.fn() would handle the promises it returns.
const createVideo = () => {
  const video = document.createElement("video");
  const pendingPlays = [];
  let playCount = 0;
  const rejectPendingPlays = (name, message) => {
    for (const { reject } of pendingPlays.splice(0)) {
      reject(new DOMException(message, name));
    }
  };

  video.play = () => {
    playCount++;
    return new Promise((resolve, reject) => {
      pendingPlays.push({ resolve, reject });
    });
  };
  video.pause = () =>
    rejectPendingPlays(
      "AbortError",
      "The play() request was interrupted by a call to pause().",
    );

  return {
    video,
    getPlayCount: () => playCount,
    startPlay: () => {
      for (const { resolve } of pendingPlays.splice(0)) resolve();
    },
    refusePlay: () =>
      rejectPendingPlays(
        "NotAllowedError",
        "play() failed because the user didn't interact with the document first.",
      ),
    // A source that fails to load fires error, then rejects pending plays.
    failLoad: () => {
      video.dispatchEvent(new Event("error"));
      rejectPendingPlays(
        "NotSupportedError",
        "Failed to load because no supported source was found.",
      );
    },
  };
};

const createVideoElement = (overrides) => ({
  id: "video-1",
  type: "video",
  src: "video-a.mp4",
  x: 0,
  y: 0,
  width: 320,
  height: 180,
  loop: false,
  ...overrides,
});

// Lets settled play() promises run their handlers and Node report any
// rejection that nothing handled.
const flushPlayback = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("video play() rejection", () => {
  let root;
  let cachedSrcs;
  let unhandledRejections;
  let completionTracker;
  let onEvent;
  const onUnhandledRejection = (reason) => unhandledRejections.push(reason);

  const cacheVideo = (src, video) => {
    const texture = new Texture({
      source: new TextureSource({ resource: video, width: 640, height: 360 }),
      dynamic: true,
    });
    Assets.cache.set(src, texture);
    cachedSrcs.push(src);
  };

  // Mirrors RouteGraphics.render: reset, mount, then complete once the
  // tracked work is done.
  const render = (id, mount) => {
    completionTracker.reset(id);
    mount();
    completionTracker.completeIfEmpty();
  };

  const completedRenderIds = () =>
    onEvent.mock.calls
      .filter(
        ([event, payload]) => event === "renderComplete" && !payload.aborted,
      )
      .map(([, payload]) => payload.id);

  const mountVideo = (element) =>
    addVideo({
      parent: root,
      element,
      animations: [],
      completionTracker,
      zIndex: 0,
    });

  beforeEach(() => {
    root = new Container();
    cachedSrcs = [];
    unhandledRejections = [];
    onEvent = vi.fn();
    completionTracker = createCompletionTracker(onEvent);
    process.on("unhandledRejection", onUnhandledRejection);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandledRejection);
    root.destroy({ children: true });
    for (const src of cachedSrcs) {
      Assets.cache.get(src).destroy(true);
      Assets.cache.remove(src);
    }
  });

  it("completes the render when the browser refuses to play a new video", async () => {
    const { video, getPlayCount, refusePlay } = createVideo();
    cacheVideo("video-a.mp4", video);

    render("scene-1", () => mountVideo(createVideoElement()));
    expect(getPlayCount()).toBe(1);
    expect(completedRenderIds()).toEqual([]);

    refusePlay();
    await flushPlayback();

    expect(completedRenderIds()).toEqual(["scene-1"]);
    expect(unhandledRejections).toEqual([]);
  });

  it("completes the render when the browser refuses to play a changed source", async () => {
    const first = createVideo();
    const second = createVideo();
    cacheVideo("video-a.mp4", first.video);
    cacheVideo("video-b.mp4", second.video);
    const prevElement = createVideoElement({ loop: true });
    const nextElement = createVideoElement({ src: "video-b.mp4" });

    render("scene-1", () => mountVideo(prevElement));
    // The source change pauses the first video before its play() starts.
    render("scene-2", () =>
      updateVideo({
        parent: root,
        prevElement,
        nextElement,
        animations: [],
        completionTracker,
        zIndex: 0,
      }),
    );
    expect(second.getPlayCount()).toBe(1);

    second.refusePlay();
    await flushPlayback();

    expect(completedRenderIds()).toEqual(["scene-1", "scene-2"]);
    expect(unhandledRejections).toEqual([]);
  });

  it("ignores a play() that removing the video interrupts", async () => {
    const { video } = createVideo();
    cacheVideo("video-a.mp4", video);
    const element = createVideoElement();

    render("scene-1", () => mountVideo(element));
    render("scene-2", () =>
      deleteVideo({ parent: root, element, animations: [], completionTracker }),
    );
    await flushPlayback();

    expect(completedRenderIds()).toEqual(["scene-2"]);
    expect(unhandledRejections).toEqual([]);
  });

  it("completes every element that shows a video the browser refuses to play", async () => {
    const { video, refusePlay } = createVideo();
    cacheVideo("video-a.mp4", video);

    // Both elements share the cached video, so the second mount's pause()
    // interrupts the first play().
    render("scene-1", () => {
      mountVideo(createVideoElement({ id: "video-1" }));
      mountVideo(createVideoElement({ id: "video-2" }));
    });
    refusePlay();
    await flushPlayback();

    expect(completedRenderIds()).toEqual(["scene-1"]);
    expect(unhandledRejections).toEqual([]);
  });

  it("completes the playback of a video that fails to load only once", async () => {
    const { video, failLoad } = createVideo();
    cacheVideo("video-a.mp4", video);
    let animationVersion;

    render("scene-1", () => {
      mountVideo(createVideoElement());
      // Another element's animation that is still running.
      animationVersion = completionTracker.getVersion();
      completionTracker.track(animationVersion);
    });
    failLoad();
    await flushPlayback();

    expect(completedRenderIds()).toEqual([]);
    completionTracker.complete(animationVersion);
    expect(completedRenderIds()).toEqual(["scene-1"]);
    expect(unhandledRejections).toEqual([]);
  });

  it("keeps waiting when an interrupted play() is followed by one that starts", async () => {
    const { video, startPlay } = createVideo();
    cacheVideo("video-a.mp4", video);

    render("scene-1", () => {
      mountVideo(createVideoElement({ id: "video-1" }));
      mountVideo(createVideoElement({ id: "video-2" }));
    });
    startPlay();
    await flushPlayback();

    expect(completedRenderIds()).toEqual([]);
    video.dispatchEvent(new Event("ended"));
    expect(completedRenderIds()).toEqual(["scene-1"]);
    expect(unhandledRejections).toEqual([]);
  });

  it("keeps waiting for a video that plays until it ends", async () => {
    const { video, startPlay } = createVideo();
    cacheVideo("video-a.mp4", video);

    render("scene-1", () => mountVideo(createVideoElement()));
    startPlay();
    await flushPlayback();

    expect(completedRenderIds()).toEqual([]);
    video.dispatchEvent(new Event("ended"));
    expect(completedRenderIds()).toEqual(["scene-1"]);
    expect(unhandledRejections).toEqual([]);
  });
});
