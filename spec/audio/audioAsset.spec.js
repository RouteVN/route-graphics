import { afterEach, describe, expect, it, vi } from "vitest";

const originalAudioContext = window.AudioContext;
const originalWebkitAudioContext = window.webkitAudioContext;

const setupAudioAsset = async () => {
  vi.resetModules();

  const decodedBuffer = { decoded: true };
  const context = {
    decodeAudioData: vi.fn(() => Promise.resolve(decodedBuffer)),
  };
  const AudioContextMock = vi.fn(function AudioContextMock() {
    return context;
  });
  window.AudioContext = AudioContextMock;
  window.webkitAudioContext = undefined;

  const { AudioAsset } = await import("../../src/AudioAsset.js");

  return {
    AudioAsset,
    context,
    decodedBuffer,
  };
};

describe("AudioAsset", () => {
  afterEach(() => {
    window.AudioContext = originalAudioContext;
    window.webkitAudioContext = originalWebkitAudioContext;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("decodes and stores audio buffers during load", async () => {
    const { AudioAsset, context, decodedBuffer } = await setupAudioAsset();
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;

    await expect(AudioAsset.load("click", arrayBuffer)).resolves.toBe(
      decodedBuffer,
    );

    expect(context.decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(AudioAsset.getAsset("click")).toBe(decodedBuffer);
  });

  it("reuses an in-flight decode for duplicate load requests", async () => {
    vi.resetModules();

    let resolveDecode;
    const decodedBuffer = { decoded: true };
    const decodePromise = new Promise((resolve) => {
      resolveDecode = () => resolve(decodedBuffer);
    });
    const context = {
      decodeAudioData: vi.fn(() => decodePromise),
    };
    window.AudioContext = vi.fn(function AudioContextMock() {
      return context;
    });
    window.webkitAudioContext = undefined;

    const { AudioAsset } = await import("../../src/AudioAsset.js");
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
    const firstLoad = AudioAsset.load("click", arrayBuffer);
    const secondLoad = AudioAsset.load("click", arrayBuffer);

    expect(firstLoad).toBe(secondLoad);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);

    resolveDecode();
    await expect(firstLoad).resolves.toBe(decodedBuffer);
    expect(AudioAsset.getAsset("click")).toBe(decodedBuffer);
  });
});
