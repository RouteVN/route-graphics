import { dispatchUpdateAnimationsNow } from "../animations/updateAnimationDispatch.js";
import { runTextReveal } from "./text-revealing/textRevealingRuntime.js";

export const createRenderContext = ({
  suppressAnimations = false,
  deferredMountOperations = [],
} = {}) => ({
  suppressAnimations,
  deferredMountOperations,
});

const executeDeferredMountOperation = (operation) => {
  switch (operation?.type) {
    case "play-animated-sprite":
      if (!operation.animatedSprite?.destroyed) {
        operation.animatedSprite?.play();
      }
      return;
    case "play-video":
      operation.video?.play();
      return;
    case "start-particles":
      if (operation.app?.debug) {
        const customTickerHandler = (event) => {
          if (operation.emitter.destroyed) {
            window.removeEventListener("snapShotKeyFrame", customTickerHandler);
            return;
          }
          if (event?.detail?.deltaMS) {
            operation.emitter.update(Number(event.detail.deltaMS) / 1000);
          }
        };
        window.addEventListener("snapShotKeyFrame", customTickerHandler);
        operation.container.customTickerHandler = customTickerHandler;
        return;
      }

      operation.app.ticker.add(operation.tickerCallback);
      return;
    case "autoplay-text-reveal":
      void runTextReveal({
        container: operation.container,
        element: operation.element,
        completionTracker: operation.completionTracker,
        animationBus: operation.animationBus,
        zIndex: operation.zIndex,
        signal: operation.signal,
        playback: "autoplay",
      });
      return;
    case "start-update-animations":
      if (!operation.element || operation.element.destroyed) {
        return;
      }

      dispatchUpdateAnimationsNow({
        animations: operation.animations,
        animationBus: operation.animationBus,
        completionTracker: operation.completionTracker,
        element: operation.element,
        targetState: operation.targetState,
      });
      return;
  }
};

const queueDeferredMountOperation = (renderContext, operation) => {
  if (!operation?.type) {
    return;
  }

  if (!renderContext?.suppressAnimations) {
    executeDeferredMountOperation(operation);
    return;
  }

  renderContext.deferredMountOperations.push(operation);
};

export const clearDeferredMountOperations = (renderContext) => {
  if (!renderContext?.deferredMountOperations) {
    return;
  }

  renderContext.deferredMountOperations.length = 0;
};

export const queueDeferredAnimatedSpritePlay = (
  renderContext,
  animatedSprite,
) =>
  queueDeferredMountOperation(renderContext, {
    type: "play-animated-sprite",
    animatedSprite,
  });

export const queueDeferredVideoPlay = (renderContext, video) =>
  queueDeferredMountOperation(renderContext, {
    type: "play-video",
    video,
  });

export const queueDeferredParticlesStart = (
  renderContext,
  { app, emitter, container, tickerCallback },
) =>
  queueDeferredMountOperation(renderContext, {
    type: "start-particles",
    app,
    emitter,
    container,
    tickerCallback,
  });

export const queueDeferredTextRevealAutoplay = (
  renderContext,
  { container, element, completionTracker, animationBus, zIndex, signal },
) =>
  queueDeferredMountOperation(renderContext, {
    type: "autoplay-text-reveal",
    container,
    element,
    completionTracker,
    animationBus,
    zIndex,
    signal,
  });

export const queueDeferredUpdateAnimationStart = (
  renderContext,
  { animations, animationBus, completionTracker, element, targetState },
) =>
  queueDeferredMountOperation(renderContext, {
    type: "start-update-animations",
    animations,
    animationBus,
    completionTracker,
    element,
    targetState,
  });

export const flushDeferredMountOperations = (renderContext) => {
  if (!renderContext?.deferredMountOperations?.length) {
    return;
  }

  const operations = renderContext.deferredMountOperations.splice(0);

  for (const operation of operations) {
    executeDeferredMountOperation(operation);
  }
};
