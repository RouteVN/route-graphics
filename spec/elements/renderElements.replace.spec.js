import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRenderContext } from "../../src/plugins/elements/renderContext.js";

const mocks = vi.hoisted(() => ({
  runReplaceAnimation: vi.fn(),
}));

vi.mock("../../src/plugins/animations/replace/runReplaceAnimation.js", () => ({
  runReplaceAnimation: mocks.runReplaceAnimation,
}));

import { renderElements } from "../../src/plugins/elements/renderElements.js";

describe("renderElements transition handling", () => {
  beforeEach(() => {
    mocks.runReplaceAnimation.mockReset();
  });

  it("routes same-id transition animations through the transition runner", () => {
    const parent = {
      children: [],
      sortableChildren: false,
    };

    const plugin = {
      type: "rect",
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const animationBus = { dispatch: vi.fn() };
    const completionTracker = {
      getVersion: () => 3,
      track: vi.fn(),
      complete: vi.fn(),
    };

    renderElements({
      app: { renderer: { width: 1280, height: 720 } },
      parent,
      prevComputedTree: [
        {
          id: "rect1",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#ffffff",
        },
      ],
      nextComputedTree: [
        {
          id: "rect1",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#000000",
        },
      ],
      animations: [
        {
          id: "rect-transition",
          targetId: "rect1",
          type: "transition",
          mask: {
            kind: "single",
            texture: "mask-diagonal",
            progress: {
              initialValue: 0,
              keyframes: [{ duration: 500, value: 1, easing: "linear" }],
            },
          },
        },
      ],
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      elementPlugins: [plugin],
      signal: new AbortController().signal,
    });

    expect(plugin.update).not.toHaveBeenCalled();
    expect(mocks.runReplaceAnimation).toHaveBeenCalledTimes(1);
    expect(mocks.runReplaceAnimation).toHaveBeenCalledWith(
      expect.objectContaining({
        animation: expect.objectContaining({
          id: "rect-transition",
          type: "transition",
        }),
        animations: expect.any(Map),
        completionTracker,
        plugin,
      }),
    );
  });

  it("suppresses descendant transitions when render context owns the subtree", () => {
    const parent = {
      children: [],
      sortableChildren: false,
    };

    const plugin = {
      type: "rect",
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    renderElements({
      app: { renderer: { width: 1280, height: 720 } },
      parent,
      prevComputedTree: [],
      nextComputedTree: [
        {
          id: "rect1",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#000000",
        },
      ],
      animations: [
        {
          id: "rect-transition",
          targetId: "rect1",
          type: "transition",
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 300, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 3,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [plugin],
      renderContext: createRenderContext({ suppressAnimations: true }),
      signal: new AbortController().signal,
    });

    expect(plugin.add).toHaveBeenCalledTimes(1);
    expect(plugin.add).toHaveBeenCalledWith(
      expect.objectContaining({
        animations: expect.any(Map),
      }),
    );
    expect(mocks.runReplaceAnimation).not.toHaveBeenCalled();
  });
});
