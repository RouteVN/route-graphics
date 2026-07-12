import { describe, expect, it } from "vitest";
import {
  flattenAudioNodes,
  normalizeAudioRenderState,
} from "../../src/util/normalizeAudio.js";

describe("normalizeAudioRenderState", () => {
  it("flattens channels and flat sounds", () => {
    const result = flattenAudioNodes([
      {
        id: "music",
        type: "audio-channel",
        volume: 80,
        children: [
          {
            id: "bgm",
            type: "sound",
            src: "theme",
            volume: 50,
          },
        ],
      },
      {
        id: "click",
        type: "sound",
        src: "click-sfx",
      },
    ]);

    expect(result.channels).toEqual([
      {
        id: "music",
        type: "audio-channel",
        volume: 80,
        muted: false,
        pan: 0,
      },
    ]);
    expect(result.sounds).toEqual([
      {
        id: "bgm",
        type: "sound",
        src: "theme",
        volume: 50,
        muted: false,
        pan: 0,
        loop: false,
        startDelayMs: 0,
        playbackRate: 1,
        startAt: 0,
        endAt: null,
        channelId: "music",
      },
      {
        id: "click",
        type: "sound",
        src: "click-sfx",
        volume: 100,
        muted: false,
        pan: 0,
        loop: false,
        startDelayMs: 0,
        playbackRate: 1,
        startAt: 0,
        endAt: null,
        channelId: null,
      },
    ]);
  });

  it("clamps audio node volumes and defaults omitted volumes to 100", () => {
    const result = flattenAudioNodes([
      {
        id: "music",
        type: "audio-channel",
        volume: 500,
        children: [
          {
            id: "bgm",
            type: "sound",
            src: "theme",
            volume: -10,
          },
        ],
      },
      {
        id: "click",
        type: "sound",
        src: "click-sfx",
      },
    ]);

    expect(result.channels[0].volume).toBe(100);
    expect(result.sounds[0].volume).toBe(0);
    expect(result.sounds[1].volume).toBe(100);
  });

  it("still rejects non-number audio node volumes", () => {
    expect(() =>
      flattenAudioNodes([
        {
          id: "sfx",
          type: "sound",
          src: "click-sfx",
          volume: "100",
        },
      ]),
    ).toThrow("audio[0].volume must be a number");
  });

  it("rejects duplicate IDs across nodes and effects", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [{ id: "music", type: "audio-channel" }],
        audioEffects: [
          {
            id: "music",
            type: "audio-transition",
            targetId: "music",
            properties: {
              volume: {
                update: { duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow('duplicate audio render-state id "music"');
  });

  it("rejects multiple audio transitions targeting the same node", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [{ id: "music", type: "audio-channel" }],
        audioEffects: [
          {
            id: "music-fade-a",
            type: "audio-transition",
            targetId: "music",
            properties: {
              volume: {
                update: { duration: 100, easing: "linear" },
              },
            },
          },
          {
            id: "music-fade-b",
            type: "audioTransition",
            targetId: "music",
            properties: {
              volume: {
                exit: { to: 0, duration: 200, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow('duplicate audio-transition targetId "music"');
  });

  it("preserves top-level custom audio plugin nodes", () => {
    const result = normalizeAudioRenderState({
      audio: [
        { id: "custom-1", type: "custom-audio", customValue: 1 },
        { id: "sfx", type: "sound", src: "click" },
      ],
    });

    expect(result.audio).toEqual([
      { id: "custom-1", type: "custom-audio", customValue: 1 },
      { id: "sfx", type: "sound", src: "click" },
    ]);
    expect(result.sounds).toHaveLength(1);
  });

  it("still rejects duplicate custom audio plugin node IDs", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [
          { id: "custom-1", type: "custom-audio" },
          { id: "custom-1", type: "sound", src: "click" },
        ],
      }),
    ).toThrow('duplicate audio render-state id "custom-1"');
  });

  it("rejects nested channels and non-sound channel children", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [
          {
            id: "music",
            type: "audio-channel",
            children: [{ id: "nested", type: "audio-channel" }],
          },
        ],
      }),
    ).toThrow("nested audio-channel nodes are not supported");

    expect(() =>
      normalizeAudioRenderState({
        audio: [
          {
            id: "music",
            type: "audio-channel",
            children: [{ id: "effect", type: "audioFilter" }],
          },
        ],
      }),
    ).toThrow('audio[0].children[0].type must be "sound"');
  });

  it("rejects removed legacy sound.delay", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [
          {
            id: "sfx",
            type: "sound",
            src: "click",
            delay: 100,
          },
        ],
      }),
    ).toThrow("audio[0].delay is not supported");
  });

  it("accepts legacy audioTransition effect type as an alias", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [{ id: "music", type: "audio-channel" }],
        audioEffects: [
          {
            id: "fade",
            type: "audioTransition",
            targetId: "music",
            properties: {
              volume: {
                update: { duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).not.toThrow();
  });

  it("validates audio transitions strictly", () => {
    const audio = [{ id: "music", type: "audio-channel" }];

    expect(() =>
      normalizeAudioRenderState({
        audio,
        audioEffects: [
          {
            id: "fade",
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

    expect(() =>
      normalizeAudioRenderState({
        audio,
        audioEffects: [
          {
            id: "fade",
            type: "audio-transition",
            targetId: "music",
            properties: {
              volume: {
                update: { duration: 100 },
              },
            },
          },
        ],
      }),
    ).toThrow("audioEffects[0].properties.volume.update.easing is required");

    expect(() =>
      normalizeAudioRenderState({
        audio,
        audioEffects: [
          {
            id: "fade",
            type: "audio-transition",
            targetId: "music",
            properties: {
              playbackRate: {
                update: { duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow(
      'audio transition property "playbackRate" is not supported for target type "audio-channel"',
    );

    expect(() =>
      normalizeAudioRenderState({
        audio,
        audioEffects: [
          {
            id: "fade",
            type: "audio-transition",
            targetId: "music",
            properties: {
              volume: {
                enter: { from: 0, to: 50, duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow('unsupported audio transition field "to"');
  });

  it("accepts pan and sound playback-rate transitions", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [
          { id: "music", type: "audio-channel" },
          { id: "bgm", type: "sound", src: "theme" },
        ],
        audioEffects: [
          {
            id: "music-pan",
            type: "audio-transition",
            targetId: "music",
            properties: {
              pan: {
                enter: { from: -1, duration: 100, easing: "linear" },
              },
            },
          },
          {
            id: "bgm-controls",
            type: "audio-transition",
            targetId: "bgm",
            properties: {
              pan: {
                exit: { to: 1, duration: 100, easing: "linear" },
              },
              playbackRate: {
                update: { duration: 200, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).not.toThrow();
  });

  it("validates pan and playback-rate transition ranges", () => {
    const sound = [{ id: "bgm", type: "sound", src: "theme" }];

    expect(() =>
      normalizeAudioRenderState({
        audio: sound,
        audioEffects: [
          {
            id: "bad-pan",
            type: "audio-transition",
            targetId: "bgm",
            properties: {
              pan: {
                enter: { from: -2, duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow("properties.pan.enter.from must be greater than or equal to -1");

    expect(() =>
      normalizeAudioRenderState({
        audio: sound,
        audioEffects: [
          {
            id: "bad-rate",
            type: "audio-transition",
            targetId: "bgm",
            properties: {
              playbackRate: {
                exit: { to: -1, duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow(
      "properties.playbackRate.exit.to must be greater than or equal to 0",
    );
  });
});
