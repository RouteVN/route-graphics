import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import {
  canResumeTextReveal,
  clearTextRevealingContainer,
  runTextReveal,
} from "../../src/plugins/elements/text-revealing/textRevealingRuntime.js";

const createCompletionTracker = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const createSoftWipeElement = (overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "soft-wipe-line",
      type: "text-revealing",
      width: 500,
      speed: 35,
      revealEffect: "softWipe",
      content: [{ text: "A cancelled soft wipe resumes where it stopped." }],
      textStyle: {
        fontSize: 20,
        fontFamily: "Arial",
        breakWords: false,
      },
      ...overrides,
    },
  });

const startReveal = async ({ container, element, animationBus, playback }) => {
  const completionTracker = createCompletionTracker();

  await runTextReveal({
    container,
    element,
    completionTracker,
    animationBus,
    zIndex: 0,
    signal: new AbortController().signal,
    playback,
  });
  animationBus.flush();

  return completionTracker;
};

const getWipeState = (animationBus) =>
  animationBus
    .getState()
    .animations.find(({ id }) => id === "soft-wipe-line-soft-wipe");

const getIndicatorX = (container) => container.children[1].x;

const getLineMask = (container) =>
  container
    .getChildByLabel("soft-wipe-line-content")
    .getChildByLabel("soft-wipe-line-line-0").mask;

// A render cancels every running animation that it does not continue.
const cancelForRender = (animationBus) =>
  animationBus.cancelAllExcept(new Set());

describe("runTextReveal soft wipe resume", () => {
  it("keeps the cancelled frame and resumes the wipe from it", async () => {
    const animationBus = createAnimationBus();
    const container = new Container();
    const element = createSoftWipeElement();

    await startReveal({
      container,
      element,
      animationBus,
      playback: "autoplay",
    });
    const { duration } = getWipeState(animationBus);
    animationBus.tick(duration / 2);
    const reachedX = getIndicatorX(container);

    cancelForRender(animationBus);

    expect(getLineMask(container)).toBeTruthy();
    expect(getIndicatorX(container)).toBe(reachedX);
    expect(canResumeTextReveal(container)).toBe(true);

    const resumedTracker = await startReveal({
      container,
      element,
      animationBus,
      playback: "resume",
    });

    expect(getWipeState(animationBus)).toMatchObject({
      currentTime: duration / 2,
      duration,
    });
    expect(getIndicatorX(container)).toBeCloseTo(reachedX);
    expect(resumedTracker.track).toHaveBeenCalledTimes(1);

    animationBus.tick(duration / 4);
    expect(getIndicatorX(container)).toBeGreaterThan(reachedX);

    animationBus.tick(duration);
    expect(resumedTracker.complete).toHaveBeenCalledTimes(1);
    expect(getLineMask(container)).toBeFalsy();
    expect(canResumeTextReveal(container)).toBe(false);
  });

  it("keeps the sampled time when it resumes a manually timed wipe", async () => {
    const animationBus = createAnimationBus();
    const container = new Container();
    const element = createSoftWipeElement();

    await startReveal({
      container,
      element,
      animationBus,
      playback: "autoplay",
    });
    animationBus.setTime(300);
    const sampledX = getIndicatorX(container);

    cancelForRender(animationBus);
    await startReveal({
      container,
      element,
      animationBus,
      playback: "resume",
    });
    animationBus.setTime(300);

    expect(getWipeState(animationBus).currentTime).toBe(300);
    expect(getIndicatorX(container)).toBeCloseTo(sampledX);
  });

  it("releases a cancelled wipe's masks when its container is cleared or destroyed", async () => {
    const animationBus = createAnimationBus();
    const element = createSoftWipeElement();
    const clearedContainer = new Container();
    const parent = new Container();
    const destroyedContainer = new Container();
    parent.addChild(destroyedContainer);

    for (const container of [clearedContainer, destroyedContainer]) {
      await startReveal({
        container,
        element,
        animationBus,
        playback: "autoplay",
      });
      animationBus.tick(100);
      cancelForRender(animationBus);
    }

    const clearedTexture = getLineMask(clearedContainer).texture;
    const destroyedTexture = getLineMask(destroyedContainer).texture;

    clearTextRevealingContainer(clearedContainer);
    parent.destroy({ children: true });

    expect(clearedTexture.destroyed).toBe(true);
    expect(destroyedTexture.destroyed).toBe(true);
  });

  it("does not resume a soft wipe that completed", async () => {
    const animationBus = createAnimationBus();
    const container = new Container();
    const element = createSoftWipeElement();

    await startReveal({
      container,
      element,
      animationBus,
      playback: "autoplay",
    });
    animationBus.tick(getWipeState(animationBus).duration);

    expect(canResumeTextReveal(container)).toBe(false);

    const resumedTracker = await startReveal({
      container,
      element,
      animationBus,
      playback: "resume",
    });

    expect(animationBus.getState().activeCount).toBe(0);
    expect(resumedTracker.track).not.toHaveBeenCalled();
  });

  it("does not resume a soft wipe as another reveal effect", async () => {
    const animationBus = createAnimationBus();
    const container = new Container();

    await startReveal({
      container,
      element: createSoftWipeElement(),
      animationBus,
      playback: "autoplay",
    });
    animationBus.tick(100);
    cancelForRender(animationBus);
    const frozenMask = getLineMask(container);

    const resumedTracker = await startReveal({
      container,
      element: createSoftWipeElement({ revealEffect: "typewriter" }),
      animationBus,
      playback: "resume",
    });

    expect(resumedTracker.track).not.toHaveBeenCalled();
    expect(getLineMask(container)).toBe(frozenMask);
  });

  it("marks a soft wipe with nothing to wipe as complete", async () => {
    const animationBus = createAnimationBus();
    const container = new Container();

    await startReveal({
      container,
      element: createSoftWipeElement({ content: [{ text: "" }] }),
      animationBus,
      playback: "autoplay",
    });

    expect(animationBus.getState().activeCount).toBe(0);
    expect(canResumeTextReveal(container)).toBe(false);
  });
});
