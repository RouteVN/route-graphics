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
});
