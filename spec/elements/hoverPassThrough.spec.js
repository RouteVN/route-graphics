import {
  Cache,
  Container,
  EventBoundary,
  FederatedPointerEvent,
  FederatedWheelEvent,
  Texture,
  TextureSource,
  updateRenderGroupTransforms,
} from "pixi.js";
import "pixi.js/events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { addRect } from "../../src/plugins/elements/rect/addRect.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";
import { addSprite } from "../../src/plugins/elements/sprite/addSprite.js";
import { parseSprite } from "../../src/plugins/elements/sprite/parseSprite.js";
import { updateSprite } from "../../src/plugins/elements/sprite/updateSprite.js";
import { addText } from "../../src/plugins/elements/text/addText.js";
import { parseText } from "../../src/plugins/elements/text/parseText.js";
import { updateText } from "../../src/plugins/elements/text/updateText.js";
import {
  installHoverPassThrough,
  isHoverOnlyInteraction,
  isHoverPassThrough,
} from "../../src/plugins/elements/util/hoverPassThrough.js";

const aliases = [];
const texture = (id, width, height) => {
  const value = new Texture({ source: new TextureSource({ width, height }) });
  Cache.set(id, value);
  aliases.push([id, value]);
  return value;
};

const registerButtonTextures = () => ({
  base: texture("button-base", 960, 540),
  hover: texture("button-hover", 480, 270),
  press: texture("button-press", 64, 96),
});

afterEach(() => {
  for (const [id, value] of aliases.splice(0)) {
    Cache.remove(id);
    value.destroy(true);
  }
});

const PARSERS = { rect: parseRect, sprite: parseSprite, text: parseText };
const ADDERS = { rect: addRect, sprite: addSprite, text: addText };

const mountScene = (states) => {
  const root = new Container({ isRenderGroup: true });
  const eventHandler = vi.fn();
  const shared = {
    app: { audioStage: { add: vi.fn() } },
    parent: root,
    animations: [],
    animationBus: createAnimationBus(),
    completionTracker: { getVersion: () => 0, track() {}, complete() {} },
    eventHandler,
  };
  const elements = states.map((state, zIndex) => {
    const element = PARSERS[state.type]({ state });
    ADDERS[state.type]({ ...shared, element, zIndex });
    return element;
  });
  updateRenderGroupTransforms(root.renderGroup, true);
  const boundary = new EventBoundary(root);
  installHoverPassThrough(boundary);

  return { root, boundary, eventHandler, shared, elements };
};

const pointerEvent = (boundary, type, { x, y }, pointerType = "mouse") => {
  const event = new FederatedPointerEvent(boundary);
  event.type = type;
  event.pointerId = 1;
  event.pointerType = pointerType;
  event.isPrimary = true;
  event.button = 0;
  event.buttons = type === "pointerdown" ? 1 : 0;
  event.global.set(x, y);
  event.screen.set(x, y);
  event.client.set(x, y);
  return event;
};

const press = (boundary, point, pointerType) => {
  boundary.mapEvent(pointerEvent(boundary, "pointerdown", point, pointerType));
  boundary.mapEvent(pointerEvent(boundary, "pointerup", point, pointerType));
};

const centerOf = (displayObject) => {
  const bounds = displayObject.getBounds();
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
};

const eventsNamed = (eventHandler, name) =>
  eventHandler.mock.calls
    .filter(([eventName]) => eventName === name)
    .map(([, payload]) => payload);

// A choice-like layout: a clickable button image with a label above it whose
// only binding is a hover text style.
const choiceButton = {
  id: "choice-button",
  type: "sprite",
  x: 100,
  y: 100,
  width: 400,
  height: 120,
  src: "button-base",
  hover: { src: "button-hover" },
  click: { src: "button-press", payload: { choice: "first" } },
};
const choiceLabel = {
  id: "choice-label",
  type: "text",
  x: 160,
  y: 135,
  content: "First option",
  textStyle: { fontFamily: "Arial", fontSize: 36, fill: "#A6A6A6" },
  hover: {
    textStyle: { fontFamily: "Arial", fontSize: 36, fill: "#FFFFFF" },
    payload: { hovered: "label" },
  },
};

describe("hover-only pass-through", () => {
  it("identifies elements whose only pointer binding is hover", () => {
    expect(isHoverOnlyInteraction({ hover: {} })).toBe(true);
    expect(isHoverOnlyInteraction({})).toBe(false);
    for (const binding of [
      "click",
      "rightClick",
      "scrollUp",
      "scrollDown",
      "drag",
    ]) {
      expect(isHoverOnlyInteraction({ hover: {}, [binding]: {} })).toBe(false);
    }
  });

  it.each(["mouse", "touch"])(
    "a %s press inside a hover-only label clicks the button beneath it",
    (pointerType) => {
      registerButtonTextures();
      const { root, boundary, eventHandler } = mountScene([
        choiceButton,
        choiceLabel,
      ]);
      const label = root.getChildByLabel("choice-label");
      const insideLabel = centerOf(label);

      boundary.mapEvent(pointerEvent(boundary, "pointerover", insideLabel));
      press(boundary, insideLabel, pointerType);

      expect(eventsNamed(eventHandler, "hover")).toEqual([
        { _event: { id: "choice-label" }, hovered: "label" },
      ]);
      expect(eventsNamed(eventHandler, "click")).toEqual([
        { _event: { id: "choice-button" }, choice: "first" },
      ]);
      root.destroy({ children: true });
    },
  );

  it("keeps hover tracking on the label while presses reach the button", () => {
    const textures = registerButtonTextures();
    const { root, boundary, eventHandler } = mountScene([
      choiceButton,
      choiceLabel,
    ]);
    const label = root.getChildByLabel("choice-label");
    const button = root.getChildByLabel("choice-button");
    const insideLabel = centerOf(label);
    const insideButtonOnly = { x: 120, y: 205 };

    boundary.mapEvent(pointerEvent(boundary, "pointermove", insideLabel));
    expect(boundary.hitTest(insideLabel.x, insideLabel.y)).toBe(label);
    expect(label.style.fill).toBe("#FFFFFF");

    boundary.mapEvent(pointerEvent(boundary, "pointerdown", insideLabel));
    expect(button.texture.source).toBe(textures.press.source);
    expect(label.style.fill).toBe("#FFFFFF");
    boundary.mapEvent(pointerEvent(boundary, "pointerup", insideLabel));

    boundary.mapEvent(pointerEvent(boundary, "pointermove", insideButtonOnly));
    expect(label.style.fill).toBe("#A6A6A6");
    press(boundary, insideButtonOnly);

    expect(eventsNamed(eventHandler, "click")).toHaveLength(2);
    root.destroy({ children: true });
  });

  it("lets a wheel turn over a hover-only label reach the element beneath", () => {
    registerButtonTextures();
    const { root, boundary } = mountScene([choiceButton, choiceLabel]);
    const button = root.getChildByLabel("choice-button");
    const label = root.getChildByLabel("choice-label");
    const buttonWheel = vi.fn();
    const labelWheel = vi.fn();
    button.on("wheel", buttonWheel);
    label.on("wheel", labelWheel);
    const insideLabel = centerOf(label);
    const wheel = new FederatedWheelEvent(boundary);
    wheel.type = "wheel";
    wheel.deltaY = 100;
    wheel.global.set(insideLabel.x, insideLabel.y);

    boundary.mapEvent(wheel);

    expect(buttonWheel).toHaveBeenCalledTimes(1);
    expect(labelWheel).not.toHaveBeenCalled();
    root.destroy({ children: true });
  });

  it("keeps a label with its own click as the press target", () => {
    registerButtonTextures();
    const { root, boundary, eventHandler } = mountScene([
      choiceButton,
      { ...choiceLabel, click: { payload: { clicked: "label" } } },
    ]);
    const label = root.getChildByLabel("choice-label");

    press(boundary, centerOf(label));

    expect(isHoverPassThrough(label)).toBe(false);
    expect(eventsNamed(eventHandler, "click")).toEqual([
      { _event: { id: "choice-label" }, clicked: "label" },
    ]);
    root.destroy({ children: true });
  });

  it.each([
    {
      type: "sprite",
      id: "hover-sprite",
      x: 150,
      y: 120,
      width: 200,
      height: 80,
      src: "overlay-base",
      hover: { src: "overlay-hover" },
    },
    {
      type: "rect",
      id: "hover-rect",
      x: 150,
      y: 120,
      width: 200,
      height: 80,
      fill: "#737373",
      hover: { fill: "#D9D9D9" },
    },
  ])("applies the same rule to a hover-only $type", (overlay) => {
    registerButtonTextures();
    texture("overlay-base", 200, 80);
    const { root, boundary, eventHandler } = mountScene([
      choiceButton,
      overlay,
    ]);

    press(boundary, { x: 250, y: 160 });

    expect(isHoverPassThrough(root.getChildByLabel(overlay.id))).toBe(true);
    expect(eventsNamed(eventHandler, "click")).toEqual([
      { _event: { id: "choice-button" }, choice: "first" },
    ]);
    root.destroy({ children: true });
  });

  it("follows binding changes when an element is updated", () => {
    registerButtonTextures();
    texture("overlay-base", 200, 80);
    const overlay = {
      type: "sprite",
      id: "overlay",
      x: 150,
      y: 120,
      width: 200,
      height: 80,
      src: "overlay-base",
      hover: { src: "overlay-base" },
    };
    const { root, shared, elements } = mountScene([
      choiceButton,
      overlay,
      choiceLabel,
    ]);
    const [, prevOverlay, prevLabel] = elements;
    const nextOverlay = parseSprite({
      state: { ...overlay, click: { payload: {} } },
    });
    const nextLabel = parseText({
      state: { ...choiceLabel, hover: undefined },
    });

    updateSprite({
      ...shared,
      prevElement: prevOverlay,
      nextElement: nextOverlay,
      zIndex: 1,
    });
    updateText({
      ...shared,
      prevElement: prevLabel,
      nextElement: nextLabel,
      zIndex: 2,
    });

    expect(isHoverPassThrough(root.getChildByLabel("overlay"))).toBe(false);
    expect(isHoverPassThrough(root.getChildByLabel("choice-label"))).toBe(
      false,
    );
    root.destroy({ children: true });
  });

  it("is installed once per boundary", () => {
    const boundary = new EventBoundary(new Container());
    installHoverPassThrough(boundary);
    const { mapEvent, hitPruneFn } = boundary;

    installHoverPassThrough(boundary);

    expect(boundary.mapEvent).toBe(mapEvent);
    expect(boundary.hitPruneFn).toBe(hitPruneFn);
  });
});
