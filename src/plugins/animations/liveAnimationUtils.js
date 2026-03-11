import { getAnimationsForOperation } from "./planAnimations.js";

export const dispatchLiveAnimations = ({
  animations,
  targetId,
  operation,
  animationBus,
  completionTracker,
  element,
  targetState,
  onComplete,
}) => {
  const relevantAnimations = getAnimationsForOperation(
    animations,
    targetId,
    operation,
  );

  if (relevantAnimations.length === 0) {
    return false;
  }

  for (const animation of relevantAnimations) {
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element,
        properties: animation.properties,
        targetState,
        onComplete: () => {
          completionTracker.complete(stateVersion);
          onComplete?.(animation);
        },
      },
    });
  }

  return true;
};
