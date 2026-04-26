import { beforeEach, describe, expect, it, vi } from "vitest";

const { MockBlurFilter, textureFrom } = vi.hoisted(() => {
  class HoistedMockBlurFilter {
    constructor(options = {}) {
      this.strengthX = options.strengthX ?? options.strength ?? 0;
      this.strengthY = options.strengthY ?? options.strength ?? 0;
      this.quality = options.quality ?? 4;
      this.kernelSize = options.kernelSize ?? 5;
      this.repeatEdgePixels = false;
      this.destroy = vi.fn();
    }
  }

  return {
    MockBlurFilter: HoistedMockBlurFilter,
    textureFrom: vi.fn(),
  };
});

vi.mock("pixi.js", () => ({
  BlurFilter: MockBlurFilter,
  Texture: {
    from: textureFrom,
  },
}));

import { updateVideo } from "../../src/plugins/elements/video/updateVideo.js";

const createMockVideo = () => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  pause: vi.fn(),
  play: vi.fn(),
  muted: true,
  currentTime: 0,
  volume: 0,
  loop: true,
  ended: false,
  duration: 10,
});

describe("updateVideo", () => {
  beforeEach(() => {
    textureFrom.mockReset();
  });

  it("tracks completion when a playing video becomes non-looping without changing src", () => {
    const currentVideo = createMockVideo();
    const existingEndedListener = vi.fn();
    const videoElement = {
      label: "video-1",
      texture: {
        source: {
          resource: currentVideo,
        },
      },
      _videoEndedListener: existingEndedListener,
      _playbackStateVersion: null,
      zIndex: 0,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      alpha: 1,
    };

    const completionTracker = {
      getVersion: () => 7,
      track: vi.fn(),
      complete: vi.fn(),
    };

    updateVideo({
      app: {},
      parent: {
        children: [videoElement],
      },
      prevElement: {
        id: "video-1",
        src: "video.mp4",
        loop: true,
        volume: 50,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        alpha: 1,
      },
      nextElement: {
        id: "video-1",
        src: "video.mp4",
        loop: false,
        volume: 50,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        alpha: 1,
      },
      animations: [],
      animationBus: {
        dispatch: vi.fn(),
      },
      eventHandler: vi.fn(),
      completionTracker,
      zIndex: 3,
    });

    expect(textureFrom).not.toHaveBeenCalled();
    expect(currentVideo.removeEventListener).toHaveBeenCalledWith(
      "ended",
      existingEndedListener,
    );
    expect(completionTracker.track).toHaveBeenCalledWith(7);
    expect(videoElement._playbackStateVersion).toBe(7);
    expect(currentVideo.addEventListener).toHaveBeenCalledWith(
      "ended",
      expect.any(Function),
    );
    expect(currentVideo.loop).toBe(false);
  });
});
