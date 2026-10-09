import { CanvasTextMetrics, Container, Graphics, Sprite } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { runTextReveal } from "../../src/plugins/elements/text-revealing/textRevealingRuntime.js";

const createCompletionTracker = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const createElement = (overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "revealing-underline",
      type: "text-revealing",
      x: 0,
      y: 0,
      width: 600,
      speed: 24,
      revealEffect: "typewriter",
      content: [{ text: "Underlined revealing text" }],
      textStyle: {
        fontSize: 20,
        fontFamily: "Arial",
        textDecoration: "underline",
      },
      ...overrides,
    },
  });

const runReveal = async ({ element, playback = "autoplay" } = {}) => {
  const container = new Container();
  const completionTracker = createCompletionTracker();
  const animationBus = { dispatch: vi.fn() };

  await runTextReveal({
    container,
    element,
    completionTracker,
    animationBus,
    zIndex: 0,
    signal: new AbortController().signal,
    playback,
  });

  return { container, completionTracker, animationBus };
};

const findTextObjects = (node) =>
  (node.children ?? []).flatMap((child) =>
    typeof child.text === "string" ? [child] : findTextObjects(child),
  );

const getUnderlineRects = (textObject) => {
  const underline = textObject.children.find(
    (child) => child instanceof Graphics,
  );

  return underline.context.instructions.map(({ data }) => {
    const { minX, minY, maxX, maxY } = data.path.bounds;

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });
};

const measureLineWidth = (text, style) =>
  CanvasTextMetrics.measureText(text, style).lineWidths[0];

const getContentContainer = (container, element) =>
  container.getChildByLabel(`${element.id}-content`);

const getLineContainer = (contentContainer, element, lineIndex) =>
  contentContainer.getChildByLabel(`${element.id}-line-${lineIndex}`);

const expectMaskContainsUnderline = (lineContainer) => {
  const { mask } = lineContainer;
  const textObject = findTextObjects(lineContainer)[0];
  const [rect] = getUnderlineRects(textObject);
  const left = textObject.x + rect.x;
  const right = left + rect.width;
  const top = textObject.y + rect.y;
  const bottom = top + rect.height;

  expect(mask).toBeInstanceOf(Sprite);
  expect(mask.x).toBeLessThanOrEqual(left);
  expect(mask.x + mask.width).toBeGreaterThanOrEqual(right);
  expect(mask.y).toBeLessThanOrEqual(top);
  expect(mask.y + mask.height).toBeGreaterThanOrEqual(bottom);

  return { mask, textObject, rect };
};

describe("runTextReveal text decoration", () => {
  it("underlines only the revealed prefix for a paused-initial typewriter", async () => {
    const prefixLength = "Underlined ".length;
    const element = createElement({
      initialRevealedCharacters: prefixLength,
    });
    const { container } = await runReveal({
      element,
      playback: "paused-initial",
    });
    const textObject = findTextObjects(
      getContentContainer(container, element),
    )[0];
    const fullText = element.content[0].lineParts[0].text;

    expect(textObject.text).toBe(fullText.slice(0, prefixLength));
    const [rect] = getUnderlineRects(textObject);
    expect(rect.width).toBeCloseTo(
      measureLineWidth(textObject.text, textObject.style),
      2,
    );
    expect(rect.width).toBeLessThan(
      measureLineWidth(fullText, textObject.style),
    );
    container.destroy({ children: true });
  });

  it("keeps the underline synced with the typewriter reveal through onRender", async () => {
    vi.useFakeTimers();
    const element = createElement();
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const animationBus = { dispatch: vi.fn() };

    try {
      const reveal = runTextReveal({
        container,
        element,
        completionTracker,
        animationBus,
        zIndex: 0,
        signal: new AbortController().signal,
        playback: "autoplay",
      });

      await vi.advanceTimersByTimeAsync(150);
      const textObject = findTextObjects(
        getContentContainer(container, element),
      )[0];
      const fullText = element.content[0].lineParts[0].text;

      expect(textObject.text.length).toBeGreaterThan(0);
      expect(textObject.text.length).toBeLessThan(fullText.length);

      textObject.onRender();
      let [rect] = getUnderlineRects(textObject);
      expect(rect.width).toBeCloseTo(
        measureLineWidth(textObject.text, textObject.style),
        2,
      );

      await vi.runAllTimersAsync();
      await reveal;

      expect(textObject.text).toBe(fullText);
      textObject.onRender();
      [rect] = getUnderlineRects(textObject);
      expect(rect.width).toBeCloseTo(
        measureLineWidth(textObject.text, textObject.style),
        2,
      );
      expect(completionTracker.complete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      container.destroy({ children: true });
    }
  });

  it("contains softWipe underlines within the per-line masks until the wipe finishes", async () => {
    const element = createElement({
      speed: 35,
      revealEffect: "softWipe",
      content: [{ text: "First underlined wipe\nSecond underlined wipe" }],
    });
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const animationBus = { dispatch: vi.fn() };

    await runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex: 0,
      signal: new AbortController().signal,
      playback: "autoplay",
    });

    const startAction = animationBus.dispatch.mock.calls.find(
      ([action]) => action.type === "START",
    )?.[0];
    const contentContainer = getContentContainer(container, element);

    expect(startAction?.payload).toBeDefined();

    for (const lineIndex of [0, 1]) {
      const lineContainer = getLineContainer(
        contentContainer,
        element,
        lineIndex,
      );
      const { textObject, rect } = expectMaskContainsUnderline(lineContainer);

      // The underline is authored at full line width; the mask, not the
      // geometry, performs the reveal.
      expect(rect.width).toBeCloseTo(
        measureLineWidth(textObject.text, textObject.style),
        2,
      );
    }

    startAction.payload.applyFrame(startAction.payload.duration);
    for (const lineIndex of [0, 1]) {
      expectMaskContainsUnderline(
        getLineContainer(contentContainer, element, lineIndex),
      );
    }

    startAction.payload.onCancel();
    for (const lineIndex of [0, 1]) {
      const lineContainer = getLineContainer(
        contentContainer,
        element,
        lineIndex,
      );
      const textObject = findTextObjects(lineContainer)[0];
      const [rect] = getUnderlineRects(textObject);

      expect(lineContainer.mask).toBeFalsy();
      expect(rect.width).toBeCloseTo(
        measureLineWidth(textObject.text, textObject.style),
        2,
      );
    }
    container.destroy({ children: true });
  });

  it("masks full-width underlines for a paused-initial softWipe prefix without dispatching", async () => {
    const element = createElement({
      speed: 35,
      revealEffect: "softWipe",
      content: [{ text: "First underlined wipe\nSecond underlined wipe" }],
      initialRevealedCharacters: "First underlined wipe".length,
    });
    const { container, animationBus, completionTracker } = await runReveal({
      element,
      playback: "paused-initial",
    });
    const contentContainer = getContentContainer(container, element);

    expect(animationBus.dispatch).not.toHaveBeenCalled();
    expect(completionTracker.track).not.toHaveBeenCalled();

    for (const lineIndex of [0, 1]) {
      const { textObject, rect } = expectMaskContainsUnderline(
        getLineContainer(contentContainer, element, lineIndex),
      );
      expect(rect.width).toBeCloseTo(
        measureLineWidth(textObject.text, textObject.style),
        2,
      );
    }
    container.destroy({ children: true });
  });
});
