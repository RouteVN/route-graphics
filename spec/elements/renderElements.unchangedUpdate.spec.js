import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { renderElements } from "../../src/plugins/elements/renderElements.js";

describe("renderElements unchanged update hooks", () => {
  it("updates an unchanged element when the plugin requests a forced refresh", () => {
    const parent = new Container();
    const child = new Container();
    child.label = "line-1";
    parent.addChild(child);

    const plugin = {
      type: "text-revealing",
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      shouldUpdateUnchanged: vi.fn(() => true),
    };

    renderElements({
      app: {},
      parent,
      prevComputedTree: [{ id: "line-1", type: "text-revealing" }],
      nextComputedTree: [{ id: "line-1", type: "text-revealing" }],
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [plugin],
      signal: new AbortController().signal,
    });

    expect(plugin.shouldUpdateUnchanged).toHaveBeenCalledTimes(1);
    expect(plugin.update).toHaveBeenCalledTimes(1);
    expect(plugin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        prevElement: { id: "line-1", type: "text-revealing" },
        nextElement: { id: "line-1", type: "text-revealing" },
      }),
    );
  });
});
