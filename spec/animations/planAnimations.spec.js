import { describe, expect, it, vi } from "vitest";
import {
  dispatchUpdateAnimations,
  groupAnimationsByTarget,
} from "../../src/plugins/animations/planAnimations.js";
import {
  createRenderContext,
  flushDeferredMountOperations,
} from "../../src/plugins/elements/renderContext.js";

describe("dispatchUpdateAnimations", () => {
  it("returns false when the target has no update animations", () => {
    const animationBus = { dispatch: vi.fn() };
    const completionTracker = {
      getVersion: vi.fn(),
      track: vi.fn(),
      complete: vi.fn(),
    };

    const dispatched = dispatchUpdateAnimations({
      animations: groupAnimationsByTarget([
        {
          id: "scene-transition",
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
      ]),
      targetId: "child-1",
      animationBus,
      completionTracker,
      element: { x: 100, alpha: 1 },
      targetState: { x: 100, alpha: 1 },
    });

    expect(dispatched).toBe(false);
    expect(animationBus.dispatch).not.toHaveBeenCalled();
    expect(completionTracker.track).not.toHaveBeenCalled();
  });

  it("dispatches immediate update animations and completes tracked callbacks", () => {
    const animationBus = { dispatch: vi.fn() };
    const completionTracker = {
      getVersion: vi.fn().mockReturnValueOnce(7).mockReturnValueOnce(8),
      track: vi.fn(),
      complete: vi.fn(),
    };
    const onComplete = vi.fn();
    const element = {
      x: 100,
      alpha: 1,
    };

    const animations = groupAnimationsByTarget([
      {
        id: "child-update-position",
        targetId: "child-1",
        type: "update",
        tween: {
          x: {
            initialValue: 20,
            keyframes: [{ duration: 300, value: 100, easing: "linear" }],
          },
        },
      },
      {
        id: "child-update-alpha",
        targetId: "child-1",
        type: "update",
        tween: {
          alpha: {
            initialValue: 0,
            keyframes: [{ duration: 300, value: 1, easing: "linear" }],
          },
        },
      },
      {
        id: "other-update",
        targetId: "child-2",
        type: "update",
        tween: {
          alpha: {
            initialValue: 0,
            keyframes: [{ duration: 150, value: 1, easing: "linear" }],
          },
        },
      },
    ]);

    const dispatched = dispatchUpdateAnimations({
      animations,
      targetId: "child-1",
      animationBus,
      completionTracker,
      element,
      targetState: { x: 100, alpha: 1 },
      onComplete,
    });

    expect(dispatched).toBe(true);
    expect(animationBus.dispatch).toHaveBeenCalledTimes(2);
    expect(completionTracker.track).toHaveBeenNthCalledWith(1, 7);
    expect(completionTracker.track).toHaveBeenNthCalledWith(2, 8);

    const firstDispatch = animationBus.dispatch.mock.calls[0][0];
    const secondDispatch = animationBus.dispatch.mock.calls[1][0];

    expect(firstDispatch).toEqual(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "child-update-position",
          element,
          targetState: { x: 100, alpha: 1 },
        }),
      }),
    );
    expect(secondDispatch).toEqual(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "child-update-alpha",
          element,
          targetState: { x: 100, alpha: 1 },
        }),
      }),
    );

    firstDispatch.payload.onComplete();
    secondDispatch.payload.onComplete();

    expect(completionTracker.complete).toHaveBeenNthCalledWith(1, 7);
    expect(completionTracker.complete).toHaveBeenNthCalledWith(2, 8);
    expect(onComplete.mock.calls.map(([animation]) => animation.id)).toEqual([
      "child-update-position",
      "child-update-alpha",
    ]);
  });

  it("defers update animations during suppressed mounts and applies initial values", () => {
    const animationBus = { dispatch: vi.fn() };
    const completionTracker = {
      getVersion: () => 7,
      track: vi.fn(),
      complete: vi.fn(),
    };
    const renderContext = createRenderContext({ suppressAnimations: true });
    const element = {
      x: 100,
      alpha: 1,
    };

    const animations = groupAnimationsByTarget([
      {
        id: "child-update",
        targetId: "child-1",
        type: "update",
        tween: {
          x: {
            initialValue: 20,
            keyframes: [{ duration: 300, value: 100, easing: "linear" }],
          },
          alpha: {
            initialValue: 0,
            keyframes: [{ duration: 300, value: 1, easing: "linear" }],
          },
        },
      },
    ]);

    const dispatched = dispatchUpdateAnimations({
      animations,
      targetId: "child-1",
      animationBus,
      completionTracker,
      element,
      targetState: { x: 100, alpha: 1 },
      renderContext,
    });

    expect(dispatched).toBe(true);
    expect(element.x).toBe(20);
    expect(element.alpha).toBe(0);
    expect(animationBus.dispatch).not.toHaveBeenCalled();
    expect(completionTracker.track).not.toHaveBeenCalled();

    flushDeferredMountOperations(renderContext);

    expect(completionTracker.track).toHaveBeenCalledWith(7);
    expect(animationBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "child-update",
          element,
          targetState: { x: 100, alpha: 1 },
        }),
      }),
    );
  });

  it("throws when deferred update animations receive an onComplete hook", () => {
    const animations = groupAnimationsByTarget([
      {
        id: "child-update",
        targetId: "child-1",
        type: "update",
        tween: {
          alpha: {
            initialValue: 0,
            keyframes: [{ duration: 300, value: 1, easing: "linear" }],
          },
        },
      },
    ]);

    expect(() =>
      dispatchUpdateAnimations({
        animations,
        targetId: "child-1",
        animationBus: { dispatch: vi.fn() },
        completionTracker: {
          getVersion: () => 7,
          track: vi.fn(),
          complete: vi.fn(),
        },
        element: { alpha: 1 },
        targetState: { alpha: 1 },
        onComplete: vi.fn(),
        renderContext: createRenderContext({ suppressAnimations: true }),
      }),
    ).toThrow("Deferred update animations do not support onComplete hooks.");
  });
});
