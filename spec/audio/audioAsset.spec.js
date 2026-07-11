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

    const decodedInput = context.decodeAudioData.mock.calls[0][0];
    expect(decodedInput).not.toBe(arrayBuffer);
    expect(new Uint8Array(decodedInput)).toEqual(new Uint8Array(arrayBuffer));
    expect(AudioAsset.getAsset("click")).toBe(decodedBuffer);
  });

  it("can reload a manager-owned buffer after decoders detach their input", async () => {
    vi.resetModules();

    const decodedBuffer = { decoded: true };
    const context = {
      decodeAudioData: vi.fn((decodeBuffer) => {
        structuredClone(decodeBuffer, { transfer: [decodeBuffer] });
        return Promise.resolve(decodedBuffer);
      }),
    };
    window.AudioContext = vi.fn(function AudioContextMock() {
      return context;
    });
    window.webkitAudioContext = undefined;
    const { AudioAsset } = await import("../../src/AudioAsset.js");
    const managerBuffer = new Uint8Array([1, 2, 3]).buffer;

    await AudioAsset.load("click", managerBuffer);
    expect(managerBuffer.byteLength).toBe(3);
    AudioAsset.unload("click");
    await AudioAsset.load("click", managerBuffer);

    expect(context.decodeAudioData).toHaveBeenCalledTimes(2);
    expect(managerBuffer.byteLength).toBe(3);
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

  it("unloads decoded audio and permits the key to be loaded again", async () => {
    const { AudioAsset, context, decodedBuffer } = await setupAudioAsset();
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;

    await AudioAsset.load("click", arrayBuffer);

    expect(AudioAsset.unload("click")).toBe(true);
    expect(AudioAsset.getAsset("click")).toBeUndefined();
    expect(AudioAsset.unload("click")).toBe(false);

    await expect(AudioAsset.load("click", arrayBuffer)).resolves.toBe(
      decodedBuffer,
    );
    expect(context.decodeAudioData).toHaveBeenCalledTimes(2);
    expect(AudioAsset.getAsset("click")).toBe(decodedBuffer);
  });

  it("does not repopulate the cache when an in-flight decode is unloaded", async () => {
    vi.resetModules();

    let resolveDecode;
    const decodedBuffer = { decoded: true };
    const context = {
      decodeAudioData: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveDecode = () => resolve(decodedBuffer);
          }),
      ),
    };
    window.AudioContext = vi.fn(function AudioContextMock() {
      return context;
    });
    window.webkitAudioContext = undefined;
    const { AudioAsset } = await import("../../src/AudioAsset.js");
    const loadPromise = AudioAsset.load(
      "voice-line",
      new Uint8Array([1, 2, 3]).buffer,
    );

    expect(AudioAsset.unload("voice-line")).toBe(true);
    resolveDecode();
    await expect(loadPromise).resolves.toBe(decodedBuffer);

    expect(AudioAsset.getAsset("voice-line")).toBeUndefined();
  });

  it("rejects decode failures with asset context and root cause", async () => {
    vi.resetModules();

    const context = {
      decodeAudioData: vi.fn(() =>
        Promise.reject(new Error("unsupported codec")),
      ),
    };
    window.AudioContext = vi.fn(function AudioContextMock() {
      return context;
    });
    window.webkitAudioContext = undefined;

    const { AudioAsset } = await import("../../src/AudioAsset.js");
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;

    let thrownError;
    try {
      await AudioAsset.load("voice-line", arrayBuffer);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError?.message).toBe(
      'Could not load audio "voice-line". Unsupported or damaged audio file.',
    );
    expect(thrownError?.details).toEqual(
      expect.objectContaining({
        assetKey: "voice-line",
        assetKind: "audio",
        phase: "decode",
        cause: "unsupported codec",
      }),
    );
  });
});
