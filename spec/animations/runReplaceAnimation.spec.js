import { Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { runReplaceAnimation } from "../../src/plugins/animations/replace/runReplaceAnimation.js";

const createFrame = (x = 0, y = 0, width = 100, height = 100) => ({
  x,
  y,
  width,
  height,
  clone() {
    return createFrame(this.x, this.y, this.width, this.height);
  },
});

const createDisplayObject = (label) => ({
  label,
  x: 0,
  y: 0,
  alpha: 1,
  rotation: 0,
  scale: { x: 1, y: 1 },
  visible: true,
  destroyed: false,
  destroy: vi.fn(function destroy() {
    this.destroyed = true;
  }),
  getLocalBounds: () => ({
    rectangle: createFrame(),
  }),
});

const createParent = (...children) => ({
  children: [...children],
  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  },
  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    if (child) {
      child.parent = null;
    }

    return child;
  },
});

describe("runReplaceAnimation", () => {
  it("reuses plugin delete/add so replace keeps child animations and completion tracking", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;

    const childAnimations = new Map([
      [
        "child-1",
        [
          {
            id: "child-enter",
            targetId: "child-1",
            type: "live",
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 300, value: 1, easing: "linear" }],
              },
            },
          },
        ],
      ],
    ]);

    const plugin = {
      add: vi.fn(
        ({ parent: targetParent, element, animations, completionTracker }) => {
          expect(animations).toBe(childAnimations);
          expect(completionTracker).toBe(tracker);
          nextDisplayObject.label = element.id;
          targetParent.addChild(nextDisplayObject);
        },
      ),
      delete: vi.fn(
        ({ parent: targetParent, element, animations, completionTracker }) => {
          expect(animations).toEqual([]);
          expect(completionTracker).toBe(tracker);
          const child = targetParent.children.find(
            (item) => item.label === element.id,
          );
          if (child) {
            targetParent.removeChild(child);
          }
        },
      ),
    };

    const tracker = {
      getVersion: () => 11,
      track: vi.fn(),
      complete: vi.fn(),
    };

    const animationBus = {
      dispatch: vi.fn(),
    };

    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
      },
    };

    runReplaceAnimation({
      app,
      parent,
      prevElement: { id: "scene-root", type: "container" },
      nextElement: {
        id: "scene-root",
        type: "container",
        children: [{ id: "child-1", type: "rect" }],
      },
      animation: {
        id: "scene-replace",
        targetId: "scene-root",
        type: "replace",
      },
      animations: childAnimations,
      animationBus,
      completionTracker: tracker,
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    expect(plugin.delete).toHaveBeenCalledTimes(1);
    expect(plugin.add).toHaveBeenCalledTimes(1);
    expect(prevDisplayObject.destroy).not.toHaveBeenCalled();
    expect(nextDisplayObject.visible).toBe(false);
    expect(tracker.track).toHaveBeenCalledWith(11);
    expect(animationBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "scene-replace",
          driver: "custom",
        }),
      }),
    );
  });
});
