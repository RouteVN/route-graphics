import { describe, expect, it, vi } from "vitest";
import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";

describe("animationBus auto tween shorthand", () => {
  it("animates to the targetState value for auto tween properties", () => {
    const animationBus = createAnimationBus();
    const onComplete = vi.fn();
    const element = {
      x: 20,
      alpha: 0.4,
      scale: { x: 1, y: 1 },
    };

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "auto-x",
        element,
        properties: {
          x: {
            auto: {
              duration: 400,
              easing: "linear",
            },
          },
        },
        targetState: { x: 120 },
        onComplete,
      },
    });

    animationBus.flush();

    expect(element.x).toBe(20);

    animationBus.tick(200);
    expect(element.x).toBeCloseTo(70);

    animationBus.tick(200);
    expect(element.x).toBeCloseTo(120);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("completes immediately when auto tween target already matches current state", () => {
    const animationBus = createAnimationBus();
    const onComplete = vi.fn();
    const element = {
      x: 20,
      scale: { x: 1, y: 1 },
    };

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "auto-noop",
        element,
        properties: {
          x: {
            auto: {
              duration: 300,
            },
          },
        },
        targetState: { x: 20 },
        onComplete,
      },
    });

    animationBus.flush();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(animationBus.getState().activeCount).toBe(0);
  });

  it("throws when auto tween cannot resolve a targetState value", () => {
    const animationBus = createAnimationBus();

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "auto-missing-target",
        element: {
          x: 20,
          scale: { x: 1, y: 1 },
        },
        properties: {
          x: {
            auto: {
              duration: 300,
            },
          },
        },
        targetState: {},
      },
    });

    expect(() => animationBus.flush()).toThrow(
      'Animation "auto-missing-target" cannot auto-resolve property "x" from targetState.',
    );
  });

  it("supports mixed auto and manual tween properties in one animation", () => {
    const animationBus = createAnimationBus();
    const element = {
      x: 20,
      alpha: 1,
      scale: { x: 1, y: 1 },
    };

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "auto-and-manual",
        element,
        properties: {
          x: {
            auto: {
              duration: 400,
              easing: "linear",
            },
          },
          alpha: {
            keyframes: [{ duration: 400, value: 0.25, easing: "linear" }],
          },
        },
        targetState: { x: 120, alpha: 0.25 },
      },
    });

    animationBus.flush();
    animationBus.tick(200);

    expect(element.x).toBeCloseTo(70);
    expect(element.alpha).toBeCloseTo(0.625);
  });

  it("applies property path mapping for auto scale tweens", () => {
    const animationBus = createAnimationBus();
    const onComplete = vi.fn();
    const element = {
      x: 20,
      alpha: 1,
      scale: { x: 1, y: 1 },
    };

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "auto-scale",
        element,
        properties: {
          scaleX: {
            auto: {
              duration: 200,
              easing: "linear",
            },
          },
          scaleY: {
            auto: {
              duration: 200,
              easing: "linear",
            },
          },
        },
        targetState: { scaleX: 1.5, scaleY: 0.5 },
        onComplete,
      },
    });

    animationBus.flush();
    animationBus.tick(100);

    expect(element.scale.x).toBeCloseTo(1.25);
    expect(element.scale.y).toBeCloseTo(0.75);

    animationBus.tick(100);

    expect(element.scale.x).toBeCloseTo(1.5);
    expect(element.scale.y).toBeCloseTo(0.5);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("samples property animations at an exact time without completing them", () => {
    const animationBus = createAnimationBus();
    const onComplete = vi.fn();
    const element = {
      x: 10,
      scale: { x: 1, y: 1 },
    };

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "manual-time",
        element,
        properties: {
          x: {
            keyframes: [{ duration: 400, value: 110, easing: "linear" }],
          },
        },
        onComplete,
      },
    });

    animationBus.flush();
    animationBus.setTime(250);

    expect(element.x).toBeCloseTo(72.5);
    expect(onComplete).not.toHaveBeenCalled();
    expect(animationBus.getState().animations).toEqual([
      expect.objectContaining({
        id: "manual-time",
        currentTime: 250,
        duration: 400,
      }),
    ]);
  });

  it("samples custom animations without running completion or target-state hooks", () => {
    const animationBus = createAnimationBus();
    const applyFrame = vi.fn();
    const applyTargetState = vi.fn();
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "custom-manual-time",
        driver: "custom",
        duration: 500,
        applyFrame,
        applyTargetState,
        onComplete,
        onCancel,
      },
    });

    animationBus.flush();
    applyFrame.mockClear();

    animationBus.setTime(300);

    expect(applyFrame).toHaveBeenCalledTimes(1);
    expect(applyFrame).toHaveBeenCalledWith(300);
    expect(applyTargetState).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("completes custom animations when sampled time reaches the end", () => {
    const animationBus = createAnimationBus();
    const applyFrame = vi.fn();
    const applyTargetState = vi.fn();
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "custom-manual-time-complete",
        driver: "custom",
        duration: 500,
        applyFrame,
        applyTargetState,
        onComplete,
        onCancel,
      },
    });

    animationBus.flush();
    applyFrame.mockClear();

    animationBus.setTime(500);

    expect(applyFrame).toHaveBeenCalledTimes(1);
    expect(applyFrame).toHaveBeenCalledWith(500);
    expect(applyTargetState).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(animationBus.getState().activeCount).toBe(0);
  });

  it("keeps explicitly preserved persistent animations active across selective cancellation", () => {
    const animationBus = createAnimationBus();
    const onCancel = vi.fn();
    const element = {
      x: 10,
      scale: { x: 1, y: 1 },
    };

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "persistent-update",
        animationType: "update",
        targetId: "bg",
        continuity: "persistent",
        signature: '{"type":"update"}',
        element,
        properties: {
          x: {
            keyframes: [{ duration: 1000, value: 110, easing: "linear" }],
          },
        },
        onCancel,
      },
    });

    animationBus.flush();
    animationBus.tick(300);
    expect(element.x).toBeCloseTo(40);

    animationBus.cancelAllExcept(new Set(["persistent-update"]));
    animationBus.tick(100);

    expect(element.x).toBeCloseTo(50);
    expect(onCancel).not.toHaveBeenCalled();
    expect(animationBus.isAnimating("persistent-update")).toBe(true);
  });

  it("exposes pending persistent contexts for continuity planning and cancels unkept ones", () => {
    const animationBus = createAnimationBus();
    const onCancel = vi.fn();

    animationBus.registerPending({
      id: "pending-transition",
      animationType: "transition",
      targetId: "scene-root",
      continuity: "persistent",
      signature: '{"type":"transition"}',
      onCancel,
    });

    expect(animationBus.hasContext("pending-transition")).toBe(true);
    expect(animationBus.getContinuableAnimations()).toEqual(
      new Map([
        [
          "pending-transition",
          {
            id: "pending-transition",
            type: "transition",
            targetId: "scene-root",
            signature: '{"type":"transition"}',
            continuity: "persistent",
            pending: true,
          },
        ],
      ]),
    );

    animationBus.cancelAllExcept(new Set());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(animationBus.hasContext("pending-transition")).toBe(false);
  });

  it("updates continuation metadata for active and pending contexts", () => {
    const animationBus = createAnimationBus();
    const activeUpdate = vi.fn();
    const pendingUpdate = vi.fn();

    animationBus.dispatch({
      type: "START",
      payload: {
        id: "active-transition",
        driver: "custom",
        animationType: "transition",
        targetId: "scene-root",
        continuity: "persistent",
        signature: '{"type":"transition"}',
        duration: 500,
        onContinuationUpdate: activeUpdate,
      },
    });
    animationBus.flush();

    animationBus.registerPending({
      id: "pending-transition",
      animationType: "transition",
      targetId: "scene-root",
      continuity: "persistent",
      signature: '{"type":"transition"}',
      onContinuationUpdate: pendingUpdate,
    });

    animationBus.updateContinuation("active-transition", { zIndex: 7 });
    animationBus.updateContinuation("pending-transition", { zIndex: 3 });

    expect(activeUpdate).toHaveBeenCalledWith({ zIndex: 7 });
    expect(pendingUpdate).toHaveBeenCalledWith({ zIndex: 3 });
  });
});
