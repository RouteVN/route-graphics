import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { runTextReveal } from "./textRevealingRuntime.js";

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

    await runTextReveal({
      container: textRevealingElement,
      element,
      completionTracker,
      animationBus,
      zIndex,
      signal,
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
