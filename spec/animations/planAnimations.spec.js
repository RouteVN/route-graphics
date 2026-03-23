import { describe, expect, it, vi } from "vitest";
import {
  dispatchUpdateAnimations,
  groupAnimationsByTarget,
} from "../../src/plugins/animations/planAnimations.js";
import {
  createRenderContext,
  flushDeferredMountEffects,
} from "../../src/plugins/elements/renderContext.js";

describe("dispatchUpdateAnimations", () => {
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

    flushDeferredMountEffects(renderContext);

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
});
