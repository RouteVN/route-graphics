import { describe, expect, it, vi } from "vitest";
import {
  createStageEventPayload,
  createSafeEventHandler,
  sanitizePayloadForEvent,
} from "../../src/util/eventPayloadSafety.js";

describe("event payload safety", () => {
  it("clones payload so later mutations do not leak", () => {
    const source = {
      nested: {
        value: 1,
      },
    };

    const safe = sanitizePayloadForEvent(source);
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
    const payload = createStageEventPayload("pointermove", {
      global: { x: 12, y: 34 },
      target: { label: "rect-1" },
      currentTarget: { label: "stage-root" },
      nativeEvent: { ctrlKey: true, shiftKey: false, key: "a" },
    });

    expect(payload).toEqual({
      type: "pointermove",
      id: "rect-1",
      currentId: "stage-root",
      pointerType: undefined,
      button: undefined,
      buttons: undefined,
      x: 12,
      y: 34,
      deltaX: undefined,
      deltaY: undefined,
      key: "a",
      code: undefined,
      ctrlKey: true,
      shiftKey: false,
      altKey: undefined,
      metaKey: undefined,
    });
    expect(() => structuredClone(payload)).not.toThrow();
  });
});
