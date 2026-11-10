import { describe, expect, it, vi } from "vitest";
import {
  clearDeferredMountOperations,
  createRenderContext,
  flushDeferredMountOperations,
  queueDeferredAnimatedSpritePlay,
  queueDeferredParticlesStart,
  queueDeferredTextRevealAutoplay,
  queueDeferredUpdateAnimationStart,
  queueDeferredVideoPlay,
  startDeferredPlaybackOperations,
} from "./renderContext.js";

const queuePreparedGsap = (renderContext, { element, rollback }) => {
  queueDeferredUpdateAnimationStart(renderContext, {
    animations: [],
    animationBus: {},
    completionTracker: {},
    element,
    preparedGsap: new Map([["enter", { bindingContext: { rollback } }]]),
  });
};

describe("deferred update animation cleanup", () => {
  it("rolls back prepared GSAP bindings when deferred work is cleared", () => {
    const rollback = vi.fn();
    const renderContext = createRenderContext({ suppressAnimations: true });
    queuePreparedGsap(renderContext, {
      element: { destroyed: false },
      rollback,
    });

    clearDeferredMountOperations(renderContext);

    expect(rollback).toHaveBeenCalledOnce();
    expect(renderContext.deferredMountOperations).toEqual([]);
  });

  it("rolls back prepared GSAP bindings if their element was destroyed", () => {
    const rollback = vi.fn();
    const renderContext = createRenderContext({ suppressAnimations: true });
    queuePreparedGsap(renderContext, {
      element: { destroyed: true },
      rollback,
    });

    flushDeferredMountOperations(renderContext);

    expect(rollback).toHaveBeenCalledOnce();
  });
});

describe("deferred playback of an element kept after a cancelled transition", () => {
  const createApp = () => ({
    ticker: { add: vi.fn(), remove: vi.fn() },
  });

  it("starts particles, animated sprites and videos", () => {
    const renderContext = createRenderContext({ suppressAnimations: true });
    const app = createApp();
    const tickerCallback = vi.fn();
    const animatedSprite = { destroyed: false, play: vi.fn() };
    const video = { play: vi.fn(() => Promise.resolve()) };
    queueDeferredParticlesStart(renderContext, {
      app,
      emitter: { destroyed: false },
      container: {},
      tickerCallback,
    });
    queueDeferredAnimatedSpritePlay(renderContext, animatedSprite);
    queueDeferredVideoPlay(renderContext, video);

    startDeferredPlaybackOperations(renderContext);

    expect(app.ticker.add).toHaveBeenCalledExactlyOnceWith(tickerCallback);
    expect(animatedSprite.play).toHaveBeenCalledOnce();
    expect(video.play).toHaveBeenCalledOnce();
    expect(renderContext.deferredMountOperations).toEqual([]);
  });

  it("drops the work that belongs to the superseded render", () => {
    const renderContext = createRenderContext({ suppressAnimations: true });
    const rollback = vi.fn();
    const animationBus = { dispatch: vi.fn() };
    const completionTracker = { track: vi.fn(), getVersion: vi.fn() };
    queuePreparedGsap(renderContext, {
      element: { destroyed: false },
      rollback,
    });
    queueDeferredTextRevealAutoplay(renderContext, {
      container: { destroyed: false },
      element: { id: "line" },
      completionTracker,
      animationBus,
    });

    startDeferredPlaybackOperations(renderContext);

    expect(rollback).toHaveBeenCalledOnce();
    expect(animationBus.dispatch).not.toHaveBeenCalled();
    expect(completionTracker.track).not.toHaveBeenCalled();
    expect(completionTracker.getVersion).not.toHaveBeenCalled();
    expect(renderContext.deferredMountOperations).toEqual([]);
  });

  it("does not start a destroyed emitter or animated sprite", () => {
    const renderContext = createRenderContext({ suppressAnimations: true });
    const app = createApp();
    const animatedSprite = { destroyed: true, play: vi.fn() };
    queueDeferredParticlesStart(renderContext, {
      app,
      emitter: { destroyed: true },
      container: {},
      tickerCallback: vi.fn(),
    });
    queueDeferredAnimatedSpritePlay(renderContext, animatedSprite);

    startDeferredPlaybackOperations(renderContext);

    expect(app.ticker.add).not.toHaveBeenCalled();
    expect(animatedSprite.play).not.toHaveBeenCalled();
  });

  it("does not listen for debug frames on behalf of a destroyed emitter", () => {
    const renderContext = createRenderContext({ suppressAnimations: true });
    const addEventListener = vi.spyOn(window, "addEventListener");
    const container = {};
    queueDeferredParticlesStart(renderContext, {
      app: { debug: true },
      emitter: { destroyed: true },
      container,
      tickerCallback: vi.fn(),
    });

    flushDeferredMountOperations(renderContext);

    expect(addEventListener).not.toHaveBeenCalled();
    expect(container.customTickerHandler).toBeUndefined();
    addEventListener.mockRestore();
  });

  it("drives debug particles from snapshot key frames", () => {
    const renderContext = createRenderContext({ suppressAnimations: true });
    const emitter = { destroyed: false, update: vi.fn() };
    const app = { debug: true, render: vi.fn() };
    const container = {};
    queueDeferredParticlesStart(renderContext, {
      app,
      emitter,
      container,
      tickerCallback: vi.fn(),
    });

    startDeferredPlaybackOperations(renderContext);
    window.dispatchEvent(
      new CustomEvent("snapShotKeyFrame", { detail: { deltaMS: 500 } }),
    );

    expect(emitter.update).toHaveBeenCalledExactlyOnceWith(0.5);
    expect(app.render).toHaveBeenCalledOnce();
    window.removeEventListener(
      "snapShotKeyFrame",
      container.customTickerHandler,
    );
  });

  it("does nothing without queued work", () => {
    expect(() => startDeferredPlaybackOperations(undefined)).not.toThrow();
    expect(() =>
      startDeferredPlaybackOperations(createRenderContext()),
    ).not.toThrow();
  });
});
