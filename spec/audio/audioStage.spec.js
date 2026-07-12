import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAudioParam = (initialValue = 0) => {
  const param = {
    value: initialValue,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn((value) => {
      if (!Number.isFinite(value)) {
        throw new TypeError("AudioParam value must be finite");
      }
      param.value = value;
      return param;
    }),
    linearRampToValueAtTime: vi.fn((value) => {
      if (!Number.isFinite(value)) {
        throw new TypeError("AudioParam value must be finite");
      }
      param.value = value;
      return param;
    }),
  };
  return param;
};

const createAudioContextMock = ({ decodedBuffer = { duration: 1 } } = {}) => {
  const context = {
    currentTime: 10,
    state: "running",
    destination: { label: "destination" },
    gainNodes: [],
    pannerNodes: [],
    sources: [],
    decodeAudioData: vi.fn(() => Promise.resolve(decodedBuffer)),
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(() => {
      const node = {
        type: "gain",
        gain: createAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      context.gainNodes.push(node);
      return node;
    }),
    createStereoPanner: vi.fn(() => {
      const node = {
        type: "panner",
        pan: createAudioParam(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      context.pannerNodes.push(node);
      return node;
    }),
    createBufferSource: vi.fn(() => {
      const node = {
        type: "source",
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        playbackRate: createAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      context.sources.push(node);
      return node;
    }),
  };

  return context;
};

const setupAudioStage = async ({ assetMap = new Map() } = {}) => {
  vi.resetModules();
  const context = createAudioContextMock();
  const AudioContextMock = vi.fn(function AudioContextMock() {
    return context;
  });
  window.AudioContext = AudioContextMock;
  window.webkitAudioContext = undefined;

  const getAsset = vi.fn((src) => assetMap.get(src) ?? { src });
  vi.doMock("../../src/AudioAsset.js", () => ({
    AudioAsset: {
      getAsset,
    },
  }));

  const { createAudioStage } = await import("../../src/AudioStage.js");
  const stage = createAudioStage();

  return {
    stage,
    context,
    getAsset,
  };
};

const findSound = (stage, id) =>
  [...stage._inspect().sounds.values()].find((sound) => sound.id === id);

const findCurrentSound = (stage, id) => {
  const inspect = stage._inspect();
  const key = inspect.currentSoundKeyById.get(id);
  return inspect.sounds.get(key);
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("AudioStage graph rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.doUnmock("../../src/AudioAsset.js");
    vi.resetModules();
  });

  it("renders channels, child sounds, and flat sounds through the graph", async () => {
    const { stage, context, getAsset } = await setupAudioStage();

    stage.renderGraph({
      nextAudio: [
        {
          id: "music",
          type: "audio-channel",
          volume: 50,
          children: [
            {
              id: "bgm",
              type: "sound",
              src: "theme",
              volume: 40,
              loop: true,
            },
          ],
        },
        {
          id: "click",
          type: "sound",
          src: "click-sfx",
        },
      ],
    });

    const music = stage._inspect().channels.get("music");
    const bgm = findSound(stage, "bgm");
    const click = findSound(stage, "click");

    expect(music.gainNode.gain.value).toBe(0.5);
    expect(bgm.gainNode.gain.value).toBe(0.4);
    expect(click.gainNode.gain.value).toBe(1);
    expect(getAsset).toHaveBeenCalledWith("theme");
    expect(getAsset).toHaveBeenCalledWith("click-sfx");
    expect(context.sources).toHaveLength(2);
    expect(context.sources[0].loop).toBe(true);
    expect(context.sources[0].start).toHaveBeenCalledWith(
      context.currentTime,
      0,
    );
    expect(context.sources[0].connect).toHaveBeenCalledWith(bgm.gainNode);
    expect(bgm.gainNode.connect).toHaveBeenCalledWith(bgm.pannerNode);
    expect(bgm.pannerNode.connect).toHaveBeenCalledWith(music.gainNode);
    expect(music.gainNode.connect).toHaveBeenCalledWith(music.pannerNode);
    expect(music.pannerNode.connect).toHaveBeenCalledWith(context.destination);
  });

  it("sanitizes direct audio defaults across repeated ticks", async () => {
    const { stage } = await setupAudioStage();

    stage.add({ id: "blip", url: "message-display1", volume: Number.NaN });

    expect(() => stage.tick()).not.toThrow();
    expect(() => stage.tick()).not.toThrow();

    const blip = findCurrentSound(stage, "blip");
    expect(blip.gainNode.gain.value).toBe(1);
    expect(blip.pannerNode.pan.value).toBe(0);
    expect(blip.source.playbackRate.value).toBe(1);
  });

  it("sanitizes invalid direct audio volume before scheduling playback", async () => {
    const { stage } = await setupAudioStage();

    stage.add({ id: "sfx", url: "click", volume: Number.NaN });

    expect(() => stage.tick()).not.toThrow();
    expect(findCurrentSound(stage, "sfx").gainNode.gain.value).toBe(1);
  });

  it("resumes a suspended audio context before playback starts", async () => {
    const { stage, context } = await setupAudioStage();
    context.state = "suspended";

    stage.renderGraph({
      nextAudio: [{ id: "sfx", type: "sound", src: "click" }],
    });

    expect(context.resume).toHaveBeenCalled();
    expect(context.sources).toHaveLength(0);

    context.state = "running";
    await flushPromises();

    expect(context.sources).toHaveLength(1);
  });

  it("cancels suspended-context playback before resume resolves", async () => {
    const { stage, context, getAsset } = await setupAudioStage();
    let resolveResume;
    context.state = "suspended";
    context.resume.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResume = () => {
            context.state = "running";
            resolve();
          };
        }),
    );
    const audio = [{ id: "sfx", type: "sound", src: "click" }];

    stage.renderGraph({ nextAudio: audio });

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(0);

    stage.renderGraph({ prevAudio: audio, nextAudio: [] });
    resolveResume();
    await flushPromises();

    expect(getAsset).not.toHaveBeenCalled();
    expect(context.sources).toHaveLength(0);
  });

  it("uses one audio context for asset decode and playback", async () => {
    vi.resetModules();
    vi.doUnmock("../../src/AudioAsset.js");

    const decodedBuffer = { duration: 1.25 };
    const context = createAudioContextMock({ decodedBuffer });
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return context;
    });
    window.AudioContext = AudioContextMock;
    window.webkitAudioContext = undefined;

    const { AudioAsset } = await import("../../src/AudioAsset.js");
    const { createAudioStage } = await import("../../src/AudioStage.js");
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;

    await AudioAsset.load("theme", arrayBuffer);

    const stage = createAudioStage();
    stage.renderGraph({
      nextAudio: [{ id: "theme-sound", type: "sound", src: "theme" }],
    });

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].buffer).toBe(decodedBuffer);
  });

  it("exposes an explicit resume hook for user input unlocks", async () => {
    const { stage, context } = await setupAudioStage();
    context.state = "suspended";

    await stage.resume();

    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended audio context before scheduling delayed playback", async () => {
    const { stage, context, getAsset } = await setupAudioStage();
    context.state = "suspended";
    context.resume.mockImplementation(() => {
      context.state = "running";
      return Promise.resolve();
    });

    stage.renderGraph({
      nextAudio: [
        {
          id: "sfx",
          type: "sound",
          src: "click",
          startDelayMs: 100,
        },
      ],
    });

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(getAsset).not.toHaveBeenCalled();

    await flushPromises();
    vi.advanceTimersByTime(100);

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(getAsset).toHaveBeenCalledWith("click");
  });

  it("applies enter, update, and exit volume transitions", async () => {
    const { stage, context } = await setupAudioStage();
    const firstAudio = [
      {
        id: "music",
        type: "audio-channel",
        volume: 80,
        children: [{ id: "bgm", type: "sound", src: "theme" }],
      },
    ];

    stage.renderGraph({
      nextAudio: firstAudio,
      nextAudioEffects: [
        {
          id: "music-enter",
          type: "audio-transition",
          targetId: "music",
          properties: {
            volume: {
              enter: { from: 0, duration: 1000, easing: "linear" },
            },
          },
        },
      ],
    });

    const music = stage._inspect().channels.get("music");
    expect(music.gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 10);
    expect(music.gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.8,
      11,
    );

    const secondAudio = [
      {
        id: "music",
        type: "audio-channel",
        volume: 30,
        children: [{ id: "bgm", type: "sound", src: "theme" }],
      },
    ];

    stage.renderGraph({
      prevAudio: firstAudio,
      nextAudio: secondAudio,
      nextAudioEffects: [
        {
          id: "music-update",
          type: "audio-transition",
          targetId: "music",
          properties: {
            volume: {
              update: { duration: 500, easing: "linear" },
            },
          },
        },
      ],
    });

    expect(music.gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.3,
      10.5,
    );

    const bgmSource = context.sources[0];
    stage.renderGraph({
      prevAudio: secondAudio,
      nextAudio: [],
      prevAudioEffects: [
        {
          id: "music-exit",
          type: "audio-transition",
          targetId: "music",
          properties: {
            volume: {
              exit: { to: 0, duration: 1000, easing: "linear" },
            },
          },
        },
      ],
    });

    expect(music.gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      11,
    );
    expect(bgmSource.stop).toHaveBeenCalledWith(11);
  });

  it("does not cancel unchanged channel or sound volume ramps", async () => {
    const { stage } = await setupAudioStage();
    const audio = [
      {
        id: "music",
        type: "audio-channel",
        volume: 80,
        children: [{ id: "bgm", type: "sound", src: "theme", volume: 60 }],
      },
    ];

    stage.renderGraph({
      nextAudio: audio,
      nextAudioEffects: [
        {
          id: "music-enter",
          type: "audio-transition",
          targetId: "music",
          properties: {
            volume: {
              enter: { from: 0, duration: 1000, easing: "linear" },
            },
          },
        },
        {
          id: "bgm-enter",
          type: "audio-transition",
          targetId: "bgm",
          properties: {
            volume: {
              enter: { from: 0, duration: 1000, easing: "linear" },
            },
          },
        },
      ],
    });

    const music = stage._inspect().channels.get("music");
    const bgm = findCurrentSound(stage, "bgm");
    music.gainNode.gain.cancelScheduledValues.mockClear();
    music.gainNode.gain.setValueAtTime.mockClear();
    bgm.gainNode.gain.cancelScheduledValues.mockClear();
    bgm.gainNode.gain.setValueAtTime.mockClear();

    stage.renderGraph({
      prevAudio: audio,
      nextAudio: audio,
    });

    expect(music.gainNode.gain.cancelScheduledValues).not.toHaveBeenCalled();
    expect(music.gainNode.gain.setValueAtTime).not.toHaveBeenCalled();
    expect(bgm.gainNode.gain.cancelScheduledValues).not.toHaveBeenCalled();
    expect(bgm.gainNode.gain.setValueAtTime).not.toHaveBeenCalled();
  });

  it("uses a fresh channel bus when re-adding a channel that is still exiting", async () => {
    const { stage, context } = await setupAudioStage();
    const firstAudio = [
      {
        id: "music",
        type: "audio-channel",
        volume: 80,
        children: [{ id: "bgm", type: "sound", src: "track-a" }],
      },
    ];
    const nextAudio = [
      {
        id: "music",
        type: "audio-channel",
        volume: 80,
        children: [{ id: "bgm", type: "sound", src: "track-b" }],
      },
    ];

    stage.renderGraph({ nextAudio: firstAudio });
    const exitingChannel = stage._inspect().channels.get("music");
    const firstSource = context.sources[0];

    stage.renderGraph({
      prevAudio: firstAudio,
      nextAudio: [],
      prevAudioEffects: [
        {
          id: "music-exit",
          type: "audio-transition",
          targetId: "music",
          properties: {
            volume: {
              exit: { to: 0, duration: 1000, easing: "linear" },
            },
          },
        },
      ],
    });

    stage.renderGraph({
      prevAudio: [],
      nextAudio,
      nextAudioEffects: [
        {
          id: "music-enter",
          type: "audio-transition",
          targetId: "music",
          properties: {
            volume: {
              enter: { from: 0, duration: 1000, easing: "linear" },
            },
          },
        },
      ],
    });

    const activeChannel = stage._inspect().channels.get("music");
    expect(activeChannel).not.toBe(exitingChannel);
    expect(context.sources).toHaveLength(2);
    expect(firstSource.stop).toHaveBeenCalledWith(11);

    vi.advanceTimersByTime(1000);

    expect(stage._inspect().channels.get("music")).toBe(activeChannel);
    expect(findCurrentSound(stage, "bgm").src).toBe("track-b");
  });

  it("replaces same-id sounds with different sources using overlapping instances", async () => {
    const { stage, context } = await setupAudioStage();
    const firstAudio = [{ id: "bgm", type: "sound", src: "track-a" }];
    const secondAudio = [{ id: "bgm", type: "sound", src: "track-b" }];

    stage.renderGraph({ nextAudio: firstAudio });
    const firstSource = context.sources[0];

    stage.renderGraph({
      prevAudio: firstAudio,
      nextAudio: secondAudio,
      prevAudioEffects: [
        {
          id: "bgm-exit",
          type: "audio-transition",
          targetId: "bgm",
          properties: {
            volume: {
              exit: { to: 0, duration: 1000, easing: "linear" },
            },
          },
        },
      ],
      nextAudioEffects: [
        {
          id: "bgm-enter",
          type: "audio-transition",
          targetId: "bgm",
          properties: {
            volume: {
              enter: { from: 0, duration: 1000, easing: "linear" },
            },
          },
        },
      ],
    });

    expect(context.sources).toHaveLength(2);
    expect(firstSource.stop).toHaveBeenCalledWith(11);
    expect(findCurrentSound(stage, "bgm").src).toBe("track-b");
  });

  it.each([
    ["startAt", { startAt: 1 }],
    ["endAt", { endAt: 2 }],
    ["startDelayMs", { startDelayMs: 100 }],
  ])(
    "replaces same-id sounds when %s changes",
    async (_field, sourceIdentityChange) => {
      const { stage } = await setupAudioStage();
      const firstAudio = [{ id: "bgm", type: "sound", src: "track" }];
      const secondAudio = [
        {
          id: "bgm",
          type: "sound",
          src: "track",
          ...sourceIdentityChange,
        },
      ];

      stage.renderGraph({ nextAudio: firstAudio });
      const outgoing = findCurrentSound(stage, "bgm");

      stage.renderGraph({
        prevAudio: firstAudio,
        nextAudio: secondAudio,
        prevAudioEffects: [
          {
            id: "bgm-exit",
            type: "audio-transition",
            targetId: "bgm",
            properties: {
              volume: {
                exit: { to: 0, duration: 1000, easing: "linear" },
              },
            },
          },
        ],
      });

      const incoming = findCurrentSound(stage, "bgm");
      expect(incoming).not.toBe(outgoing);
      expect(stage._inspect().sounds.size).toBe(2);
      expect(outgoing.source.stop).toHaveBeenCalledWith(11);
    },
  );

  it.each([
    [
      "sound",
      "audio-channel",
      { id: "shared", type: "sound", src: "track" },
      { id: "shared", type: "audio-channel" },
    ],
    [
      "audio-channel",
      "sound",
      { id: "shared", type: "audio-channel" },
      { id: "shared", type: "sound", src: "track" },
    ],
  ])(
    "rejects changing an audio node from %s to %s",
    async (previousType, nextType, previousNode, nextNode) => {
      const { stage } = await setupAudioStage();

      expect(() =>
        stage.renderGraph({
          prevAudio: [previousNode],
          nextAudio: [nextNode],
        }),
      ).toThrow(`cannot change type from "${previousType}" to "${nextType}"`);
    },
  );

  it("reconnects continuing sounds when they move between channels", async () => {
    const { stage } = await setupAudioStage();
    const firstAudio = [
      {
        id: "music-a",
        type: "audio-channel",
        children: [{ id: "bgm", type: "sound", src: "track" }],
      },
      {
        id: "music-b",
        type: "audio-channel",
        children: [],
      },
    ];
    const secondAudio = [
      {
        id: "music-a",
        type: "audio-channel",
        children: [],
      },
      {
        id: "music-b",
        type: "audio-channel",
        children: [{ id: "bgm", type: "sound", src: "track" }],
      },
    ];

    stage.renderGraph({ nextAudio: firstAudio });
    const bgm = findCurrentSound(stage, "bgm");
    const firstChannel = stage._inspect().channels.get("music-a");
    const secondChannel = stage._inspect().channels.get("music-b");

    expect(bgm.pannerNode.connect).toHaveBeenCalledWith(firstChannel.gainNode);

    stage.renderGraph({ prevAudio: firstAudio, nextAudio: secondAudio });

    expect(bgm.pannerNode.disconnect).toHaveBeenCalled();
    expect(bgm.pannerNode.connect).toHaveBeenCalledWith(secondChannel.gainNode);
    expect(findCurrentSound(stage, "bgm")).toBe(bgm);
  });

  it("cancels pending startDelayMs playback when a sound is removed", async () => {
    const { stage, getAsset } = await setupAudioStage();
    const delayedAudio = [
      {
        id: "sfx",
        type: "sound",
        src: "click",
        startDelayMs: 100,
      },
    ];

    stage.renderGraph({ nextAudio: delayedAudio });
    expect(getAsset).not.toHaveBeenCalled();

    stage.renderGraph({
      prevAudio: delayedAudio,
      nextAudio: [],
    });

    vi.advanceTimersByTime(100);

    expect(getAsset).not.toHaveBeenCalled();
    expect(findSound(stage, "sfx")).toBeUndefined();
  });

  it("replaces pending playback when startDelayMs changes", async () => {
    const { stage, getAsset } = await setupAudioStage();
    const firstAudio = [
      {
        id: "sfx",
        type: "sound",
        src: "click",
        startDelayMs: 100,
      },
    ];
    const secondAudio = [
      {
        id: "sfx",
        type: "sound",
        src: "click",
        startDelayMs: 300,
      },
    ];
    const immediateAudio = [
      {
        id: "sfx",
        type: "sound",
        src: "click",
        startDelayMs: 0,
      },
    ];

    stage.renderGraph({ nextAudio: firstAudio });
    const firstInstance = findCurrentSound(stage, "sfx");
    vi.advanceTimersByTime(50);

    stage.renderGraph({ prevAudio: firstAudio, nextAudio: secondAudio });
    const secondInstance = findCurrentSound(stage, "sfx");
    expect(secondInstance).not.toBe(firstInstance);
    vi.advanceTimersByTime(50);
    expect(getAsset).not.toHaveBeenCalled();

    stage.renderGraph({ prevAudio: secondAudio, nextAudio: immediateAudio });
    expect(findCurrentSound(stage, "sfx")).not.toBe(secondInstance);
    expect(getAsset).toHaveBeenCalledWith("click");
  });

  it("loops bounded sound segments instead of starting them with a duration", async () => {
    const { stage, context } = await setupAudioStage();

    stage.renderGraph({
      nextAudio: [
        {
          id: "loop",
          type: "sound",
          src: "track",
          loop: true,
          startAt: 1,
          endAt: 4,
        },
      ],
    });

    const source = context.sources[0];
    expect(source.loop).toBe(true);
    expect(source.loopStart).toBe(1);
    expect(source.loopEnd).toBe(4);
    expect(source.start).toHaveBeenCalledWith(context.currentTime, 1);
    expect(source.start.mock.calls[0]).toHaveLength(2);
  });

  it("validates effects when renderGraph is called directly", async () => {
    const { stage } = await setupAudioStage();

    expect(() =>
      stage.renderGraph({
        nextAudio: [{ id: "bgm", type: "sound", src: "track" }],
        nextAudioEffects: [
          {
            id: "bad",
            type: "audio-transition",
            targetId: "missing",
            properties: {
              volume: {
                update: { duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow('targetId "missing" does not resolve');
  });
});
