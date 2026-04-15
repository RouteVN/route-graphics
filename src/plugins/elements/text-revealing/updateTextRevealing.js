import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { queueDeferredTextRevealAutoplay } from "../renderContext.js";
import {
  runTextReveal,
  shouldRenderTextRevealImmediately,
} from "./textRevealingRuntime.js";
import { normalizeSoftWipeConfig } from "./softWipeConfig.js";

const getRevealIdentity = (element = {}) =>
  JSON.stringify({
    content: element.content ?? null,
    revealEffect: element.revealEffect ?? "typewriter",
    softWipe:
      (element.revealEffect ?? "typewriter") === "softWipe"
        ? normalizeSoftWipeConfig(element.softWipe)
        : null,
    speed: element.speed ?? 50,
    width: element.width ?? null,
    indicator: element.indicator ?? null,
    x: element.x ?? null,
    y: element.y ?? null,
    alpha: element.alpha ?? 1,
  });

const shouldRestartReveal = (prevElement, nextElement) =>
  getRevealIdentity(prevElement) !== getRevealIdentity(nextElement);

/**
 * Simple render function for text-revealing elements
 * @param {import("../elementPlugin").UpdateElementOptions} params
 */
export const updateTextRevealing = async ({
  parent,
  prevElement,
  nextElement: element,
  animations,
  animationBus,
  renderContext,
  completionTracker,
  zIndex,
  signal,
}) => {
  if (signal?.aborted) return;

  const textRevealingElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );
  if (!textRevealingElement) return;

  const updateElement = async () => {
    if (element.x !== undefined) textRevealingElement.x = element.x;
    if (element.y !== undefined) textRevealingElement.y = element.y;
    if (element.alpha !== undefined) {
      textRevealingElement.alpha = element.alpha;
    }

    if (!shouldRestartReveal(prevElement, element)) {
      if (
        renderContext?.suppressAnimations !== true &&
        !shouldRenderTextRevealImmediately(element)
      ) {
        await runTextReveal({
          container: textRevealingElement,
          element,
          completionTracker,
          animationBus,
          zIndex,
          signal,
          playback: "resume",
        });
      }

      return;
    }

    if (
      renderContext?.suppressAnimations === true &&
      !shouldRenderTextRevealImmediately(element)
    ) {
      await runTextReveal({
        container: textRevealingElement,
        element,
        completionTracker,
        animationBus,
        zIndex,
        signal,
        playback: "paused-initial",
      });

      queueDeferredTextRevealAutoplay(renderContext, {
        container: textRevealingElement,
        element,
        completionTracker,
        animationBus,
        zIndex,
        signal,
      });
      return;
    }

    await runTextReveal({
      container: textRevealingElement,
      element,
      completionTracker,
      animationBus,
      zIndex,
      signal,
      playback: "autoplay",
    });
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    animationBus,
    completionTracker,
    element: textRevealingElement,
    targetState: {
      x: element.x ?? textRevealingElement.x,
      y: element.y ?? textRevealingElement.y,
      alpha: element.alpha ?? textRevealingElement.alpha,
    },
    onComplete: () => {
      void updateElement();
    },
  });

  if (!dispatched) {
    await updateElement();
  }
};
