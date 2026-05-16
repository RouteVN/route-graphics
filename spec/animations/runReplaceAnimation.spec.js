import { Container, Filter, RenderTexture, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import {
  runReplaceAnimation,
  sampleMaskReveal,
  selectSequenceMaskFrameState,
} from "../../src/plugins/animations/replace/runReplaceAnimation.js";
import {
  queueDeferredAnimatedSpritePlay,
  queueDeferredParticlesStart,
} from "../../src/plugins/elements/renderContext.js";

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
  it("reveals higher-valued mask pixels earlier by default", () => {
    const highMaskStart = sampleMaskReveal({
      progress: 0,
      maskValue: 0.8,
      softness: 0.08,
    });
    const highMaskMid = sampleMaskReveal({
      progress: 0.2,
      maskValue: 0.8,
      softness: 0.08,
    });
    const highMaskEnd = sampleMaskReveal({
      progress: 1,
      maskValue: 0.8,
      softness: 0.08,
    });
    const lowMaskMid = sampleMaskReveal({
      progress: 0.2,
      maskValue: 0.2,
      softness: 0.08,
    });

    expect(highMaskStart).toBeLessThan(highMaskMid);
    expect(highMaskMid).toBeLessThan(highMaskEnd);
    expect(lowMaskMid).toBeLessThan(highMaskMid);
  });

  it("reveals white edge pixels first and black edge pixels last", () => {
    const blackStartReveal = sampleMaskReveal({
      progress: 0,
      maskValue: 0,
      softness: 0,
    });
    const whiteStartReveal = sampleMaskReveal({
      progress: 0,
      maskValue: 1,
      softness: 0,
    });
    const blackEndReveal = sampleMaskReveal({
      progress: 1,
      maskValue: 0,
      softness: 0,
    });

    expect(blackStartReveal).toBe(0);
    expect(whiteStartReveal).toBe(1);
    expect(blackEndReveal).toBe(1);
  });

  it("selects sequence mask frames from explicit progress positions", () => {
    const frames = [{ at: 0 }, { at: 0.25 }, { at: 1 }];

    expect(
      selectSequenceMaskFrameState({
        progress: 0.5,
        frames,
        sampleMode: "linear",
      }),
    ).toEqual({
      fromIndex: 1,
      toIndex: 2,
      mix: 1 / 3,
    });

    expect(
      selectSequenceMaskFrameState({
        progress: 0.74,
        frames,
        sampleMode: "hold",
      }),
    ).toEqual({
      fromIndex: 1,
      toIndex: 1,
      mix: 0,
    });

    expect(
      selectSequenceMaskFrameState({
        progress: 1.2,
        frames,
        sampleMode: "linear",
      }),
    ).toEqual({
      fromIndex: 2,
      toIndex: 2,
      mix: 0,
    });
  });

  it("mounts next-only transitions through hidden add flow and reveals the result on complete", () => {
    const parent = createParent();
    const nextDisplayObject = createDisplayObject("scene-root");
    const deferredEffect = vi.fn();

    const plugin = {
      add: vi.fn(({ parent: targetParent, element, renderContext }) => {
        expect(renderContext.suppressAnimations).toBe(true);
        expect(targetParent).not.toBe(parent);
        nextDisplayObject.label = element.id;
        queueDeferredAnimatedSpritePlay(renderContext, {
          destroyed: false,
          play: deferredEffect,
        });
        targetParent.addChild(nextDisplayObject);
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
        id: "scene-enter",
        targetId: "scene-root",
        type: "transition",
        next: {
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 300, value: 1, easing: "linear" }],
            },
          },
        },
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

    expect(plugin.add).toHaveBeenCalledTimes(1);
    expect(plugin.delete).not.toHaveBeenCalled();
    expect(parent.children).toHaveLength(2);
    expect(nextDisplayObject.visible).toBe(false);
    expect(tracker.track).toHaveBeenCalledWith(11);

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    dispatched.payload.onComplete();

    expect(parent.children).toEqual([nextDisplayObject]);
    expect(nextDisplayObject.visible).toBe(true);
    expect(deferredEffect).toHaveBeenCalledTimes(1);
    expect(tracker.complete).toHaveBeenCalledWith(11);
  });

  it("applies transition rotation tween values as degree deltas", () => {
    const parent = createParent();
    const nextDisplayObject = createDisplayObject("scene-root");

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
        nextDisplayObject.label = element.id;
        targetParent.addChild(nextDisplayObject);
      }),
      delete: vi.fn(),
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
        id: "scene-rotate",
        targetId: "scene-root",
        type: "transition",
        next: {
          tween: {
            rotation: {
              keyframes: [{ duration: 300, value: 90, easing: "linear" }],
            },
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 0,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    const overlay = parent.children[1];
    const wrapper = overlay.children[0];

    dispatched.payload.applyFrame(300);

    expect(wrapper.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("runs persistent transitions without tracking render completion", () => {
    const parent = createParent();
    const nextDisplayObject = createDisplayObject("scene-root");

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
        nextDisplayObject.label = element.id;
        targetParent.addChild(nextDisplayObject);
      }),
      delete: vi.fn(),
    };

    const tracker = {
      getVersion: vi.fn(),
      track: vi.fn(),
      complete: vi.fn(),
    };

    const animationBus = {
      dispatch: vi.fn(),
      registerPending: vi.fn(),
      removePending: vi.fn(),
      activatePending: vi.fn().mockReturnValue(false),
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
        id: "scene-enter",
        targetId: "scene-root",
        type: "transition",
        playback: { continuity: "persistent" },
        next: {
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 300, value: 1, easing: "linear" }],
            },
          },
        },
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

    expect(animationBus.registerPending).toHaveBeenCalledTimes(1);
    expect(tracker.getVersion).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    expect(dispatched.payload.continuity).toBe("persistent");

    dispatched.payload.onComplete();
    dispatched.payload.onCancel();

    expect(tracker.complete).not.toHaveBeenCalled();
  });

  it("runs delete-only transitions without mounting a next element", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;

    const plugin = {
      add: vi.fn(),
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
      nextElement: null,
      animation: {
        id: "scene-exit",
        targetId: "scene-root",
        type: "transition",
        prev: {
          tween: {
            alpha: {
              initialValue: 1,
              keyframes: [{ duration: 300, value: 0, easing: "linear" }],
            },
          },
        },
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

    expect(plugin.add).not.toHaveBeenCalled();
    expect(plugin.delete).toHaveBeenCalledTimes(1);
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).not.toBe(prevDisplayObject);
    expect(tracker.track).toHaveBeenCalledWith(11);

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    dispatched.payload.onComplete();

    expect(parent.children).toHaveLength(0);
    expect(tracker.complete).toHaveBeenCalledWith(11);
  });

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

  it("preserves continuation zIndex updates while an async persistent transition is pending", async () => {
    const parent = createParent();
    const nextDisplayObject = createDisplayObject("scene-root");

    let resolveAdd;
    const addPromise = new Promise((resolve) => {
      resolveAdd = resolve;
    });
    /** @type {{ onContinuationUpdate?: Function } | null} */
    let pendingContext = null;

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
      registerPending: vi.fn((payload) => {
        pendingContext = payload;
      }),
      removePending: vi.fn(),
      activatePending: vi.fn().mockReturnValue(false),
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
        playback: { continuity: "persistent" },
        next: {
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 300, value: 1, easing: "linear" }],
            },
          },
        },
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

    expect(animationBus.registerPending).toHaveBeenCalledTimes(1);

    pendingContext?.onContinuationUpdate?.({ zIndex: 7 });

    resolveAdd();
    await addPromise;
    await vi.waitFor(() => {
      expect(animationBus.dispatch).toHaveBeenCalledTimes(1);
    });

    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );

    expect(nextDisplayObject.zIndex).toBe(7);
    expect(overlay?.zIndex).toBe(7);
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

  it("preserves particle runtimes on the next live element during hidden replace mount cleanup", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const tickerCallback = vi.fn();
    const emitter = {
      destroyed: false,
      destroy: vi.fn(() => {
        emitter.destroyed = true;
      }),
    };

    const plugin = {
      add: vi.fn(({ parent: targetParent, element, renderContext }) => {
        nextDisplayObject.label = element.id;
        nextDisplayObject.emitter = emitter;
        nextDisplayObject.tickerCallback = tickerCallback;
        queueDeferredParticlesStart(renderContext, {
          app,
          emitter,
          container: nextDisplayObject,
          tickerCallback,
        });
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

    const animationBus = {
      dispatch: vi.fn(),
    };
    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
      },
      ticker: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    runReplaceAnimation({
      app,
      parent,
      prevElement: { id: "scene-root", type: "container" },
      nextElement: { id: "scene-root", type: "particles" },
      animation: {
        id: "scene-transition",
        targetId: "scene-root",
        type: "transition",
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    expect(emitter.destroy).not.toHaveBeenCalled();
    expect(app.ticker.remove).not.toHaveBeenCalled();
    expect(nextDisplayObject.emitter).toBe(emitter);
    expect(nextDisplayObject.tickerCallback).toBe(tickerCallback);

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    dispatched.payload.onComplete();

    expect(app.ticker.add).toHaveBeenCalledWith(tickerCallback);
    expect(nextDisplayObject.visible).toBe(true);
  });

  it("uses only the previous snapshot for same-id prev-only transitions", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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
      nextElement: { id: "scene-root", type: "container", children: [] },
      animation: {
        id: "scene-slide-out",
        targetId: "scene-root",
        type: "transition",
        prev: {
          tween: {
            translateX: {
              initialValue: 0,
              keyframes: [{ duration: 1000, value: -1, easing: "linear" }],
            },
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );

    expect(overlay.children).toHaveLength(1);
    dispatched.payload.applyFrame(500);
    expect(overlay.children[0].x).toBeCloseTo(-50);
    expect(nextDisplayObject.visible).toBe(false);
  });

  it("uses only the next snapshot for same-id next-only transitions", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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
      nextElement: { id: "scene-root", type: "container", children: [] },
      animation: {
        id: "scene-slide-in",
        targetId: "scene-root",
        type: "transition",
        next: {
          tween: {
            translateX: {
              initialValue: 1,
              keyframes: [{ duration: 1000, value: 0, easing: "linear" }],
            },
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );

    expect(overlay.children).toHaveLength(1);
    dispatched.payload.applyFrame(500);
    expect(overlay.children[0].x).toBeCloseTo(50);
    expect(nextDisplayObject.visible).toBe(false);
  });

  it("applies absolute x and y tweens to transition snapshots", () => {
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent();

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
        nextDisplayObject.label = element.id;
        targetParent.addChild(nextDisplayObject);
      }),
      delete: vi.fn(),
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
      nextElement: { id: "scene-root", type: "container", children: [] },
      animation: {
        id: "scene-absolute-in",
        targetId: "scene-root",
        type: "transition",
        next: {
          tween: {
            x: {
              initialValue: 20,
              keyframes: [{ duration: 1000, value: 120, easing: "linear" }],
            },
            y: {
              initialValue: 10,
              keyframes: [{ duration: 1000, value: 60, easing: "linear" }],
            },
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const dispatched = animationBus.dispatch.mock.calls[0][0];
    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );

    dispatched.payload.applyFrame(500);
    expect(overlay.children[0].x).toBeCloseTo(70);
    expect(overlay.children[0].y).toBeCloseTo(35);
  });

  it("expands masked transition bounds for absolute position tweens", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const maskTexture = document.createElement("canvas");
    maskTexture.width = 1;
    maskTexture.height = 1;

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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

    const animationBus = {
      dispatch: vi.fn(),
    };

    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
        render: vi.fn(),
      },
    };

    runReplaceAnimation({
      app,
      parent,
      prevElement: { id: "scene-root", type: "container" },
      nextElement: { id: "scene-root", type: "container", children: [] },
      animation: {
        id: "scene-mask-position",
        targetId: "scene-root",
        type: "transition",
        prev: {
          tween: {
            alpha: {
              initialValue: 1,
              keyframes: [{ duration: 1000, value: 0, easing: "linear" }],
            },
          },
        },
        next: {
          tween: {
            x: {
              initialValue: 200,
              keyframes: [{ duration: 1000, value: 400, easing: "linear" }],
            },
          },
        },
        mask: {
          kind: "single",
          texture: maskTexture,
          channel: "red",
          progress: {
            initialValue: 0,
            keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );
    const sprite = overlay.children[0];

    expect(sprite.x).toBe(0);
    expect(sprite.filterArea.width).toBe(401);
    expect(sprite.filterArea.height).toBe(1);
  });

  it("does not preprocess single masks through CPU extraction", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const maskTexture = document.createElement("canvas");
    maskTexture.width = 1;
    maskTexture.height = 1;

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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

    const animationBus = {
      dispatch: vi.fn(),
    };

    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
        render: vi.fn(),
        extract: {
          pixels: vi.fn(() => ({
            pixels: new Uint8ClampedArray(100 * 100 * 4),
          })),
        },
      },
    };

    runReplaceAnimation({
      app,
      parent,
      prevElement: { id: "scene-root", type: "container" },
      nextElement: { id: "scene-root", type: "container", children: [] },
      animation: {
        id: "scene-mask-replace",
        targetId: "scene-root",
        type: "transition",
        mask: {
          kind: "single",
          texture: maskTexture,
          channel: "red",
          progress: {
            initialValue: 0,
            keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const dispatched = animationBus.dispatch.mock.calls[0][0];

    expect(app.renderer.extract.pixels).not.toHaveBeenCalled();
    dispatched.payload.applyFrame(500);

    expect(app.renderer.extract.pixels).not.toHaveBeenCalled();
    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );
    const maskFilter = overlay.children[0].filters[0];

    expect(
      maskFilter.resources.replaceMaskUniforms.uniforms.uMaskDirectReveal,
    ).toBe(0);
  });

  it("routes single alpha masks through the alpha preprocessing filter", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const maskTexture = document.createElement("canvas");
    maskTexture.width = 1;
    maskTexture.height = 1;
    const filterFromSpy = vi.spyOn(Filter, "from");

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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

    const animationBus = {
      dispatch: vi.fn(),
    };

    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
        render: vi.fn(),
        extract: {
          pixels: vi.fn(() => ({
            pixels: new Uint8ClampedArray(100 * 100 * 4),
          })),
        },
      },
    };

    try {
      runReplaceAnimation({
        app,
        parent,
        prevElement: { id: "scene-root", type: "container" },
        nextElement: { id: "scene-root", type: "container", children: [] },
        animation: {
          id: "scene-mask-replace-alpha",
          targetId: "scene-root",
          type: "transition",
          mask: {
            kind: "single",
            texture: maskTexture,
            channel: "alpha",
            progress: {
              initialValue: 0,
              keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
            },
          },
        },
        animations: new Map(),
        animationBus,
        completionTracker: {
          getVersion: () => 11,
          track: vi.fn(),
          complete: vi.fn(),
        },
        eventHandler: vi.fn(),
        elementPlugins: [],
        plugin,
        zIndex: 0,
        signal: new AbortController().signal,
      });

      const dispatched = animationBus.dispatch.mock.calls[0][0];
      const overlay = parent.children.find(
        (child) => child !== nextDisplayObject,
      );
      const sprite = overlay.children[0];
      const maskFilter = sprite.filters[0];
      const maskChannelFilterCall = filterFromSpy.mock.calls.find(
        ([config]) => config.resources?.maskChannelUniforms,
      );

      dispatched.payload.applyFrame(500);

      expect(maskChannelFilterCall).toBeTruthy();
      expect(
        Array.from(
          maskChannelFilterCall[0].resources.maskChannelUniforms.uniforms
            .uMaskChannelWeights,
        ),
      ).toEqual([0, 0, 0, 1]);
      expect(
        Array.from(
          maskFilter.resources.replaceMaskUniforms.uniforms.uMaskChannelWeights,
        ),
      ).toEqual([1, 0, 0, 0]);
      expect(
        maskFilter.resources.replaceMaskUniforms.uniforms.uMaskDirectReveal,
      ).toBe(0);
      expect(maskFilter.resources.uMaskTextureA).not.toBe(Texture.EMPTY.source);
      expect(maskFilter.resources.uMaskTextureB).not.toBe(Texture.EMPTY.source);
      expect(app.renderer.extract.pixels).not.toHaveBeenCalled();
    } finally {
      filterFromSpy.mockRestore();
    }
  });

  it("maps masked replace secondary textures through the overlay sprite matrix", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const maskTexture = document.createElement("canvas");
    maskTexture.width = 1;
    maskTexture.height = 1;

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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

    const animationBus = {
      dispatch: vi.fn(),
    };

    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
        render: vi.fn(),
        extract: {
          pixels: vi.fn(() => ({
            pixels: new Uint8ClampedArray(100 * 100 * 4),
          })),
        },
      },
    };

    runReplaceAnimation({
      app,
      parent,
      prevElement: { id: "scene-root", type: "container" },
      nextElement: { id: "scene-root", type: "container", children: [] },
      animation: {
        id: "scene-mask-replace",
        targetId: "scene-root",
        type: "transition",
        mask: {
          kind: "single",
          texture: maskTexture,
          channel: "red",
          progress: {
            initialValue: 0,
            keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );
    const sprite = overlay.children[0];
    const maskFilter = sprite.filters[0];
    const filterManager = {
      calculateSpriteMatrix: vi.fn((matrix) => {
        matrix.a = 1.6;
        matrix.b = 0;
        matrix.c = 0;
        matrix.d = 1.4222222222222223;
        matrix.tx = 0;
        matrix.ty = 0;
        return matrix;
      }),
      applyFilter: vi.fn(),
    };

    maskFilter.apply(filterManager, Texture.EMPTY, Texture.EMPTY, false);

    expect(filterManager.calculateSpriteMatrix).toHaveBeenCalledWith(
      maskFilter.resources.replaceMaskUniforms.uniforms.uSecondaryMatrix,
      sprite,
    );
    expect(filterManager.applyFilter).toHaveBeenCalledWith(
      maskFilter,
      Texture.EMPTY,
      Texture.EMPTY,
      false,
    );
    expect(
      maskFilter.resources.replaceMaskUniforms.uniforms.uSecondaryMatrix.a,
    ).toBeCloseTo(1.6);
    expect(
      maskFilter.resources.replaceMaskUniforms.uniforms.uSecondaryMatrix.d,
    ).toBeCloseTo(1.4222222222222223);
    expect(
      Array.from(
        maskFilter.resources.replaceMaskUniforms.uniforms.uSecondaryClamp,
      ),
    ).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it("destroys masked replace filters before their bound textures on completion", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const maskTexture = document.createElement("canvas");
    maskTexture.width = 1;
    maskTexture.height = 1;

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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

    const animationBus = {
      dispatch: vi.fn(),
    };
    const tracker = {
      getVersion: () => 11,
      track: vi.fn(),
      complete: vi.fn(),
    };
    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
        render: vi.fn(),
      },
    };

    const destroyOrder = [];
    const renderTextureConfigs = [];
    let renderTextureIndex = 0;
    let filterIndex = 0;
    const renderTextureSpy = vi
      .spyOn(RenderTexture, "create")
      .mockImplementation((config) => {
        renderTextureConfigs.push(config);
        const id = renderTextureIndex++;
        const texture = Object.create(Texture.EMPTY);
        Object.defineProperty(texture, "source", {
          value: {
            destroyed: false,
          },
          writable: true,
          configurable: true,
        });
        texture.destroy = vi.fn(() => {
          texture.destroyed = true;
          texture.source.destroyed = true;
          destroyOrder.push(`renderTexture:${id}`);
        });
        Object.defineProperty(texture, "destroy", {
          value: texture.destroy,
          writable: true,
          configurable: true,
        });

        return texture;
      });
    const filterSpy = vi.spyOn(Filter, "from").mockImplementation(() => {
      if (filterIndex++ === 0) {
        return {
          destroy: vi.fn(() => {
            destroyOrder.push("maskChannelFilter.destroy");
          }),
          resources: {},
        };
      }

      const replaceMaskUniforms = {
        uniforms: {},
        update: vi.fn(),
      };
      const replaceMaskFilter = {
        resources: {
          replaceMaskUniforms,
          uNextTexture: Texture.EMPTY.source,
          uMaskTextureA: Texture.EMPTY.source,
          uMaskTextureB: Texture.EMPTY.source,
        },
        destroy: vi.fn(() => {
          destroyOrder.push("maskFilter.destroy");
          const boundTextures = [
            replaceMaskFilter.resources.uNextTexture,
            replaceMaskFilter.resources.uMaskTextureA,
            replaceMaskFilter.resources.uMaskTextureB,
          ];

          if (boundTextures.some((resource) => resource?.destroyed)) {
            throw new Error("mask filter destroy ran after texture teardown");
          }
        }),
      };

      return replaceMaskFilter;
    });

    try {
      runReplaceAnimation({
        app,
        parent,
        prevElement: { id: "scene-root", type: "container" },
        nextElement: { id: "scene-root", type: "container", children: [] },
        animation: {
          id: "scene-mask-replace",
          targetId: "scene-root",
          type: "transition",
          mask: {
            kind: "single",
            texture: maskTexture,
            channel: "red",
            progress: {
              initialValue: 0,
              keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
            },
          },
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

      expect(() => dispatched.payload.onComplete()).not.toThrow();
      expect(tracker.complete).toHaveBeenCalledWith(11);

      const maskFilterDestroyIndex = destroyOrder.indexOf("maskFilter.destroy");

      expect(maskFilterDestroyIndex).toBeGreaterThan(-1);
      expect(maskFilterDestroyIndex).toBeLessThan(
        destroyOrder.indexOf("renderTexture:0"),
      );
      expect(maskFilterDestroyIndex).toBeLessThan(
        destroyOrder.indexOf("renderTexture:1"),
      );
      expect(maskFilterDestroyIndex).toBeLessThan(
        destroyOrder.indexOf("renderTexture:2"),
      );
      expect(renderTextureConfigs).toEqual([
        expect.objectContaining({ resolution: 1 }),
        expect.objectContaining({ resolution: 1 }),
        expect.objectContaining({ resolution: 1 }),
      ]);
    } finally {
      renderTextureSpy.mockRestore();
      filterSpy.mockRestore();
    }
  });

  it("does not preprocess sequence masks through CPU extraction", () => {
    const prevDisplayObject = createDisplayObject("scene-root");
    const nextDisplayObject = createDisplayObject("scene-root");
    const parent = createParent(prevDisplayObject);
    prevDisplayObject.parent = parent;
    const leftMask = document.createElement("canvas");
    const rightMask = document.createElement("canvas");
    leftMask.width = 1;
    leftMask.height = 1;
    rightMask.width = 1;
    rightMask.height = 1;

    const plugin = {
      add: vi.fn(({ parent: targetParent, element }) => {
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

    const animationBus = {
      dispatch: vi.fn(),
    };

    const app = {
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
        render: vi.fn(),
        extract: {
          pixels: vi.fn(() => ({
            pixels: new Uint8ClampedArray(100 * 100 * 4),
          })),
        },
      },
    };

    runReplaceAnimation({
      app,
      parent,
      prevElement: { id: "scene-root", type: "container" },
      nextElement: { id: "scene-root", type: "container", children: [] },
      animation: {
        id: "scene-mask-sequence",
        targetId: "scene-root",
        type: "transition",
        mask: {
          kind: "sequence",
          frames: [
            { at: 0, texture: leftMask },
            { at: 1, texture: rightMask },
          ],
          channel: "alpha",
          sample: "linear",
          invert: true,
          progress: {
            initialValue: 0,
            keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
          },
        },
      },
      animations: new Map(),
      animationBus,
      completionTracker: {
        getVersion: () => 11,
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      elementPlugins: [],
      plugin,
      zIndex: 0,
      signal: new AbortController().signal,
    });

    const dispatched = animationBus.dispatch.mock.calls[0][0];

    expect(app.renderer.extract.pixels).not.toHaveBeenCalled();
    dispatched.payload.applyFrame(500);

    expect(app.renderer.extract.pixels).not.toHaveBeenCalled();
    const overlay = parent.children.find(
      (child) => child !== nextDisplayObject,
    );
    const maskFilter = overlay.children[0].filters[0];

    expect(
      maskFilter.resources.replaceMaskUniforms.uniforms.uMaskDirectReveal,
    ).toBe(1);
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
