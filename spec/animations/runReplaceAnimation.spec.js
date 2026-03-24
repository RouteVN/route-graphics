import { Container, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { runReplaceAnimation } from "../../src/plugins/animations/replace/runReplaceAnimation.js";
import { queueDeferredAnimatedSpritePlay } from "../../src/plugins/elements/renderContext.js";

const createFrame = (x = 0, y = 0, width = 100, height = 100) => ({
  x,
  y,
  width,
  height,
  clone() {
    return createFrame(this.x, this.y, this.width, this.height);
  },
});

const createDisplayObject = (label) => {
  const displayObject = new Container();
  displayObject.label = label;
  displayObject.visible = true;
  displayObject.destroy = vi.fn(function destroy() {
    this.destroyed = true;
  });
  displayObject.getLocalBounds = () => ({
    rectangle: createFrame(),
  });

  return displayObject;
};

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
  it("tracks async transition mounts before the next element promise resolves", async () => {
    const parent = createParent();
    const nextDisplayObject = createDisplayObject("scene-root");

    let resolveAdd;
    const addPromise = new Promise((resolve) => {
      resolveAdd = resolve;
    });

    const plugin = {
      add: vi.fn(({ parent: targetParent, element, renderContext }) => {
        expect(renderContext.suppressAnimations).toBe(true);
        return addPromise.then(() => {
          nextDisplayObject.label = element.id;
          targetParent.addChild(nextDisplayObject);
        });
      }),
      delete: vi.fn(),
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
      prevElement: null,
      nextElement: {
        id: "scene-root",
        type: "container",
        children: [],
      },
      animation: {
        id: "scene-transition",
        targetId: "scene-root",
        type: "transition",
      },
      animations: new Map(),
      animationBus,
      completionTracker: tracker,
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    expect(tracker.track).toHaveBeenCalledWith(11);
    expect(animationBus.dispatch).not.toHaveBeenCalled();

    resolveAdd();
    await addPromise;
    await vi.waitFor(() => {
      expect(animationBus.dispatch).toHaveBeenCalledTimes(1);
    });
  });

  it("reuses plugin delete/add so transition keeps child setup and deferred activation", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const deferredEffect = vi.fn();

    const childAnimations = new Map([
      [
        "child-1",
        [
          {
            id: "child-enter",
            targetId: "child-1",
            type: "update",
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
        ({
          parent: targetParent,
          element,
          animations,
          completionTracker,
          renderContext,
        }) => {
          expect(animations).toBe(childAnimations);
          expect(completionTracker).toBe(tracker);
          expect(targetParent).not.toBe(parent);
          expect(renderContext.suppressAnimations).toBe(true);
          queueDeferredAnimatedSpritePlay(renderContext, {
            destroyed: false,
            play: deferredEffect,
          });
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
        id: "scene-transition",
        targetId: "scene-root",
        type: "transition",
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
    const dispatched = animationBus.dispatch.mock.calls[0][0];

    expect(dispatched).toEqual(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "scene-transition",
          driver: "custom",
        }),
      }),
    );

    dispatched.payload.onComplete();

    expect(nextDisplayObject.visible).toBe(true);
    expect(deferredEffect).toHaveBeenCalledTimes(1);
  });

  it("does not flush deferred activation when a transition is cancelled", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const deferredEffect = vi.fn();

    const plugin = {
      add: vi.fn(({ parent: targetParent, element, renderContext }) => {
        queueDeferredAnimatedSpritePlay(renderContext, {
          destroyed: false,
          play: deferredEffect,
        });
        nextDisplayObject.label = element.id;
        targetParent.addChild(nextDisplayObject);
      }),
      delete: vi.fn(({ parent: targetParent, element }) => {
        const child = targetParent.children.find(
          (item) => item.label === element.id,
        );
        if (child) {
          targetParent.removeChild(child);
        }
      }),
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
        children: [],
      },
      animation: {
        id: "scene-transition",
        targetId: "scene-root",
        type: "transition",
      },
      animations: new Map(),
      animationBus,
      completionTracker: tracker,
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const dispatched = animationBus.dispatch.mock.calls[0][0];

    dispatched.payload.applyTargetState();
    dispatched.payload.onCancel();

    expect(nextDisplayObject.visible).toBe(true);
    expect(deferredEffect).not.toHaveBeenCalled();
    expect(tracker.complete).toHaveBeenCalledWith(11);
  });
});
