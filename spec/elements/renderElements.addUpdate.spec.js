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

  it("returns a promise that waits for async add operations", async () => {
    const parent = new Container();
    let resolveAdd;
    const addOperation = new Promise((resolve) => {
      resolveAdd = resolve;
    });
    const plugin = {
      type: "async-test",
      add: vi.fn(() => addOperation),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const result = renderElements({
      app: { renderer: { width: 1280, height: 720 } },
      parent,
      prevComputedTree: [],
      nextComputedTree: [
        {
          id: "async-1",
          type: "async-test",
        },
      ],
      animations: [],
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

    let settled = false;
    result.then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(settled).toBe(false);

    resolveAdd();
    await result;

    expect(settled).toBe(true);
  });

  it("passes update animations to deleted elements so plugins can animate before removal", () => {
    const parent = new Container();
    const child = new Container();
    child.label = "rect-1";
    parent.addChild(child);

    const plugin = {
      type: "rect",
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    renderElements({
      app: { renderer: { width: 1280, height: 720 } },
      parent,
      prevComputedTree: [
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
      nextComputedTree: [],
      animations: [
        {
          id: "rect-exit-update",
          targetId: "rect-1",
          type: "update",
          tween: {
            alpha: {
              keyframes: [{ duration: 300, value: 0, easing: "linear" }],
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

    expect(plugin.delete).toHaveBeenCalledTimes(1);

    const { animations } = plugin.delete.mock.calls[0][0];

    expect(animations.get("rect-1")).toEqual([
      expect.objectContaining({
        id: "rect-exit-update",
        targetId: "rect-1",
        type: "update",
      }),
    ]);
  });
});
