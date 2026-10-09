import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeVideoFrame } from "../vt/static/videoFrameSnapshot.js";

class Video extends EventTarget {
  readyState = 4;
  duration = 3.325;
  videoWidth = 1280;
  videoHeight = 720;
  paused = false;
  seeking = false;
  time = 0;
  callbacks = new Map();
  listeners = new Set();
  steps = [];
  nextId = 0;
  pause() {
    this.steps.push("pause");
    this.paused = true;
  }
  get currentTime() {
    return this.time;
  }
  set currentTime(time) {
    this.steps.push(`seek:${time}`);
    if (this.seekError) throw this.seekError;
    this.time = time;
    this.seeking = true;
  }
  requestVideoFrameCallback(callback) {
    this.steps.push("callback");
    this.callbacks.set(++this.nextId, callback);
    return this.nextId;
  }
  cancelVideoFrameCallback(id) {
    this.callbacks.delete(id);
  }
  addEventListener(type, callback, options) {
    this.listeners.add(callback);
    super.addEventListener(type, callback, options);
  }
  removeEventListener(type, callback, options) {
    this.listeners.delete(callback);
    super.removeEventListener(type, callback, options);
  }
  seeked() {
    this.seeking = false;
    this.dispatchEvent(new Event("seeked"));
  }
  present(mediaTime) {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback(0, { mediaTime });
  }
}

const freeze = (video, rest = {}) =>
  freezeVideoFrame(video, { time: 1, framesPerSecond: 60, ...rest });
const cleaned = (video) => {
  expect(video.callbacks.size).toBe(0);
  expect(video.listeners.size).toBe(0);
  expect(video.paused).toBe(true);
};

describe("VT exact paused video frames", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pauses and registers presentation before seeking, with no playback fallback", async () => {
    const video = new Video();
    const result = freeze(video);
    expect(video.steps).toEqual(["pause", "callback", "seek:1"]);
    video.seeked();
    video.present(1);
    await expect(result).resolves.toEqual({ targetTime: 1, mediaTime: 1 });
    cleaned(video);
  });

  it("does not treat decoded readyState and seeked alone as presentation", async () => {
    const video = new Video();
    const result = expect(freeze(video)).rejects.toThrow("Timed out");
    video.seeked();
    await vi.advanceTimersByTimeAsync(8000);
    await result;
    cleaned(video);
  });

  it("rejects a stale queued frame and waits for the requested frame", async () => {
    const video = new Video();
    const result = freeze(video);
    video.present(0.5);
    expect(video.callbacks.size).toBe(1);
    video.seeked();
    video.present(1);
    await expect(result).resolves.toEqual({ targetTime: 1, mediaTime: 1 });
    cleaned(video);
  });

  it("accepts presentation before seeked but resolves only after both", async () => {
    const video = new Video();
    let settled = false;
    const result = freeze(video).then((frame) => {
      settled = true;
      return frame;
    });
    video.present(1);
    await Promise.resolve();
    expect(settled).toBe(false);
    video.seeked();
    await expect(result).resolves.toEqual({ targetTime: 1, mediaTime: 1 });
    cleaned(video);
  });

  it("a late callback cannot advance the paused media clock", async () => {
    const video = new Video();
    const result = freeze(video);
    video.seeked();
    await vi.advanceTimersByTimeAsync(2200);
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(1);
    video.present(1);
    await expect(result).resolves.toEqual({ targetTime: 1, mediaTime: 1 });
    cleaned(video);
  });

  it.each([
    [0, 0, 0],
    [-1, 0, 0],
    [99, 3.325 - 0.05, 3.266667],
  ])(
    "seeks %s explicitly, including current zero and end clamping",
    async (time, targetTime, mediaTime) => {
      const video = new Video();
      const result = freeze(video, { time });
      expect(video.steps.at(-1)).toBe(`seek:${targetTime}`);
      video.seeked();
      video.present(mediaTime);
      await expect(result).resolves.toEqual({ targetTime, mediaTime });
      cleaned(video);
    },
  );

  it("waits for metadata without starting playback", async () => {
    const video = new Video();
    video.readyState = 0;
    const result = freeze(video);
    expect(video.steps).toEqual(["pause"]);
    video.readyState = 4;
    video.dispatchEvent(new Event("loadedmetadata"));
    video.seeked();
    video.present(1);
    await expect(result).resolves.toEqual({ targetTime: 1, mediaTime: 1 });
    cleaned(video);
  });

  it("aborts stale requests and removes their callbacks/listeners", async () => {
    const video = new Video();
    const controller = new AbortController();
    const result = expect(
      freeze(video, { signal: controller.signal }),
    ).rejects.toThrow("superseded");
    controller.abort(new Error("superseded"));
    await result;
    cleaned(video);
  });

  it.each(["decoder", "play", "seek"])(
    "fails explicitly on %s errors",
    async (kind) => {
      const video = new Video();
      if (kind === "seek") video.seekError = new Error("seek failed");
      const result = expect(freeze(video)).rejects.toThrow();
      if (kind === "decoder") {
        video.error = { message: "decode failed" };
        video.dispatchEvent(new Event("error"));
      } else if (kind === "play") {
        video.paused = false;
        video.dispatchEvent(new Event("play"));
      }
      await result;
      cleaned(video);
    },
  );

  it("ignores a queued play event after playback was already paused", async () => {
    const video = new Video();
    const result = freeze(video);
    video.dispatchEvent(new Event("play"));
    video.seeked();
    video.present(1);
    await expect(result).resolves.toEqual({ targetTime: 1, mediaTime: 1 });
    cleaned(video);
  });

  it("does not accept a wrong decoded frame even with the right currentTime", async () => {
    const video = new Video();
    const result = expect(freeze(video)).rejects.toThrow("Timed out");
    video.seeked();
    video.present(1.083333);
    await vi.advanceTimersByTimeAsync(8000);
    await result;
    cleaned(video);
  });

  it("rejects missing presentation support and malformed timing", async () => {
    const video = new Video();
    await expect(freeze(video, { time: NaN })).rejects.toThrow("Invalid");
    await expect(freeze(video, { framesPerSecond: 0 })).rejects.toThrow(
      "Invalid",
    );
    video.requestVideoFrameCallback = undefined;
    await expect(freeze(video)).rejects.toThrow(
      "requires requestVideoFrameCallback",
    );
    expect(video.steps).toEqual([]);
  });
});
