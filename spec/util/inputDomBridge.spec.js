import { afterEach, describe, expect, it, vi } from "vitest";
import { createInputDomBridge } from "../../src/util/inputDomBridge.js";

const createApp = () => {
  const ticker = {
    listener: null,
    add: vi.fn((listener) => {
      ticker.listener = listener;
    }),
    remove: vi.fn((listener) => {
      if (ticker.listener === listener) {
        ticker.listener = null;
      }
    }),
  };

  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 40,
    top: 60,
    width: 200,
    height: 100,
  }));
  document.body.appendChild(canvas);

  return {
    app: {
      canvas,
      renderer: {
        width: 200,
        height: 100,
      },
      ticker,
    },
    ticker,
    canvas,
  };
};

describe("inputDomBridge", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts a native input, syncs geometry, and emits focus/value/selection events", async () => {
    const { app, ticker } = createApp();
    const bridge = createInputDomBridge({ app });
    const callbacks = {
      onFocus: vi.fn(),
      onValueChange: vi.fn(),
      onSelectionChange: vi.fn(),
      onSubmit: vi.fn(),
    };

    const input = bridge.mount("name", {
      value: "",
      placeholder: "Name",
      padding: { top: 1, right: 2, bottom: 3, left: 4 },
      textStyle: { fontSize: 18, fill: "#ffffff", align: "left" },
      getGeometry: () => ({
        x: 10,
        y: 20,
        width: 50,
        height: 25,
        visible: true,
      }),
      callbacks,
    });

    ticker.listener?.({ deltaMS: 16 });

    expect(input.style.left).toBe("50px");
    expect(input.style.top).toBe("80px");
    expect(input.style.width).toBe("50px");
    expect(input.style.height).toBe("25px");
    expect(input.style.pointerEvents).toBe("none");
    expect(input.style.opacity).toBe("0");

    input.focus();
    expect(callbacks.onFocus).toHaveBeenCalled();
    expect(input.style.pointerEvents).toBe("none");

    input.value = "abc";
    input.setSelectionRange(1, 3);
    input.dispatchEvent(new Event("input"));

    expect(callbacks.onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "abc",
        selectionStart: 1,
        selectionEnd: 3,
      }),
    );

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(callbacks.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "abc",
      }),
      expect.any(KeyboardEvent),
    );

    bridge.setSelection("name", 0, 2);
    expect(callbacks.onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionStart: 0,
        selectionEnd: 2,
      }),
    );

    bridge.destroy();
  });

  it("mounts a textarea for multiline fields and applies clip-path insets", () => {
    const { app, ticker } = createApp();
    const bridge = createInputDomBridge({ app });

    const input = bridge.mount("bio", {
      value: "line 1\nline 2",
      multiline: true,
      padding: { top: 4, right: 5, bottom: 6, left: 7 },
      textStyle: { fontSize: 16, fill: "#ffffff", align: "left" },
      getGeometry: () => ({
        x: 10,
        y: 20,
        width: 80,
        height: 40,
        visible: true,
        clipInsets: {
          top: 2,
          right: 3,
          bottom: 4,
          left: 5,
        },
      }),
      callbacks: {},
    });

    ticker.listener?.({ deltaMS: 16 });

    expect(input.tagName).toBe("TEXTAREA");
    expect(input.style.clipPath).toBe("inset(2px 3px 4px 5px)");

    bridge.destroy();
  });
});
