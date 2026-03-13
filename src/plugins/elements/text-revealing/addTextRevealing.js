import { Container } from "pixi.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { runTextReveal } from "./textRevealingRuntime.js";

/**
 * Add text-revealing element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addTextRevealing = async ({
  parent,
  element,
  animations,
  animationBus,
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
      x: element.x ?? 0,
      y: element.y ?? 0,
      alpha: element.alpha ?? 1,
    },
  });

  await runTextReveal({
    container,
    element,
    completionTracker,
    animationBus,
    zIndex,
    signal,
  });
};
