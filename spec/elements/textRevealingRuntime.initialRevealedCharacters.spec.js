import { Container } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { runTextReveal } from "../../src/plugins/elements/text-revealing/textRevealingRuntime.js";

const createCompletionTracker = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const getRenderedText = (container) => {
  const textParts = [];
  const visit = (node) => {
    if (typeof node?.text === "string") {
      textParts.push(node.text);
    }

    if (Array.isArray(node?.children)) {
      node.children.forEach(visit);
    }
  };

  visit(container);

  return textParts.join("");
};

const createTextRevealingElement = (overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "line-1",
      type: "text-revealing",
      x: 0,
      y: 0,
      width: 600,
      speed: 24,
      revealEffect: "typewriter",
      content: [{ text: "Already visible, then continue from there." }],
      textStyle: {
        fontSize: 20,
        fontFamily: "Arial",
        breakWords: false,
      },
      ...overrides,
    },
  });

const runReveal = async ({ element, playback = "autoplay", signal } = {}) => {
  const container = new Container();
  const completionTracker = createCompletionTracker();
  const animationBus = { dispatch: vi.fn() };
  const reveal = runTextReveal({
    container,
    element,
    completionTracker,
    animationBus,
    zIndex: 0,
    signal: signal ?? new AbortController().signal,
    playback,
  });

  return {
    container,
    completionTracker,
    animationBus,
    reveal,
  };
};

const getSoftWipeStartAction = (animationBus) =>
  animationBus.dispatch.mock.calls.find(([action]) => action.type === "START")
    ?.[0];

const getLineContainer = (container, element, lineIndex = 0) =>
  container
    .getChildByLabel(`${element.id}-content`)
    .getChildByLabel(`${element.id}-line-${lineIndex}`);

describe("runTextReveal initialRevealedCharacters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefills a typewriter prefix before revealing the remaining text", async () => {
    const fullText = "Already visible, then continue from there.";
    const initialRevealedCharacters = "Already visible, ".length;
    const element = createTextRevealingElement({
      content: [{ text: fullText }],
      initialRevealedCharacters,
    });

    const { container, completionTracker, reveal } = await runReveal({
      element,
    });
    const initialText = getRenderedText(container);

    expect(initialText.startsWith(fullText.slice(0, initialRevealedCharacters)))
      .toBe(true);
    expect(initialText.length).toBeGreaterThan(initialRevealedCharacters);
    expect(initialText.length).toBeLessThan(fullText.length);

    await vi.runAllTimersAsync();
    await reveal;

    expect(getRenderedText(container)).toBe(fullText);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
  });

  it("renders only the prefix for paused-initial typewriter playback", async () => {
    const fullText = "Already visible, then wait for deferred autoplay.";
    const initialRevealedCharacters = "Already visible, ".length;
    const element = createTextRevealingElement({
      content: [{ text: fullText }],
      initialRevealedCharacters,
    });
    const { container, completionTracker, animationBus, reveal } =
      await runReveal({
        element,
        playback: "paused-initial",
      });

    await reveal;

    expect(getRenderedText(container)).toBe(
      fullText.slice(0, initialRevealedCharacters),
    );
    expect(completionTracker.track).not.toHaveBeenCalled();
    expect(completionTracker.complete).not.toHaveBeenCalled();
    expect(animationBus.dispatch).not.toHaveBeenCalled();
  });

  it("resumes typewriter progress from the runtime snapshot after an offset start", async () => {
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const animationBus = { dispatch: vi.fn() };
    const fullText = "Prefix resumes from the live snapshot, not the old offset.";
    const element = createTextRevealingElement({
      content: [{ text: fullText }],
      initialRevealedCharacters: "Prefix ".length,
    });

    const firstController = new AbortController();
    const firstReveal = runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex: 0,
      signal: firstController.signal,
      playback: "autoplay",
    });

    await vi.advanceTimersByTimeAsync(220);

    const partialText = getRenderedText(container);

    expect(partialText.length).toBeGreaterThan(
      element.initialRevealedCharacters,
    );
    expect(partialText.length).toBeLessThan(fullText.length);

    firstController.abort();
    await firstReveal;

    const resumeReveal = runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex: 0,
      signal: new AbortController().signal,
      playback: "resume",
    });

    await vi.advanceTimersByTimeAsync(60);

    expect(getRenderedText(container).length).toBeGreaterThan(
      partialText.length,
    );

    await vi.runAllTimersAsync();
    await resumeReveal;

    expect(getRenderedText(container)).toBe(fullText);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
  });

  it("starts softWipe from a shifted prefix time", async () => {
    const fullText = "Soft wipe should continue from an already visible prefix.";
    const softWipe = {
      easing: "linear",
      softness: 0,
    };
    const baseline = await runReveal({
      element: createTextRevealingElement({
        content: [{ text: fullText }],
        revealEffect: "softWipe",
        softWipe,
      }),
    });
    const shifted = await runReveal({
      element: createTextRevealingElement({
        content: [{ text: fullText }],
        revealEffect: "softWipe",
        softWipe,
        initialRevealedCharacters: "Soft wipe should continue ".length,
      }),
    });
    const baselineStart = getSoftWipeStartAction(baseline.animationBus);
    const shiftedStart = getSoftWipeStartAction(shifted.animationBus);

    expect(baselineStart?.payload).toBeDefined();
    expect(shiftedStart?.payload).toBeDefined();
    expect(shiftedStart.payload.duration).toBeLessThan(
      baselineStart.payload.duration,
    );

    baselineStart.payload.applyFrame(0);
    shiftedStart.payload.applyFrame(0);

    expect(shifted.container.children[1].x).toBeGreaterThan(
      baseline.container.children[1].x,
    );

    baselineStart.payload.onCancel();
    shiftedStart.payload.onCancel();
  });

  it("renders a paused-initial softWipe prefix without dispatching animation work", async () => {
    const fullText = "Soft wipe prefix is visible before deferred autoplay.";
    const initialRevealedCharacters = "Soft wipe prefix ".length;
    const element = createTextRevealingElement({
      content: [{ text: fullText }],
      revealEffect: "softWipe",
      softWipe: {
        easing: "linear",
        softness: 0,
      },
      initialRevealedCharacters,
    });
    const { container, completionTracker, animationBus, reveal } =
      await runReveal({
        element,
        playback: "paused-initial",
      });

    await reveal;

    expect(getRenderedText(container)).toBe(fullText);
    expect(getLineContainer(container, element).mask).toBeTruthy();
    expect(container.children[1].x).toBeGreaterThan(12);
    expect(completionTracker.track).not.toHaveBeenCalled();
    expect(completionTracker.complete).not.toHaveBeenCalled();
    expect(animationBus.dispatch).not.toHaveBeenCalled();
  });

  it("completes softWipe immediately when the offset covers all characters", async () => {
    const fullText = "Fully covered soft wipe.";
    const element = createTextRevealingElement({
      content: [{ text: fullText }],
      revealEffect: "softWipe",
      initialRevealedCharacters: fullText.length,
    });
    const { container, completionTracker, animationBus, reveal } =
      await runReveal({
        element,
      });

    await reveal;

    expect(getRenderedText(container)).toBe(fullText);
    expect(getSoftWipeStartAction(animationBus)).toBeUndefined();
    expect(completionTracker.track).toHaveBeenCalledTimes(1);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
  });
});
