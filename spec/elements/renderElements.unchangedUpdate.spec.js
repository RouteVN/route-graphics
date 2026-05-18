import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { renderElements } from "../../src/plugins/elements/renderElements.js";
import { rectPlugin } from "../../src/plugins/elements/rect/index.js";
import { installShaderProgressProperty } from "../../src/plugins/elements/util/shaderFilterEffect.js";

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

  it("updates an unchanged shader-filtered element to reset stale progress", () => {
    const parent = new Container();
    const child = new Container();
    child.label = "shader-rect";
    parent.addChild(child);
    installShaderProgressProperty(child);
    child.uProgress = 1;

    const element = {
      id: "shader-rect",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: "#ffffff",
      filters: [{ id: "grade", type: "shader" }],
    };

    renderElements({
      app: {},
      parent,
      prevComputedTree: [element],
      nextComputedTree: [element],
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [rectPlugin],
      signal: new AbortController().signal,
    });

    expect(child.uProgress).toBe(0);
  });
});
