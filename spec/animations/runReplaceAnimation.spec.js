import { Container, Filter, RenderTexture, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import {
  runReplaceAnimation,
  sampleMaskReveal,
  selectSequenceMaskFrameState,
} from "../../src/plugins/animations/replace/runReplaceAnimation.js";
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
  it("increases reveal over time for lower-valued mask pixels", () => {
    const lowMaskStart = sampleMaskReveal({
      progress: 0,
      maskValue: 0.2,
      softness: 0.08,
    });
    const lowMaskMid = sampleMaskReveal({
      progress: 0.2,
      maskValue: 0.2,
      softness: 0.08,
    });
    const lowMaskEnd = sampleMaskReveal({
      progress: 1,
      maskValue: 0.2,
      softness: 0.08,
    });
    const highMaskMid = sampleMaskReveal({
      progress: 0.2,
      maskValue: 0.8,
      softness: 0.08,
    });

    expect(lowMaskStart).toBeLessThan(lowMaskMid);
    expect(lowMaskMid).toBeLessThan(lowMaskEnd);
    expect(highMaskMid).toBeLessThan(lowMaskMid);
  });

  it("fully completes edge pixels by the end of the transition", () => {
    const startReveal = sampleMaskReveal({
      progress: 0,
      maskValue: 0,
      softness: 0.08,
    });
    const endReveal = sampleMaskReveal({
      progress: 1,
      maskValue: 1,
      softness: 0.08,
    });

    expect(startReveal).toBe(0);
    expect(endReveal).toBe(1);
  });

  it("selects adjacent sequence mask frames for linear sampling", () => {
    expect(
      selectSequenceMaskFrameState({
        progress: 0.5,
        frameCount: 2,
        sampleMode: "linear",
      }),
    ).toEqual({
      fromIndex: 0,
      toIndex: 1,
      mix: 0.5,
    });

    expect(
      selectSequenceMaskFrameState({
        progress: 0.74,
        frameCount: 3,
        sampleMode: "hold",
      }),
    ).toEqual({
      fromIndex: 1,
      toIndex: 1,
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
    expect(overlay.children[0].x).toBeLessThan(0);
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
    expect(overlay.children[0].x).toBeGreaterThan(0);
    expect(nextDisplayObject.visible).toBe(false);
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
          textures: [leftMask, rightMask],
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
  });

  it("still preprocesses composite masks through the fallback path", () => {
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
        id: "scene-mask-composite",
        targetId: "scene-root",
        type: "transition",
        mask: {
          kind: "composite",
          combine: "max",
          items: [
            { texture: leftMask, channel: "red" },
            { texture: rightMask, channel: "red" },
          ],
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

    expect(app.renderer.extract.pixels).toHaveBeenCalledTimes(2);
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
