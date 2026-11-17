import { Container } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { runTextReveal } from "../../src/plugins/elements/text-revealing/textRevealingRuntime.js";

const FONT_SIZE = 20;

const createCompletionTracker = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const collectTexts = (container) => {
  const texts = [];
  const visit = (node) => {
    if (typeof node?.text === "string") texts.push(node);
    if (Array.isArray(node?.children)) node.children.forEach(visit);
  };

  visit(container);

  return texts;
};

const findIndicator = (container) =>
  container.children.find((child) => child.label?.endsWith("-indicator")) ??
  container.children[container.children.length - 1];

const createElement = (overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "vertical-line",
      type: "text-revealing",
      x: 0,
      y: 0,
      height: 60,
      writingMode: "vertical-rl",
      indicator: {
        revealing: { src: "", width: 10, height: 10 },
        complete: { src: "", width: 10, height: 10 },
        offsetX: 8,
        offsetY: 0,
      },
      content: [
        {
          text: "あいうえABC",
          textStyle: {
            fontSize: FONT_SIZE,
            lineHeight: 2,
            fontFamily: "Arial",
          },
        },
      ],
      ...overrides,
    },
  });

const reveal = async (element, playback = "autoplay") => {
  const container = new Container();

  await runTextReveal({
    container,
    element,
    completionTracker: createCompletionTracker(),
    animationBus: { dispatch: vi.fn() },
    zIndex: 0,
    signal: new AbortController().signal,
    playback,
  });

  return container;
};

describe("runTextReveal with vertical text", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders every column and turns sideways parts a quarter clockwise", async () => {
    const element = createElement({ revealEffect: "none" });
    const container = await reveal(element);
    const texts = collectTexts(container);

    expect(texts.map((text) => text.text)).toEqual([
      "あ",
      "い",
      "う",
      "え",
      "ABC",
    ]);
    expect(texts[0].rotation).toBe(0);
    expect(texts[4].rotation).toBeCloseTo(Math.PI / 2, 5);
    // First column is the right-most one.
    expect(texts[0].x).toBeGreaterThan(texts[3].x);
  });

  it("puts the complete indicator below the last character, centred on its column", async () => {
    const element = createElement({ revealEffect: "none" });
    const container = await reveal(element);
    const indicator = findIndicator(container);
    const lastChunk = element.content[element.content.length - 1];
    const lastPart = lastChunk.lineParts[lastChunk.lineParts.length - 1];

    expect(indicator.y).toBeCloseTo(lastPart.inlineEnd + 8, 5);
    expect(indicator.x + indicator.width / 2).toBeCloseTo(lastChunk.centerX, 5);
  });

  it("moves the indicator towards the next column with offsetY", async () => {
    const indicator = {
      revealing: { src: "", width: 10, height: 10 },
      complete: { src: "", width: 10, height: 10 },
      offsetX: 0,
      offsetY: 6,
    };
    const positions = {};

    for (const writingMode of ["vertical-rl", "vertical-lr"]) {
      const element = createElement({
        revealEffect: "none",
        writingMode,
        indicator,
      });
      const container = await reveal(element);
      const sprite = findIndicator(container);
      const lastChunk = element.content[element.content.length - 1];

      positions[writingMode] = sprite.x + sprite.width / 2 - lastChunk.centerX;
    }

    expect(positions["vertical-rl"]).toBeCloseTo(-6, 5);
    expect(positions["vertical-lr"]).toBeCloseTo(6, 5);
  });

  it("types down the columns one cell at a time", async () => {
    vi.useFakeTimers();

    const element = createElement({ revealEffect: "typewriter", speed: 20 });
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const finished = runTextReveal({
      container,
      element,
      completionTracker,
      animationBus: { dispatch: vi.fn() },
      zIndex: 0,
      signal: new AbortController().signal,
      playback: "autoplay",
    });
    const visibleText = () =>
      collectTexts(container)
        .map((text) => text.text)
        .join("");

    await vi.advanceTimersByTimeAsync(0);

    const first = visibleText();

    expect(first.length).toBeGreaterThan(0);
    expect("あいうえABC".startsWith(first)).toBe(true);
    expect(first.length).toBeLessThan("あいうえABC".length);

    await vi.advanceTimersByTimeAsync(60000);
    await finished;

    expect(visibleText()).toBe("あいうえABC");
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
  });

  it("keeps the revealed prefix when paused at initialRevealedCharacters", async () => {
    const element = createElement({
      revealEffect: "typewriter",
      speed: 20,
      initialRevealedCharacters: 2,
    });
    const container = await reveal(element, "paused-initial");

    expect(
      collectTexts(container)
        .map((text) => text.text)
        .join(""),
    ).toBe("あい");
  });
});
