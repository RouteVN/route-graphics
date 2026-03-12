import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runReplaceAnimation: vi.fn(),
}));

vi.mock("../../src/plugins/animations/replace/runReplaceAnimation.js", () => ({
  runReplaceAnimation: mocks.runReplaceAnimation,
}));

import { renderElements } from "../../src/plugins/elements/renderElements.js";

describe("renderElements replace handling", () => {
  beforeEach(() => {
    mocks.runReplaceAnimation.mockReset();
  });

  it("routes same-id replace animations through the replace runner", () => {
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
          id: "rect-replace",
          targetId: "rect1",
          type: "replace",
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
          id: "rect-replace",
          type: "replace",
        }),
        completionTracker,
        plugin,
      }),
    );
  });
});
