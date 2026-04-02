import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { addInput } from "../../src/plugins/elements/input/addInput.js";
import { parseInput } from "../../src/plugins/elements/input/parseInput.js";
import { updateInput } from "../../src/plugins/elements/input/updateInput.js";

const createApp = () => {
  const bridgeState = {
    mountArgs: null,
    updateArgs: null,
  };

  const app = {
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    inputDomBridge: {
      mount: vi.fn((id, options) => {
        bridgeState.mountArgs = [id, options];
      }),
      update: vi.fn((id, options) => {
        bridgeState.updateArgs = [id, options];
      }),
      focus: vi.fn(),
      setSelection: vi.fn(),
      unmount: vi.fn(),
    },
  };

  return { app, bridgeState };
};

describe("input plugin", () => {
  it("renders a field and preserves native-edited value across unchanged rerenders", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const { app, bridgeState } = createApp();
    const initialElement = parseInput({
      state: {
        id: "name",
        type: "input",
        x: 20,
        y: 40,
        width: 200,
        height: 44,
        placeholder: "Name",
        change: {
          payload: {
            source: "input",
          },
        },
      },
    });

    addInput({
      app,
      parent,
      element: initialElement,
      eventHandler,
      zIndex: 0,
    });

    expect(app.inputDomBridge.mount).toHaveBeenCalledTimes(1);
    const inputContainer = parent.getChildByLabel("name");
    expect(inputContainer).toBeTruthy();
    expect(inputContainer.x).toBe(20);
    expect(inputContainer.y).toBe(40);
    expect(inputContainer.alpha).toBe(1);

    const mountOptions = bridgeState.mountArgs[1];
    mountOptions.callbacks.onFocus({
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      focused: true,
      composing: false,
    });
    mountOptions.callbacks.onValueChange({
      value: "native text",
      selectionStart: 11,
      selectionEnd: 11,
      focused: true,
      composing: false,
    });

    expect(eventHandler).toHaveBeenCalledWith(
      "change",
      expect.objectContaining({
        _event: expect.objectContaining({
          id: "name",
          value: "native text",
        }),
      }),
    );

    updateInput({
      app,
      parent,
      prevElement: initialElement,
      nextElement: parseInput({
        state: {
          id: "name",
          type: "input",
          x: 20,
          y: 40,
          width: 200,
          height: 44,
          placeholder: "Name",
          value: "",
        },
      }),
      eventHandler,
      zIndex: 0,
    });

    expect(app.inputDomBridge.update).toHaveBeenCalledTimes(1);
    expect(bridgeState.updateArgs[1].value).toBe("native text");
  });

  it("emits focus only once while the field stays focused across repeated native focus callbacks", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const { app, bridgeState } = createApp();
    const element = parseInput({
      state: {
        id: "name",
        type: "input",
        x: 20,
        y: 40,
        width: 200,
        height: 44,
        focusEvent: {
          payload: {
            source: "input",
          },
        },
      },
    });

    addInput({
      app,
      parent,
      element,
      eventHandler,
      zIndex: 0,
    });

    const { callbacks } = bridgeState.mountArgs[1];

    callbacks.onFocus({
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      focused: true,
      composing: false,
    });
    callbacks.onFocus({
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      focused: true,
      composing: false,
    });

    expect(
      eventHandler.mock.calls.filter(([eventName]) => eventName === "focus"),
    ).toHaveLength(1);
  });

  it("passes multiline fields through to the DOM bridge and updates their transform", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const { app, bridgeState } = createApp();
    const initialElement = parseInput({
      state: {
        id: "bio",
        type: "input",
        x: 12,
        y: 18,
        width: 220,
        height: 80,
        multiline: true,
        value: "Line 1\nLine 2",
      },
    });

    addInput({
      app,
      parent,
      element: initialElement,
      eventHandler,
      zIndex: 2,
    });

    expect(bridgeState.mountArgs[1].multiline).toBe(true);
    expect(parent.getChildByLabel("bio").y).toBe(18);

    updateInput({
      app,
      parent,
      prevElement: initialElement,
      nextElement: parseInput({
        state: {
          id: "bio",
          type: "input",
          x: 32,
          y: 28,
          width: 220,
          height: 80,
          multiline: true,
          value: "Line 1\nLine 2",
          alpha: 0.5,
        },
      }),
      eventHandler,
      zIndex: 3,
    });

    const updatedContainer = parent.getChildByLabel("bio");
    expect(updatedContainer.x).toBe(32);
    expect(updatedContainer.y).toBe(28);
    expect(updatedContainer.alpha).toBe(0.5);
    expect(bridgeState.updateArgs[1].multiline).toBe(true);
  });

  it("uses Pixi pointer input to move the caret and sync selection to the hidden DOM control", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const { app } = createApp();
    const element = parseInput({
      state: {
        id: "name",
        type: "input",
        x: 20,
        y: 40,
        width: 200,
        height: 44,
        value: "Hello",
      },
    });

    addInput({
      app,
      parent,
      element,
      eventHandler,
      zIndex: 0,
    });

    const inputContainer = parent.getChildByLabel("name");

    inputContainer.emit("pointerdown", {
      global: { x: 24, y: 52 },
      shiftKey: false,
    });

    expect(app.inputDomBridge.focus).toHaveBeenCalledWith(
      "name",
      expect.objectContaining({
        selectionStart: expect.any(Number),
        selectionEnd: expect.any(Number),
      }),
    );
    expect(app.inputDomBridge.focus).toHaveBeenCalledTimes(1);

    inputContainer.emit("globalpointermove", {
      global: { x: 120, y: 52 },
    });

    expect(app.inputDomBridge.setSelection).toHaveBeenCalledWith(
      "name",
      expect.any(Number),
      expect.any(Number),
    );

    inputContainer.emit("pointerup", {
      global: { x: 120, y: 52 },
    });
  });
});
