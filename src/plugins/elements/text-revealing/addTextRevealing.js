import { Container } from "pixi.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { queueDeferredTextRevealAutoplay } from "../renderContext.js";
import {
  runTextReveal,
  shouldRenderTextRevealImmediately,
} from "./textRevealingRuntime.js";

/**
 * Add text-revealing element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addTextRevealing = async ({
  app,
  parent,
  element,
  animations,
  animationBus,
  renderContext,
  completionTracker,
  zIndex,
  signal,
}) => {
  if (signal?.aborted) return;

  const container = new Container();
  container.label = element.id;
  container.zIndex = zIndex;

  if (element.x !== undefined) container.x = Math.round(element.x);
  if (element.y !== undefined) container.y = Math.round(element.y);
  if (element.alpha !== undefined) container.alpha = element.alpha;
  parent.addChild(container);

  dispatchLiveAnimations({
    animations,
    targetId: element.id,
    animationBus,
    completionTracker,
    element: container,
    targetState: {
      x: element.x ?? container.x,
      y: element.y ?? container.y,
      alpha: element.alpha ?? container.alpha,
    },
    renderContext,
  });

  if (
    renderContext?.suppressAnimations &&
    !shouldRenderTextRevealImmediately(element)
  ) {
    await runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex,
      signal,
      app,
      playback: "paused-initial",
    });

    queueDeferredTextRevealAutoplay(renderContext, {
      container,
      element,
      completionTracker,
      animationBus,
      zIndex,
      signal,
      app,
    });
    return;
  }

  await runTextReveal({
    container,
    element,
    completionTracker,
    animationBus,
    zIndex,
    signal,
    app,
    playback: "autoplay",
  });
};
