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

  it("rejects duplicate IDs across nodes and effects", () => {
    expect(() =>
      normalizeAudioRenderState({
        audio: [{ id: "music", type: "audio-channel" }],
        audioEffects: [
          {
            id: "music",
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
    ).toThrow('duplicate audio render-state id "music"');
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

  it("validates volume transitions strictly", () => {
    const audio = [{ id: "music", type: "audio-channel" }];

    expect(() =>
      normalizeAudioRenderState({
        audio,
        audioEffects: [
          {
            id: "fade",
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

    expect(() =>
      normalizeAudioRenderState({
        audio,
        audioEffects: [
          {
            id: "fade",
            type: "audioTransition",
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
            type: "audioTransition",
            targetId: "music",
            properties: {
              pan: {
                update: { duration: 100, easing: "linear" },
              },
            },
          },
        ],
      }),
    ).toThrow('unsupported audio transition property "pan"');

    expect(() =>
      normalizeAudioRenderState({
        audio,
        audioEffects: [
          {
            id: "fade",
            type: "audioTransition",
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
});
