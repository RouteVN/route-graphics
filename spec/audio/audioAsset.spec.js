import { afterEach, describe, expect, it, vi } from "vitest";

const originalAudioContext = window.AudioContext;
const originalWebkitAudioContext = window.webkitAudioContext;

const createOggVorbisBuffer = () => {
  return new Uint8Array([
    0x4f, 0x67, 0x67, 0x53, 0x00, 0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73,
  ]).buffer;
};

const createAudioContextMock = ({ decodeAudioData } = {}) => {
  const writtenChannels = [];
  const audioBuffer = {
    getChannelData: vi.fn((channelIndex) => {
      const channel = new Float32Array(2);
      writtenChannels[channelIndex] = channel;
      return channel;
    }),
  };
  const decodedBuffer = { decoded: true };
  const context = {
    createBuffer: vi.fn(() => audioBuffer),
    decodeAudioData:
      decodeAudioData ?? vi.fn(() => Promise.resolve(decodedBuffer)),
    writtenChannels,
  };

  const AudioContextMock = vi.fn(function AudioContextMock() {
    return context;
  });
  window.AudioContext = AudioContextMock;
  window.webkitAudioContext = undefined;

  return {
    AudioContextMock,
    audioBuffer,
    context,
    decodedBuffer,
  };
};

const mockAudioProbe = (supportValue) => {
  const originalCreateElement = document.createElement.bind(document);
  return vi
    .spyOn(document, "createElement")
    .mockImplementation((tagName, ...args) => {
      const element = originalCreateElement(tagName, ...args);
      if (tagName === "audio") {
        element.canPlayType = vi.fn(() => supportValue);
      }
      return element;
    });
};

const setupAudioAsset = async () => {
  vi.resetModules();

  const { context, decodedBuffer } = createAudioContextMock();

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

    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(new Uint8Array(context.decodeAudioData.mock.calls[0][0])).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(AudioAsset.getAsset("click")).toBe(decodedBuffer);
  });

  it("reuses an in-flight decode for duplicate load requests", async () => {
    vi.resetModules();

    let resolveDecode;
    const decodedBuffer = { decoded: true };
    const decodePromise = new Promise((resolve) => {
      resolveDecode = () => resolve(decodedBuffer);
    });
    const { context } = createAudioContextMock({
      decodeAudioData: vi.fn(() => decodePromise),
    });

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

  it("prepares the Vorbis fallback once and stores decoded PCM as an AudioBuffer", async () => {
    const decodeFile = vi.fn(async () => ({
      channelData: [new Float32Array([0.25, -0.5])],
      errors: [],
      sampleRate: 44100,
      samplesDecoded: 2,
    }));
    const reset = vi.fn(async () => {});
    const OggVorbisDecoder = vi.fn(function OggVorbisDecoder() {
      this.ready = Promise.resolve();
      this.decodeFile = decodeFile;
      this.reset = reset;
    });

    vi.doMock("@wasm-audio-decoders/ogg-vorbis", () => ({
      OggVorbisDecoder,
    }));

    mockAudioProbe("");
    const { audioBuffer, context } = createAudioContextMock({
      decodeAudioData: vi.fn(() =>
        Promise.reject(new Error("native decode failed")),
      ),
    });

    const { AudioAsset } = await import("../../src/AudioAsset.js");
    const buffer = createOggVorbisBuffer();
    const assetMap = {
      sfx: {
        buffer,
        type: "audio/ogg",
      },
    };

    await AudioAsset.prepareDecoders(assetMap);
    await AudioAsset.prepareDecoders(assetMap);
    await expect(AudioAsset.load("sfx", buffer, "audio/ogg")).resolves.toBe(
      audioBuffer,
    );

    expect(OggVorbisDecoder).toHaveBeenCalledTimes(1);
    expect(decodeFile).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(context.createBuffer).toHaveBeenCalledWith(1, 2, 44100);
    expect(context.writtenChannels[0]).toEqual(new Float32Array([0.25, -0.5]));
    expect(AudioAsset.getAsset("sfx")).toBe(audioBuffer);
  });

  it("does not import a fallback decoder when native Ogg support is reported", async () => {
    const OggVorbisDecoder = vi.fn();
    vi.doMock("@wasm-audio-decoders/ogg-vorbis", () => ({
      OggVorbisDecoder,
    }));

    mockAudioProbe("probably");
    createAudioContextMock();

    const { AudioAsset } = await import("../../src/AudioAsset.js");

    await AudioAsset.prepareDecoders({
      sfx: {
        buffer: createOggVorbisBuffer(),
        type: "audio/ogg",
      },
    });

    expect(OggVorbisDecoder).not.toHaveBeenCalled();
  });
});
