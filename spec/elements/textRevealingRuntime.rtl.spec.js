import { Container } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { runTextReveal } from "../../src/plugins/elements/text-revealing/textRevealingRuntime.js";

const RLO = "‮";
const LRO = "‭";
const CONTROLS = /[‬-‮‍‏]/g;
const TEXT = "שלום Hello עולם";

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

const visibleText = (container) =>
  collectTexts(container)
    .map((text) => text.text.replace(CONTROLS, ""))
    .join("");

const findIndicator = (container) =>
  container.children.find((child) => child.label?.endsWith("-indicator")) ??
  container.children[container.children.length - 1];

const createElement = (overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "rtl-line",
      type: "text-revealing",
      x: 0,
      y: 0,
      width: 400,
      direction: "rtl",
      indicator: {
        revealing: { src: "", width: 10, height: 10 },
        complete: { src: "", width: 10, height: 10 },
        offsetX: 6,
        offsetY: 0,
      },
      content: [
        { text: TEXT, textStyle: { fontSize: 20, fontFamily: "Arial" } },
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

describe("runTextReveal with right-to-left text", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws every run in its slot with a directional override", async () => {
    const element = createElement({ revealEffect: "none" });
    const container = await reveal(element);
    const texts = collectTexts(container);
    const parts = element.content[0].lineParts;

    expect(texts.map((text) => text.text[0])).toEqual([RLO, LRO, RLO]);
    expect(visibleText(container)).toBe(TEXT);
    texts.forEach((text, index) => {
      expect(text.x).toBe(Math.round(parts[index].x));
    });
    // The first word is the right-most one and ends at the box edge.
    expect(texts[0].x).toBeGreaterThan(texts[1].x);
    expect(parts[0].x + parts[0].width).toBeCloseTo(400, 0);
  });

  it("puts the complete indicator to the left of the line", async () => {
    const element = createElement({ revealEffect: "none" });
    const container = await reveal(element);
    const indicator = findIndicator(container);
    const parts = element.content[0].lineParts;
    const lineLeft = Math.min(...parts.map((part) => part.x));

    expect(indicator.x + indicator.width).toBeCloseTo(lineLeft - 6, 0);
  });

  it("keeps the indicator clear of several left-to-right runs", async () => {
    const element = createElement({
      revealEffect: "none",
      content: [
        { text: "שלום ", textStyle: { fontSize: 20 } },
        { text: "Hello ", textStyle: { fontSize: 20, fill: "red" } },
        { text: "World", textStyle: { fontSize: 20 } },
      ],
    });
    const container = await reveal(element);
    const indicator = findIndicator(container);
    const parts = element.content[0].lineParts;
    const lineLeft = Math.min(...parts.map((part) => part.x));

    expect(parts.at(-1).x).toBeGreaterThan(lineLeft);
    expect(indicator.x + indicator.width).toBeCloseTo(lineLeft - 6, 0);
  });

  it("starts the indicator at the right edge when there is no text", async () => {
    const element = createElement({ revealEffect: "none", content: [] });
    const container = await reveal(element);
    const indicator = findIndicator(container);

    expect(indicator.x + indicator.width).toBeCloseTo(400 - 6, 0);
  });

  it("keeps a partly revealed run against its right edge", async () => {
    const element = createElement({
      revealEffect: "typewriter",
      speed: 20,
      initialRevealedCharacters: 2,
    });
    const container = await reveal(element, "paused-initial");
    const [text] = collectTexts(container);
    const [part] = element.content[0].lineParts;

    expect(visibleText(container)).toBe("של");
    expect(text.x).toBeGreaterThan(part.x);
    expect(text.x + text.width).toBeCloseTo(part.x + part.width, 0);
  });

  it("types in logical order and finishes with the whole text", async () => {
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

    await vi.advanceTimersByTimeAsync(0);

    const first = visibleText(container);

    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(TEXT.length);
    expect(TEXT.startsWith(first)).toBe(true);

    await vi.advanceTimersByTimeAsync(60000);
    await finished;

    expect(visibleText(container)).toBe(TEXT);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
  });

  it.each([10, 99])(
    "paces direction changes like one run at speed %i",
    async (speed) => {
      vi.useFakeTimers();
      const mixed = "א1ב2ג3ד4".repeat(3);
      const plain = "א".repeat(mixed.length);
      const render = (text) => {
        const container = new Container();
        const finished = runTextReveal({
          container,
          element: createElement({
            content: [{ text }],
            revealEffect: "typewriter",
            speed,
            initialRevealedCharacters: 2,
          }),
          completionTracker: createCompletionTracker(),
          animationBus: { dispatch: vi.fn() },
          zIndex: 0,
          signal: new AbortController().signal,
          playback: "autoplay",
        });
        return { container, finished };
      };
      const alternating = render(mixed);
      const single = render(plain);
      await vi.advanceTimersByTimeAsync(0);
      const first = visibleText(alternating.container);
      expect(first.length).toBeGreaterThan(2);
      expect(first.length).toBeLessThan(mixed.length);
      while (visibleText(single.container).length < plain.length) {
        const count = visibleText(single.container).length;
        expect(visibleText(alternating.container)).toBe(mixed.slice(0, count));
        await vi.advanceTimersToNextTimerAsync();
      }
      await vi.runAllTimersAsync();
      await Promise.all([alternating.finished, single.finished]);
      expect(visibleText(alternating.container)).toBe(mixed);
    },
  );
});
