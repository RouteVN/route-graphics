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
});
