import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_VIDEO_ALPHA_MODE,
  VIDEO_ALPHA_MODE_PROBE_TIMEOUT_MS,
  createBoundedVideoAlphaModeDetector,
} from "./videoAlphaMode.js";

describe("createBoundedVideoAlphaModeDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the detected mode and probes once", async () => {
    const detect = vi.fn(async () => "premultiplied-alpha");
    const detectAlphaMode = createBoundedVideoAlphaModeDetector(detect);

    await expect(detectAlphaMode()).resolves.toBe("premultiplied-alpha");
    await expect(detectAlphaMode()).resolves.toBe("premultiplied-alpha");
    expect(detect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back when the probe never settles", async () => {
    const detect = vi.fn(() => new Promise(() => {}));
    const detectAlphaMode = createBoundedVideoAlphaModeDetector(detect);

    const first = detectAlphaMode();
    const concurrent = detectAlphaMode();
    await vi.advanceTimersByTimeAsync(VIDEO_ALPHA_MODE_PROBE_TIMEOUT_MS);
    await expect(first).resolves.toBe(FALLBACK_VIDEO_ALPHA_MODE);
    await expect(concurrent).resolves.toBe(FALLBACK_VIDEO_ALPHA_MODE);

    // Later videos do not wait for the timeout again.
    await expect(detectAlphaMode()).resolves.toBe(FALLBACK_VIDEO_ALPHA_MODE);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a mode detected after the timeout", async () => {
    let finishProbe;
    const detectAlphaMode = createBoundedVideoAlphaModeDetector(
      () => new Promise((resolve) => (finishProbe = resolve)),
    );

    const first = detectAlphaMode();
    await vi.advanceTimersByTimeAsync(VIDEO_ALPHA_MODE_PROBE_TIMEOUT_MS);
    await expect(first).resolves.toBe(FALLBACK_VIDEO_ALPHA_MODE);

    finishProbe("premultiplied-alpha");
    await vi.advanceTimersByTimeAsync(0);
    await expect(detectAlphaMode()).resolves.toBe("premultiplied-alpha");
  });

  it("falls back when the probe throws", async () => {
    const detectAlphaMode = createBoundedVideoAlphaModeDetector(async () => {
      throw new Error("no WebGL");
    });

    await expect(detectAlphaMode()).resolves.toBe(FALLBACK_VIDEO_ALPHA_MODE);
  });
});
