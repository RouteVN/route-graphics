import { Container } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runTextReveal: vi.fn(() => Promise.resolve()),
}));

vi.mock(
  "../../src/plugins/elements/text-revealing/textRevealingRuntime.js",
  () => ({
    runTextReveal: mocks.runTextReveal,
  }),
);

import {
  createRenderContext,
  flushDeferredMountOperations,
} from "../../src/plugins/elements/renderContext.js";
import { updateTextRevealing } from "../../src/plugins/elements/text-revealing/updateTextRevealing.js";

const createCompletionTracker = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const createElement = (overrides = {}) => ({
  id: "line-1",
  type: "text-revealing",
  x: 0,
  y: 0,
  alpha: 1,
  width: 300,
  speed: 50,
  revealEffect: "typewriter",
  content: [
    {
      text: "Original text content",
    },
  ],
  ...overrides,
});

describe("updateTextRevealing", () => {
  beforeEach(() => {
    mocks.runTextReveal.mockClear();
  });

  it("restarts reveal when position or alpha changes", async () => {
    const parent = new Container();
    const child = new Container();
    child.label = "line-1";
    parent.addChild(child);

    await updateTextRevealing({
      parent,
      prevElement: createElement(),
      nextElement: createElement({
        x: 25,
        y: 40,
        alpha: 0.5,
      }),
      animations: [],
      animationBus: { dispatch: vi.fn() },
      renderContext: createRenderContext(),
      completionTracker: createCompletionTracker(),
      zIndex: 0,
      signal: new AbortController().signal,
    });

    expect(mocks.runTextReveal).toHaveBeenCalledTimes(1);
    expect(mocks.runTextReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        playback: "autoplay",
        element: expect.objectContaining({
          x: 25,
          y: 40,
          alpha: 0.5,
          revealEffect: "typewriter",
        }),
      }),
    );
    expect(child.x).toBe(25);
    expect(child.y).toBe(40);
    expect(child.alpha).toBe(0.5);
  });

  it("restarts reveal when content changes, using paused-initial then autoplay", async () => {
    const parent = new Container();
    const child = new Container();
    child.label = "line-1";
    parent.addChild(child);
    const renderContext = createRenderContext({ suppressAnimations: true });

    await updateTextRevealing({
      parent,
      prevElement: createElement(),
      nextElement: createElement({
        content: [
          {
            text: "Updated content should restart reveal progress",
          },
        ],
      }),
      animations: [],
      animationBus: { dispatch: vi.fn() },
      renderContext,
      completionTracker: createCompletionTracker(),
      zIndex: 0,
      signal: new AbortController().signal,
    });

    expect(mocks.runTextReveal).toHaveBeenCalledTimes(1);
    expect(mocks.runTextReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        playback: "paused-initial",
      }),
    );

    flushDeferredMountOperations(renderContext);

    expect(mocks.runTextReveal).toHaveBeenCalledTimes(2);
    expect(mocks.runTextReveal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        playback: "autoplay",
      }),
    );
  });

  it("restarts reveal immediately with autoplay when animations are not suppressed", async () => {
    const parent = new Container();
    const child = new Container();
    child.label = "line-1";
    parent.addChild(child);

    await updateTextRevealing({
      parent,
      prevElement: createElement(),
      nextElement: createElement({
        content: [
          {
            text: "Updated content should restart immediately in normal runtime",
          },
        ],
      }),
      animations: [],
      animationBus: { dispatch: vi.fn() },
      renderContext: createRenderContext(),
      completionTracker: createCompletionTracker(),
      zIndex: 0,
      signal: new AbortController().signal,
    });

    expect(mocks.runTextReveal).toHaveBeenCalledTimes(1);
    expect(mocks.runTextReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        playback: "autoplay",
      }),
    );
  });

  it("resumes an unchanged in-flight reveal instead of leaving it frozen", async () => {
    const parent = new Container();
    const child = new Container();
    child.label = "line-1";
    parent.addChild(child);

    await updateTextRevealing({
      parent,
      prevElement: createElement(),
      nextElement: createElement(),
      animations: [],
      animationBus: { dispatch: vi.fn() },
      renderContext: createRenderContext(),
      completionTracker: createCompletionTracker(),
      zIndex: 0,
      signal: new AbortController().signal,
    });

    expect(mocks.runTextReveal).toHaveBeenCalledTimes(1);
    expect(mocks.runTextReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        playback: "resume",
      }),
    );
  });
});
