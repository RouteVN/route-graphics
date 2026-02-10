import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSound, clearPendingSounds } from "../../src/plugins/audio/sound/addSound.js";
import { updateSound } from "../../src/plugins/audio/sound/updateSound.js";

const createMockApp = () => {
  const stageAudios = new Map();

  return {
    stageAudios,
    audioStage: {
      add: vi.fn((audio) => {
        stageAudios.set(audio.id, { ...audio });
      }),
      remove: vi.fn((id) => {
        stageAudios.delete(id);
      }),
      getById: vi.fn((id) => stageAudios.get(id)),
    },
  };
};

describe("updateSound", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearPendingSounds();
  });

  afterEach(() => {
    clearPendingSounds();
    vi.useRealTimers();
  });

  it("reschedules delayed updates instead of adding immediately", () => {
    const app = createMockApp();
    app.audioStage.add({ id: "bgm", url: "old.mp3", loop: false, volume: 0.8 });

    updateSound({
      app,
      prevElement: { id: "bgm", type: "sound", src: "old.mp3", delay: 0 },
      nextElement: {
        id: "bgm",
        type: "sound",
        src: "next.mp3",
        delay: 100,
        loop: true,
        volume: 500,
      },
    });

    expect(app.audioStage.remove).toHaveBeenCalledWith("bgm");
    expect(app.stageAudios.has("bgm")).toBe(false);

    vi.advanceTimersByTime(99);
    expect(app.stageAudios.has("bgm")).toBe(false);

    vi.advanceTimersByTime(1);
    expect(app.stageAudios.get("bgm")).toEqual({
      id: "bgm",
      url: "next.mp3",
      loop: true,
      volume: 0.5,
    });
  });

  it("promotes pending delayed sound to immediate playback when delay becomes zero", () => {
    const app = createMockApp();
    addSound({
      app,
      element: { id: "sfx", type: "sound", src: "old.mp3", delay: 100 },
    });

    updateSound({
      app,
      prevElement: { id: "sfx", type: "sound", src: "old.mp3", delay: 100 },
      nextElement: {
        id: "sfx",
        type: "sound",
        src: "new.mp3",
        delay: 0,
        loop: false,
        volume: 900,
      },
    });

    expect(app.stageAudios.get("sfx")).toEqual({
      id: "sfx",
      url: "new.mp3",
      loop: false,
      volume: 0.9,
    });

    vi.advanceTimersByTime(200);
    expect(app.audioStage.add).toHaveBeenCalledTimes(1);
  });

  it("updates existing stage audio loop and volume fields", () => {
    const app = createMockApp();
    app.audioStage.add({ id: "amb", url: "amb.mp3", loop: false, volume: 0.4 });

    updateSound({
      app,
      prevElement: { id: "amb", type: "sound", src: "amb.mp3", delay: 0 },
      nextElement: {
        id: "amb",
        type: "sound",
        src: "amb-2.mp3",
        delay: 0,
        loop: true,
        volume: 600,
      },
    });

    expect(app.stageAudios.get("amb")).toEqual({
      id: "amb",
      url: "amb-2.mp3",
      loop: true,
      volume: 0.6,
    });
  });
});
