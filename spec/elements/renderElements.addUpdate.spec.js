import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { renderElements } from "../../src/plugins/elements/renderElements.js";

describe("renderElements add-time update animations", () => {
  it("passes update animations to newly added non-container elements", () => {
    const parent = new Container();
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
          id: "rect-1",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#ffffff",
        },
      ],
      animations: [
        {
          id: "rect-enter-update",
          targetId: "rect-1",
          type: "update",
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 300, value: 1, easing: "linear" }],
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
      signal: new AbortController().signal,
    });

    expect(plugin.add).toHaveBeenCalledTimes(1);

    const { animations } = plugin.add.mock.calls[0][0];

    expect(animations.get("rect-1")).toEqual([
      expect.objectContaining({
        id: "rect-enter-update",
        targetId: "rect-1",
        type: "update",
      }),
    ]);
  });
});
