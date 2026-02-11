import { Container } from "pixi.js";
import hotkeys from "hotkeys-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addRect } from "../../src/plugins/elements/rect/addRect.js";
import { addSprite } from "../../src/plugins/elements/sprite/addSprite.js";
import { addText } from "../../src/plugins/elements/text/addText.js";
import { addContainer } from "../../src/plugins/elements/container/addContainer.js";
import { addSlider } from "../../src/plugins/elements/slider/addSlider.js";
import { createKeyboardManager } from "../../src/util/keyboardManager.js";

const createSharedParams = () => ({
  app: {
    audioStage: {
      add: vi.fn(),
    },
  },
  animations: [],
  animationBus: {
    dispatch: vi.fn(),
  },
  completionTracker: {
    getVersion: () => 0,
    track: () => {},
    complete: () => {},
  },
});

afterEach(() => {
  hotkeys.unbind();
});

describe("event semantics", () => {
  it("rect emits hover/click/rightclick/scroll payload events", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParams();

    addRect({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      element: {
        id: "rect-1",
        type: "rect",
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        alpha: 1,
        fill: "#FFFFFF",
        hover: {
          actionPayload: { source: "hover" },
        },
        click: {
          actionPayload: { source: "click" },
        },
        rightClick: {
          actionPayload: { source: "rightclick" },
        },
        scroll: {
          up: { actionPayload: { direction: "up" } },
          down: { actionPayload: { direction: "down" } },
        },
      },
    });

    const rect = parent.getChildByLabel("rect-1");
    rect.emit("pointerover");
    rect.emit("pointerup");
    rect.emit("rightclick");
    rect.emit("wheel", { deltaY: -1 });
    rect.emit("wheel", { deltaY: 1 });

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "hover",
      "click",
      "rightclick",
      "scrollup",
      "scrolldown",
    ]);

    expect(eventHandler.mock.calls[0][1]).toMatchObject({
      _event: { id: "rect-1" },
      source: "hover",
    });
    expect(eventHandler.mock.calls[1][1]).toMatchObject({
      _event: { id: "rect-1" },
      source: "click",
    });
    expect(eventHandler.mock.calls[2][1]).toMatchObject({
      _event: { id: "rect-1" },
      source: "rightclick",
    });
    expect(eventHandler.mock.calls[3][1]).toMatchObject({
      _event: { id: "rect-1" },
      direction: "up",
    });
    expect(eventHandler.mock.calls[4][1]).toMatchObject({
      _event: { id: "rect-1" },
      direction: "down",
    });
  });

  it("rect drag emits drag-start/drag-move/drag-end with pointer payload", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParams();

    addRect({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      element: {
        id: "rect-drag",
        type: "rect",
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        alpha: 1,
        fill: "#FFFFFF",
        drag: {
          start: { actionPayload: { step: "start" } },
          move: { actionPayload: { step: "move" } },
          end: { actionPayload: { step: "end" } },
        },
      },
    });

    const rect = parent.getChildByLabel("rect-drag");
    rect.emit("pointerdown");
    rect.emit("globalpointermove", { global: { x: 320, y: 240 } });
    rect.emit("pointerup");

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "drag-start",
      "drag-move",
      "drag-end",
    ]);
    expect(eventHandler.mock.calls[1][1]).toMatchObject({
      _event: { id: "rect-drag", x: 320, y: 240 },
      step: "move",
    });
  });

  it("sprite emits hover/click/rightclick payload events", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParams();

    addSprite({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      element: {
        id: "sprite-1",
        type: "sprite",
        x: 50,
        y: 50,
        width: 120,
        height: 120,
        alpha: 1,
        hover: { actionPayload: { source: "hover" } },
        click: { actionPayload: { source: "click" } },
        rightClick: { actionPayload: { source: "rightclick" } },
      },
    });

    const sprite = parent.getChildByLabel("sprite-1");
    sprite.emit("pointerover");
    sprite.emit("pointerdown");
    sprite.emit("pointerup");
    sprite.emit("rightdown");
    sprite.emit("rightup");

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "hover",
      "click",
      "rightclick",
    ]);
    expect(eventHandler.mock.calls[2][1]).toMatchObject({
      _event: { id: "sprite-1" },
      source: "rightclick",
    });
  });

  it("text emits hover/click/rightclick payload events", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParams();

    addText({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      element: {
        id: "text-1",
        type: "text",
        x: 20,
        y: 30,
        width: 200,
        alpha: 1,
        content: "sample",
        textStyle: {
          fontSize: 20,
          fill: "#FFFFFF",
          fontFamily: "Arial",
        },
        hover: { actionPayload: { source: "hover" } },
        click: { actionPayload: { source: "click" } },
        rightClick: { actionPayload: { source: "rightclick" } },
      },
    });

    const text = parent.getChildByLabel("text-1");
    text.emit("pointerover");
    text.emit("pointerdown");
    text.emit("pointerup");
    text.emit("rightdown");
    text.emit("rightup");

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "hover",
      "click",
      "rightclick",
    ]);
    expect(eventHandler.mock.calls[0][1]).toMatchObject({
      _event: { id: "text-1" },
      source: "hover",
    });
  });

  it("container emits hover/click/rightclick payload events", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParams();

    addContainer({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      elementPlugins: [],
      signal: new AbortController().signal,
      element: {
        id: "container-1",
        type: "container",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        alpha: 1,
        children: [],
        hover: { actionPayload: { source: "hover" } },
        click: { actionPayload: { source: "click" } },
        rightClick: { actionPayload: { source: "rightclick" } },
      },
    });

    const container = parent.getChildByLabel("container-1");
    container.emit("pointerover");
    container.emit("pointerup");
    container.emit("rightclick");

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "hover",
      "click",
      "rightclick",
    ]);
  });

  it("slider emits change payload with id and value", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParams();

    addSlider({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      element: {
        id: "slider-1",
        type: "slider",
        x: 100,
        y: 100,
        width: 200,
        height: 20,
        alpha: 1,
        direction: "horizontal",
        min: 0,
        max: 100,
        step: 1,
        initialValue: 0,
        change: {
          actionPayload: { source: "drag" },
        },
      },
    });

    const slider = parent.getChildByLabel("slider-1");
    slider.emit("pointerdown", { global: { x: 280, y: 110 } });
    slider.emit("globalpointermove", { global: { x: 290, y: 110 } });
    slider.emit("pointerup");

    expect(eventHandler).toHaveBeenCalled();
    expect(eventHandler.mock.calls[0][0]).toBe("change");
    expect(eventHandler.mock.calls[0][1]).toMatchObject({
      _event: {
        id: "slider-1",
      },
      source: "drag",
    });
    expect(eventHandler.mock.calls[0][1]._event.value).toBeTypeOf("number");
  });

  it("keyboard manager emits keydown payload for registered keys", () => {
    const eventHandler = vi.fn();
    const keyboardManager = createKeyboardManager(eventHandler);

    keyboardManager.registerHotkeys({
      a: { actionPayload: { source: "A" } },
      "shift+c": { actionPayload: { source: "ShiftC" } },
    });

    hotkeys.trigger("a");
    hotkeys.trigger("shift+c");

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "keydown",
      "keydown",
    ]);
    expect(eventHandler.mock.calls[0][1]).toMatchObject({
      _event: { key: "a" },
      source: "A",
    });
    expect(eventHandler.mock.calls[1][1]).toMatchObject({
      _event: { key: "shift+c" },
      source: "ShiftC",
    });

    keyboardManager.destroy();
  });
});
