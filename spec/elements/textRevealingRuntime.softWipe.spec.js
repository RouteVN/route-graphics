import { Container } from "pixi.js";
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
      id: "soft-wipe-line",
      type: "text-revealing",
      x: 0,
      y: 0,
      width: 500,
      speed: 35,
      revealEffect: "softWipe",
      content: [{ text: "Soft wipe runtime parameters" }],
      textStyle: {
        fontSize: 20,
        fontFamily: "Arial",
        breakWords: false,
      },
      ...overrides,
    },
  });

const runSoftWipe = async (overrides = {}) => {
  const container = new Container();
  const completionTracker = createCompletionTracker();
  const animationBus = { dispatch: vi.fn() };
  const element = createElement(overrides);

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

  return {
    container,
    element,
    completionTracker,
    animationBus,
    payload: startAction?.payload,
  };
};

const getLineContainer = (container, element, lineIndex = 0) =>
  container
    .getChildByLabel(`${element.id}-content`)
    .getChildByLabel(`${element.id}-line-${lineIndex}`);

describe("runTextReveal softWipe parameters", () => {
  it("uses direction and softness when positioning line masks", async () => {
    const left = await runSoftWipe({
      softWipe: {
        direction: "leftToRight",
        softness: 2,
      },
    });
    const right = await runSoftWipe({
      softWipe: {
        direction: "rightToLeft",
        softness: 2,
      },
    });

    const leftMask = getLineContainer(left.container, left.element).mask;
    const rightMask = getLineContainer(right.container, right.element).mask;

    expect(left.payload).toBeDefined();
    expect(right.payload).toBeDefined();
    expect(leftMask.x).toBeLessThan(rightMask.x);

    left.payload.onCancel();
    right.payload.onCancel();
  });

  it("applies easing to the indicator motion", async () => {
    const linear = await runSoftWipe({
      softWipe: {
        easing: "linear",
        softness: 0,
      },
    });
    const eased = await runSoftWipe({
      softWipe: {
        easing: "easeOutCubic",
        softness: 0,
      },
    });

    linear.payload.applyFrame(linear.payload.duration / 2);
    eased.payload.applyFrame(eased.payload.duration / 2);

    const linearIndicator = linear.container.children[1];
    const easedIndicator = eased.container.children[1];

    expect(easedIndicator.x).toBeGreaterThan(linearIndicator.x);

    linear.payload.onCancel();
    eased.payload.onCancel();
  });

  it("accounts for line delay and line overlap in total duration", async () => {
    const content = [{ text: "First soft wipe line\nSecond soft wipe line" }];
    const baseline = await runSoftWipe({ content });
    const delayed = await runSoftWipe({
      content,
      softWipe: {
        lineDelay: 250,
      },
    });
    const overlapped = await runSoftWipe({
      content,
      softWipe: {
        lineOverlap: 0.5,
      },
    });

    expect(delayed.payload.duration).toBeGreaterThan(baseline.payload.duration);
    expect(overlapped.payload.duration).toBeLessThan(baseline.payload.duration);

    baseline.payload.onCancel();
    delayed.payload.onCancel();
    overlapped.payload.onCancel();
  });

  it("keeps the legacy edge width clamp when no softness override changes it", async () => {
    const result = await runSoftWipe();
    const lineContainer = getLineContainer(result.container, result.element);
    const expectedEdgeWidth = Math.max(
      18,
      Math.min(64, Math.round(result.element.content[0].lineMaxHeight * 1.25)),
    );

    expect(lineContainer.mask.x).toBe(-expectedEdgeWidth);

    result.payload.onCancel();
  });
});
