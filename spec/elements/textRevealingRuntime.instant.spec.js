import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

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

const createElement = (overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "line-1",
      type: "text-revealing",
      width: 500,
      speed: 100,
      content: [{ text: "Maximum speed should render immediately." }],
      textStyle: {
        fontSize: 20,
        fontFamily: "Arial",
        breakWords: false,
      },
      ...overrides,
    },
  });

describe("runTextReveal instant speed", () => {
  it("renders typewriter text immediately at max speed", async () => {
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const animationBus = { dispatch: vi.fn() };
    const element = createElement({
      revealEffect: "typewriter",
    });

    await runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex: 0,
      signal: new AbortController().signal,
      playback: "autoplay",
    });

    expect(getRenderedText(container)).toBe(
      "Maximum speed should render immediately.",
    );
    expect(completionTracker.track).toHaveBeenCalledTimes(1);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
    expect(animationBus.dispatch).not.toHaveBeenCalled();
  });

  it("renders softWipe text immediately at max speed without dispatching animation work", async () => {
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const animationBus = { dispatch: vi.fn() };
    const element = createElement({
      revealEffect: "softWipe",
    });

    await runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex: 0,
      signal: new AbortController().signal,
      playback: "autoplay",
    });

    expect(getRenderedText(container)).toBe(
      "Maximum speed should render immediately.",
    );
    expect(completionTracker.track).toHaveBeenCalledTimes(1);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
    expect(animationBus.dispatch).not.toHaveBeenCalled();
  });

  it("keeps speed 75 responsive without completing instantly", async () => {
    vi.useFakeTimers();

    try {
      const content = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(4);
      const container = new Container();
      const completionTracker = createCompletionTracker();
      const animationBus = { dispatch: vi.fn() };
      const element = createElement({
        width: 4000,
        speed: 75,
        revealEffect: "typewriter",
        content: [{ text: content }],
      });
      let settled = false;
      const reveal = runTextReveal({
        container,
        element,
        completionTracker,
        animationBus,
        zIndex: 0,
        signal: new AbortController().signal,
        playback: "autoplay",
      }).then((result) => {
        settled = true;
        return result;
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(getRenderedText(container).length).toBeGreaterThanOrEqual(3);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(100);

      expect(getRenderedText(container).length).toBeGreaterThanOrEqual(18);
      expect(getRenderedText(container).length).toBeLessThan(content.length);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(800);
      await reveal;

      expect(getRenderedText(container)).toBe(content);
      expect(completionTracker.track).toHaveBeenCalledTimes(1);
      expect(completionTracker.complete).toHaveBeenCalledTimes(1);
      expect(animationBus.dispatch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("batches upper-end typewriter speed so 99 completes quickly without instant rendering", async () => {
    vi.useFakeTimers();

    try {
      const content = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(6);
      const container = new Container();
      const completionTracker = createCompletionTracker();
      const animationBus = { dispatch: vi.fn() };
      const element = createElement({
        width: 4000,
        speed: 99,
        revealEffect: "typewriter",
        content: [{ text: content }],
      });
      let settled = false;
      const reveal = runTextReveal({
        container,
        element,
        completionTracker,
        animationBus,
        zIndex: 0,
        signal: new AbortController().signal,
        playback: "autoplay",
      }).then((result) => {
        settled = true;
        return result;
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(getRenderedText(container).length).toBeGreaterThanOrEqual(4);
      expect(getRenderedText(container).length).toBeLessThan(20);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(520);
      await reveal;

      expect(getRenderedText(container)).toBe(content);
      expect(completionTracker.track).toHaveBeenCalledTimes(1);
      expect(completionTracker.complete).toHaveBeenCalledTimes(1);
      expect(animationBus.dispatch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
