import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAudioParam = (initialValue = 0) => {
  const param = {
    value: initialValue,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn((value) => {
      param.value = value;
      return param;
    }),
    linearRampToValueAtTime: vi.fn((value) => {
      param.value = value;
      return param;
    }),
  };
  return param;
};

const createAudioContextMock = () => {
  const context = {
    currentTime: 10,
    state: "running",
    destination: { label: "destination" },
    gainNodes: [],
    pannerNodes: [],
    sources: [],
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

describe("AudioStage graph rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    expect(context.sources[0].start).toHaveBeenCalledWith(0, 0);
  });

  it("resumes a suspended audio context before playback starts", async () => {
    const { stage, context } = await setupAudioStage();
    context.state = "suspended";

    stage.renderGraph({
      nextAudio: [{ id: "sfx", type: "sound", src: "click" }],
    });

    expect(context.resume).toHaveBeenCalled();
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
          type: "audioTransition",
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
          type: "audioTransition",
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
          type: "audioTransition",
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
          type: "audioTransition",
          targetId: "music",
          properties: {
            volume: {
              enter: { from: 0, duration: 1000, easing: "linear" },
            },
          },
        },
        {
          id: "bgm-enter",
          type: "audioTransition",
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
          type: "audioTransition",
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
          type: "audioTransition",
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
          type: "audioTransition",
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
          type: "audioTransition",
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

  it("reschedules pending startDelayMs playback when the delay changes", async () => {
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
    vi.advanceTimersByTime(50);

    stage.renderGraph({ prevAudio: firstAudio, nextAudio: secondAudio });
    vi.advanceTimersByTime(50);
    expect(getAsset).not.toHaveBeenCalled();

    stage.renderGraph({ prevAudio: secondAudio, nextAudio: immediateAudio });
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
    expect(source.start).toHaveBeenCalledWith(0, 1);
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
            type: "audioTransition",
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
