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
import { addTextRevealing } from "../../src/plugins/elements/text-revealing/addTextRevealing.js";

describe("addTextRevealing", () => {
  beforeEach(() => {
    mocks.runTextReveal.mockClear();
  });

  it("pauses reveal work during suppressed mounts and starts it after finalize", async () => {
    const parent = new Container();
    const renderContext = createRenderContext({ suppressAnimations: true });

    await addTextRevealing({
      parent,
      element: {
        id: "line-1",
        type: "text-revealing",
        x: 0,
        y: 0,
        alpha: 1,
        revealEffect: "typewriter",
        content: [],
      },
      animationBus: { dispatch: vi.fn() },
      renderContext,
      completionTracker: {
        getVersion: () => 0,
        track: vi.fn(),
        complete: vi.fn(),
      },
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
});
