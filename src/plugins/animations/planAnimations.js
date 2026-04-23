import {
  applyInitialUpdateAnimationState,
  dispatchUpdateAnimationsNow,
} from "./updateAnimationDispatch.js";
import { queueDeferredUpdateAnimationStart } from "../elements/renderContext.js";
import { isDeepEqual } from "../../util/isDeepEqual.js";

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

const findElementById = (elements = [], targetId) => {
  for (const element of elements) {
    if (element?.id === targetId) {
      return element;
    }

    if (Array.isArray(element?.children)) {
      const childMatch = findElementById(element.children, targetId);
      if (childMatch) {
        return childMatch;
      }
    }
  }

  return null;
};

export const getAnimationContinuitySignature = (animation = {}) => {
  if (animation.type === "update") {
    return JSON.stringify({
      type: animation.type,
      tween: animation.tween,
      playback: animation.playback ?? null,
    });
  }

  return JSON.stringify({
    type: animation.type,
    prev: animation.prev ?? null,
    next: animation.next ?? null,
    mask: animation.mask ?? null,
    playback: animation.playback ?? null,
  });
};

const canContinuePersistentUpdate = ({ prevState, nextState, animation }) => {
  const prevTarget = findElementById(prevState?.elements, animation.targetId);
  const nextTarget = findElementById(nextState?.elements, animation.targetId);

  return (
    prevTarget !== null &&
    nextTarget !== null &&
    isDeepEqual(prevTarget, nextTarget)
  );
};

const canContinuePersistentTransition = ({ prevState, nextState, animation }) =>
  isDeepEqual(
    findElementById(prevState?.elements, animation.targetId),
    findElementById(nextState?.elements, animation.targetId),
  );

export const buildAnimationContinuityPlan = ({
  prevState,
  nextState,
  activeAnimations,
}) => {
  const continuedAnimationIds = new Set();
  const activeById =
    activeAnimations instanceof Map
      ? activeAnimations
      : new Map(activeAnimations?.map((entry) => [entry.id, entry]) ?? []);

  for (const animation of nextState?.animations ?? []) {
    if (animation?.playback?.continuity !== "persistent") {
      continue;
    }

    const activeAnimation = activeById.get(animation.id);
    if (!activeAnimation) {
      continue;
    }

    if (
      activeAnimation.type !== animation.type ||
      activeAnimation.targetId !== animation.targetId ||
      activeAnimation.signature !== getAnimationContinuitySignature(animation)
    ) {
      continue;
    }

    if (animation.type === "update") {
      if (
        canContinuePersistentUpdate({
          prevState,
          nextState,
          animation,
        })
      ) {
        continuedAnimationIds.add(animation.id);
      }
      continue;
    }

    if (
      canContinuePersistentTransition({
        prevState,
        nextState,
        animation,
      })
    ) {
      continuedAnimationIds.add(animation.id);
    }
  }

  return {
    continuedAnimationIds,
  };
};

export const dispatchUpdateAnimations = ({
  animations,
  targetId,
  animationBus,
  completionTracker,
  element,
  targetState,
  onComplete,
  renderContext,
}) => {
  const relevantAnimations = getUpdateAnimations(animations, targetId);
  const continuedAnimations = relevantAnimations.filter((animation) =>
    typeof animationBus?.hasContext === "function"
      ? animationBus.hasContext(animation.id)
      : false,
  );
  const animationsToStart = relevantAnimations.filter(
    (animation) => !continuedAnimations.includes(animation),
  );

  if (relevantAnimations.length === 0) {
    return false;
  }

  if (animationsToStart.length === 0) {
    return true;
  }

  if (renderContext?.suppressAnimations) {
    if (onComplete) {
      throw new Error(
        "Deferred update animations do not support onComplete hooks.",
      );
    }

    applyInitialUpdateAnimationState(element, animationsToStart);

    queueDeferredUpdateAnimationStart(renderContext, {
      animations: animationsToStart,
      animationBus,
      completionTracker,
      element,
      targetState,
    });

    return true;
  }

  dispatchUpdateAnimationsNow({
    animations: animationsToStart,
    animationBus,
    completionTracker,
    element,
    targetState,
    onComplete,
  });

  return true;
};

export const getLiveAnimations = getUpdateAnimations;
export const getReplaceAnimation = getTransitionAnimation;
export const dispatchLiveAnimations = dispatchUpdateAnimations;
