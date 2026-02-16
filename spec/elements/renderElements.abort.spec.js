import { Container } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderElements } from "../../src/plugins/elements/renderElements.js";

describe("renderElements abort handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prevents stale async add from mutating parent after render cancellation", async () => {
    const parent = new Container();

    const asyncPlugin = {
      type: "async-test",
      add: ({ parent: localParent, element, signal }) => {
        setTimeout(() => {
          if (signal?.aborted) return;
          const child = new Container();
          child.label = element.id;
          localParent.addChild(child);
        }, element.delay ?? 0);
      },
      update: () => {},
      delete: ({ parent: localParent, element }) => {
        const existing = localParent.getChildByLabel(element.id, true);
        if (!existing) return;
        localParent.removeChild(existing);
        existing.destroy();
      },
    };

    const commonParams = {
      app: {},
      parent,
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      eventHandler: vi.fn(),
      elementPlugins: [asyncPlugin],
    };

    const firstController = new AbortController();
    renderElements({
      ...commonParams,
      prevComputedTree: [],
      nextComputedTree: [{ id: "first", type: "async-test", delay: 20 }],
      signal: firstController.signal,
    });

    firstController.abort();

    const secondController = new AbortController();
    renderElements({
      ...commonParams,
      prevComputedTree: [{ id: "first", type: "async-test", delay: 20 }],
      nextComputedTree: [{ id: "second", type: "async-test", delay: 0 }],
      signal: secondController.signal,
    });

    await vi.advanceTimersByTimeAsync(25);

    expect(parent.getChildByLabel("first", true)).toBeNull();
    expect(parent.getChildByLabel("second", true)).toBeTruthy();
  });
});
