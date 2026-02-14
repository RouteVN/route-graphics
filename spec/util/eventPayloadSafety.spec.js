import { describe, expect, it, vi } from "vitest";
import {
  clonePayloadForEvent,
  createStageEventPayload,
  createSafeEventHandler,
} from "../../src/util/eventPayloadSafety.js";

describe("event payload safety", () => {
  it("clones payload so later mutations do not leak", () => {
    const source = {
      nested: {
        value: 1,
      },
    };

    const safe = clonePayloadForEvent(source);
    source.nested.value = 2;

    expect(safe).toEqual({
      nested: {
        value: 1,
      },
    });
  });

  it("wraps eventHandler with the same safety boundary", () => {
    const handler = vi.fn();
    const safeHandler = createSafeEventHandler(handler);

    const payload = {
      nested: {
        value: 42,
      },
    };

    safeHandler("click", payload);
    payload.nested.value = 99;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("click", {
      nested: {
        value: 42,
      },
    });
  });

  it("creates a plain stage event payload", () => {
    const circularRef = {};
    circularRef.self = circularRef;

    const payload = createStageEventPayload({
      type: "pointermove",
      pointerType: "mouse",
      button: 0,
      global: { x: 12, y: 34 },
      deltaY: 4,
      target: { label: "rect-1" },
      currentTarget: { label: "stage-root" },
      nativeEvent: { ctrlKey: true, shiftKey: false, key: "a" },
      internal: {
        circularRef,
        callback: () => {},
      },
    });

    expect(payload.type).toBe("pointermove");
    expect(payload.pointerType).toBe("mouse");
    expect(payload.button).toBe(0);
    expect(payload.global).toEqual({ x: 12, y: 34 });
    expect(payload.deltaY).toBe(4);
    expect(payload.target.label).toBe("rect-1");
    expect(payload.currentTarget.label).toBe("stage-root");
    expect(payload.nativeEvent.ctrlKey).toBe(true);
    expect(payload.internal.callback).toBeUndefined();
    expect(payload.internal.circularRef).toEqual({});
    expect(() => structuredClone(payload)).not.toThrow();
  });
});
