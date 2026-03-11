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

export const getAnimationsForOperation = (
  animationsOrMap,
  targetId,
  operation,
) =>
  getTargetAnimations(animationsOrMap, targetId).filter(
    (animation) => animation.operation === operation,
  );

export const validateTargetOperations = (
  animationsOrMap,
  targetId,
  allowedOperations,
) => {
  const relevantAnimations = getTargetAnimations(animationsOrMap, targetId);

  for (const animation of relevantAnimations) {
    if (!allowedOperations.includes(animation.operation)) {
      throw new Error(
        `Animation "${animation.id}" targets "${targetId}" with operation "${animation.operation}", which is not valid for this lifecycle.`,
      );
    }
  }

  return relevantAnimations;
};
