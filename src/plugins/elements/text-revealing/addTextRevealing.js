import { Container } from "pixi.js";
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
  parent,
  element,
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
      playback: "paused-initial",
    });

    queueDeferredTextRevealAutoplay(renderContext, {
      container,
      element,
      completionTracker,
      animationBus,
      zIndex,
      signal,
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
    playback: "autoplay",
  });
};
