export const groupAnimationsByTarget = (animations = []) => {
  if (animations instanceof Map) {
    return animations;
  }

  const byTarget = new Map();

  for (const animation of animations) {
    if (!byTarget.has(animation.targetId)) {
      byTarget.set(animation.targetId, []);
    }

    byTarget.get(animation.targetId).push(animation);
  }

  return byTarget;
};

export const getTargetAnimations = (animationsOrMap, targetId) => {
  if (animationsOrMap instanceof Map) {
    return animationsOrMap.get(targetId) ?? [];
  }

  return animationsOrMap.filter((animation) => animation.targetId === targetId);
};

export const getUpdateAnimations = (animationsOrMap, targetId) =>
  getTargetAnimations(animationsOrMap, targetId).filter(
    (animation) => animation.type === "update",
  );

export const getTransitionAnimation = (animationsOrMap, targetId) =>
  getTargetAnimations(animationsOrMap, targetId).find(
    (animation) => animation.type === "transition",
  ) ?? null;

export const dispatchUpdateAnimations = ({
  animations,
  targetId,
  animationBus,
  completionTracker,
  element,
  targetState,
  onComplete,
}) => {
  const relevantAnimations = getUpdateAnimations(animations, targetId);

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
        properties: animation.tween,
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

export const getLiveAnimations = getUpdateAnimations;
export const getReplaceAnimation = getTransitionAnimation;
export const dispatchLiveAnimations = dispatchUpdateAnimations;
