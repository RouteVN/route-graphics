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

describe("runTextReveal resume", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("continues an aborted typewriter reveal from the current character", async () => {
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const animationBus = { dispatch: vi.fn() };
    const fullText = "Resume should continue from the current character.";
    const element = parseTextRevealing({
      state: {
        id: "line-1",
        type: "text-revealing",
        width: 500,
        speed: 20,
        revealEffect: "typewriter",
        content: [{ text: fullText }],
        textStyle: {
          fontSize: 20,
          fontFamily: "Arial",
          breakWords: false,
        },
      },
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

    await vi.advanceTimersByTimeAsync(260);

    const partialText = getRenderedText(container);

    expect(partialText.length).toBeGreaterThan(1);
    expect(partialText.length).toBeLessThan(fullText.length);

    firstController.abort();
    await firstReveal;

    const resumedController = new AbortController();
    const resumedReveal = runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex: 0,
      signal: resumedController.signal,
      playback: "resume",
    });

    await vi.advanceTimersByTimeAsync(60);

    expect(getRenderedText(container).length).toBeGreaterThan(partialText.length);

    await vi.runAllTimersAsync();
    await resumedReveal;

    expect(getRenderedText(container)).toBe(fullText);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
  });
});
