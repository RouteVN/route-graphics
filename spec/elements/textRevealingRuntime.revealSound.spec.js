import { Container } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { runTextReveal } from "../../src/plugins/elements/text-revealing/textRevealingRuntime.js";

const createCompletionTracker = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const createAudioStage = () => ({
  add: vi.fn(),
  remove: vi.fn(),
  tick: vi.fn(),
});

const createElement = (overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "line-1",
      type: "text-revealing",
      width: 500,
      speed: 20,
      revealEffect: "typewriter",
      revealSound: {
        src: "voice-blip",
      },
      content: [
        {
          text: "This line reveals slowly enough for sound lifecycle coverage.",
        },
      ],
      textStyle: {
        fontSize: 20,
        fontFamily: "Arial",
        breakWords: false,
      },
      ...overrides,
    },
  });

describe("runTextReveal revealSound", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays a configured loop while typewriter text is revealing and stops on completion", async () => {
    const container = new Container();
    const audioStage = createAudioStage();
    const element = createElement({
      revealSound: {
        src: "voice-blip",
        volume: 45,
        loop: false,
      },
    });

    const reveal = runTextReveal({
      container,
      element,
      completionTracker: createCompletionTracker(),
      animationBus: { dispatch: vi.fn() },
      zIndex: 0,
      signal: new AbortController().signal,
      app: { audioStage },
      playback: "autoplay",
    });

    expect(audioStage.add).toHaveBeenCalledWith({
      id: expect.stringContaining("line-1"),
      url: "voice-blip",
      volume: 0.45,
      loop: false,
    });
    expect(audioStage.remove).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    await reveal;

    expect(audioStage.remove).toHaveBeenCalledWith(
      expect.stringContaining("line-1"),
    );
  });

  it("stops typewriter reveal sound when the reveal is aborted", async () => {
    const container = new Container();
    const audioStage = createAudioStage();
    const controller = new AbortController();
    const element = createElement();

    const reveal = runTextReveal({
      container,
      element,
      completionTracker: createCompletionTracker(),
      animationBus: { dispatch: vi.fn() },
      zIndex: 0,
      signal: controller.signal,
      app: { audioStage },
      playback: "autoplay",
    });

    expect(audioStage.add).toHaveBeenCalledTimes(1);

    controller.abort();
    await reveal;

    expect(audioStage.remove).toHaveBeenCalledWith(
      expect.stringContaining("line-1"),
    );
  });

  it("does not play sound for paused initial or instant reveal renders", async () => {
    const audioStage = createAudioStage();

    await runTextReveal({
      container: new Container(),
      element: createElement(),
      completionTracker: createCompletionTracker(),
      animationBus: { dispatch: vi.fn() },
      zIndex: 0,
      signal: new AbortController().signal,
      app: { audioStage },
      playback: "paused-initial",
    });

    await runTextReveal({
      container: new Container(),
      element: createElement({
        speed: 100,
      }),
      completionTracker: createCompletionTracker(),
      animationBus: { dispatch: vi.fn() },
      zIndex: 0,
      signal: new AbortController().signal,
      app: { audioStage },
      playback: "autoplay",
    });

    expect(audioStage.add).not.toHaveBeenCalled();
    expect(audioStage.remove).not.toHaveBeenCalled();
  });

  it("plays soft-wipe reveal sound until the animation completes", async () => {
    const container = new Container();
    const audioStage = createAudioStage();
    const animationBus = { dispatch: vi.fn() };
    const element = createElement({
      revealEffect: "softWipe",
    });

    await runTextReveal({
      container,
      element,
      completionTracker: createCompletionTracker(),
      animationBus,
      zIndex: 0,
      signal: new AbortController().signal,
      app: { audioStage },
      playback: "autoplay",
    });

    expect(audioStage.add).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "voice-blip",
        volume: 1,
        loop: true,
      }),
    );
    expect(audioStage.remove).not.toHaveBeenCalled();

    const startAction = animationBus.dispatch.mock.calls.find(
      ([action]) => action.type === "START",
    )?.[0];

    startAction.payload.onComplete();

    expect(audioStage.remove).toHaveBeenCalledWith(
      expect.stringContaining("line-1"),
    );
  });
});
