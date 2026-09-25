import {
  Cache,
  Container,
  EventBoundary,
  Matrix,
  Rectangle,
  Texture,
  TextureSource,
  updateRenderGroupTransforms,
} from "pixi.js";
import "pixi.js/events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addSprite } from "../../src/plugins/elements/sprite/addSprite.js";
import { updateSprite } from "../../src/plugins/elements/sprite/updateSprite.js";
import { parseSprite } from "../../src/plugins/elements/sprite/parseSprite.js";
import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";

const aliases = [];
const texture = (id, width, height, options = {}) => {
  const value = new Texture({
    source: new TextureSource({ width, height }),
    ...options,
  });
  Cache.set(id, value);
  aliases.push([id, value]);
  return value;
};
afterEach(() => {
  for (const [id, value] of aliases.splice(0)) {
    Cache.remove(id);
    value.destroy(true);
  }
});
function mount(extra = {}) {
  const parent = new Container({ isRenderGroup: true });
  const element = parseSprite({
    state: {
      id: "button",
      type: "sprite",
      x: 400,
      y: 250,
      width: 240,
      height: 150,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: -1.5,
      scaleY: 0.7,
      rotation: 17,
      src: "base",
      hover: { src: "over" },
      click: { src: "down" },
      rightClick: { src: "right" },
      ...extra,
    },
  });
  const options = {
    app: { audioStage: { add: vi.fn() } },
    parent,
    element,
    animations: [],
    animationBus: createAnimationBus(),
    completionTracker: { getVersion: () => 0, track() {}, complete() {} },
    eventHandler: vi.fn(),
    zIndex: 0,
  };
  addSprite(options);
  return { ...options, sprite: parent.getChildByLabel("button") };
}
function corners(sprite) {
  const m = sprite.getGlobalTransform(new Matrix());
  const b = sprite.bounds;
  return [
    [b.minX, b.minY],
    [b.maxX, b.minY],
    [b.maxX, b.maxY],
    [b.minX, b.maxY],
  ].flatMap(([x, y]) => {
    const p = m.apply({ x, y });
    return [p.x, p.y];
  });
}
function expectCorners(sprite, expected) {
  corners(sprite).forEach((n, i) => expect(n).toBeCloseTo(expected[i], 10));
}
describe("sprite interaction texture geometry", () => {
  it("keeps reflected anchored corners on hover, both presses and restoration", () => {
    texture("base", 960, 540);
    texture("over", 480, 270);
    texture("down", 64, 96);
    texture("right", 128, 32);
    const { sprite, parent } = mount();
    const before = corners(sprite);
    for (const [event, payload] of [
      ["pointerover", {}],
      ["pointerdown", { button: 0 }],
      ["rightdown", {}],
      ["rightup", {}],
      ["pointerup", { button: 0 }],
      ["pointerout", {}],
    ]) {
      sprite.emit(event, payload);
      expectCorners(sprite, before);
    }
    parent.destroy({ children: true });
  });
  it("keeps cached hit testing valid when an inherited hover replaces EMPTY", () => {
    texture("over", 960, 540);
    const { sprite, parent } = mount({
      src: "",
      x: 100,
      y: 80,
      anchorX: 0,
      anchorY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
    parent.eventMode = "static";
    parent.hitArea = new Rectangle(0, 0, 800, 600);
    updateRenderGroupTransforms(parent.renderGroup, true);
    const boundary = new EventBoundary(parent);
    expect(boundary.hitTest(700, 350)).toBe(parent);
    sprite[Symbol.for("routeGraphics.setInheritedHover")](parent, true);
    // No renderer tick occurs between the texture swap and this pointer lookup.
    expect(boundary.hitTest(700, 350)).toBe(parent);
    expect(boundary.hitTest(150, 110)).toBe(sprite);
    parent.destroy({ children: true });
  });
  it("preserves a live scale tween and its fixed pivot through image switches", () => {
    texture("base", 960, 540);
    texture("over", 480, 270);
    const { sprite, parent, animationBus } = mount();
    animationBus.dispatch({
      type: "START",
      payload: {
        id: "scale",
        element: sprite,
        properties: {
          scaleX: {
            keyframes: [{ duration: 200, value: -0.8, easing: "linear" }],
          },
          scaleY: {
            keyframes: [{ duration: 200, value: 0.5, easing: "linear" }],
          },
        },
      },
    });
    animationBus.flush();
    animationBus.tick(70);
    const before = corners(sprite),
      scale = { x: sprite.scale.x, y: sprite.scale.y };
    sprite.emit("pointerover", {});
    expectCorners(sprite, before);
    expect(sprite.scale.x).toBeCloseTo(scale.x, 10);
    expect(sprite.scale.y).toBeCloseTo(scale.y, 10);
    animationBus.tick(40);
    const moved = corners(sprite);
    expect(moved).not.toEqual(before);
    sprite.emit("pointerout", {});
    expectCorners(sprite, moved);
    parent.destroy({ children: true });
  });
  it("rebinds updated source config without losing variant geometry", () => {
    texture("base", 960, 540);
    texture("over", 480, 270);
    texture("down", 64, 96);
    texture("right", 128, 32);
    const options = mount();
    const { sprite, parent, element } = options;
    sprite.emit("pointerover", {});
    const nextElement = { ...element, rotation: 29, x: 450 };
    updateSprite({ ...options, prevElement: element, nextElement });
    const before = corners(sprite);
    sprite.emit("pointerover", {});
    expectCorners(sprite, before);
    sprite.emit("pointerdown", { button: 0 });
    expectCorners(sprite, before);
    sprite.emit("pointerup", { button: 0 });
    expectCorners(sprite, before);
    parent.destroy({ children: true });
  });
  it("keeps zero scales collapsed instead of restoring the old explicit size", () => {
    texture("base", 960, 540);
    texture("over", 480, 270);
    const { sprite, parent } = mount();
    sprite.scale.set(0, 0);
    sprite.emit("pointerover", {});
    expect(sprite.scale.x).toBe(0);
    expect(sprite.scale.y).toBe(0);
    sprite.emit("pointerout", {});
    expect(sprite.width).toBe(0);
    expect(sprite.height).toBe(0);
    parent.destroy({ children: true });
  });
  it("preserves atlas UVs and normalizes trim without changing a shared texture", () => {
    const base = texture("base", 960, 540);
    const over = texture("over", 512, 512, {
      frame: new Rectangle(40, 60, 80, 100),
      orig: new Rectangle(0, 0, 200, 270),
      trim: new Rectangle(20, 30, 80, 100),
      rotate: 2,
    });
    const sourceOrig = over.orig.clone(),
      sourceTrim = over.trim.clone();
    const { sprite, parent } = mount();
    sprite.emit("pointerover", {});
    const view = sprite.texture;
    expect(view).not.toBe(over);
    expect(view.source).toBe(over.source);
    expect(view.uvs).toEqual(over.uvs);
    expect(view.frame).toEqual(over.frame);
    expect(view.orig).toEqual(base.orig);
    expect(view.trim).toEqual(new Rectangle(96, 60, 384, 200));
    expect(over.orig).toEqual(sourceOrig);
    expect(over.trim).toEqual(sourceTrim);
    parent.destroy({ children: true });
    expect(view.destroyed).toBe(true);
    expect(over.destroyed).toBe(false);
    expect(over.source.destroyed).toBe(false);
  });
  it("reuses views and releases only its own listeners on rebind and destruction", () => {
    texture("base", 960, 540);
    const over = texture("over", 480, 270);
    const listeners = over.source.listenerCount("resize");
    const options = mount(),
      other = mount();
    options.sprite.emit("pointerover", {});
    other.sprite.emit("pointerover", {});
    const first = options.sprite.texture,
      second = other.sprite.texture;
    expect(first).not.toBe(second);
    expect(over.source.listenerCount("resize")).toBe(listeners + 2);
    for (let i = 0; i < 32; i++) {
      options.sprite.emit("pointerout", {});
      options.sprite.emit("pointerover", {});
      expect(options.sprite.texture).toBe(first);
    }
    updateSprite({
      ...options,
      prevElement: options.element,
      nextElement: { ...options.element, x: 500 },
    });
    expect(first.destroyed).toBe(true);
    expect(over.source.listenerCount("resize")).toBe(listeners + 1);
    expect(second.destroyed).toBe(false);
    expect(over.destroyed).toBe(false);
    options.parent.destroy({ children: true });
    other.parent.destroy({ children: true });
    expect(second.destroyed).toBe(true);
    expect(over.source.listenerCount("resize")).toBe(listeners);
  });
});
