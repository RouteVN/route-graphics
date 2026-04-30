import { describe, expect, it, vi } from "vitest";
import { renderAudio } from "../../src/plugins/audio/renderAudio.js";

describe("renderAudio", () => {
  it("uses AudioStage graph rendering when available", () => {
    const app = {
      audioStage: {
        renderGraph: vi.fn(),
      },
    };
    const nextAudioTree = [
      {
        id: "music",
        type: "audio-channel",
        children: [{ id: "bgm", type: "sound", src: "theme" }],
      },
    ];
    const nextAudioEffects = [
      {
        id: "music-fade",
        type: "audioTransition",
        targetId: "music",
        properties: {
          volume: {
            enter: { from: 0, duration: 100, easing: "linear" },
          },
        },
      },
    ];

    renderAudio({
      app,
      prevAudioTree: [],
      nextAudioTree,
      prevAudioEffects: [],
      nextAudioEffects,
      audioPlugins: [],
    });

    expect(app.audioStage.renderGraph).toHaveBeenCalledWith({
      prevAudio: [],
      nextAudio: nextAudioTree,
      prevAudioEffects: [],
      nextAudioEffects,
    });
  });

  it("validates audio state before rendering", () => {
    const app = {
      audioStage: {
        renderGraph: vi.fn(),
      },
    };

    expect(() =>
      renderAudio({
        app,
        prevAudioTree: [],
        nextAudioTree: [{ id: "sfx", type: "sound", src: "click", delay: 1 }],
        audioPlugins: [],
      }),
    ).toThrow("delay is not supported");

    expect(app.audioStage.renderGraph).not.toHaveBeenCalled();
  });
});
