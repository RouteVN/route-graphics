import {
  TRANSITION_PROPERTY_PATH_MAP,
  WhiteListAnimationProps,
} from "../../types.js";
import { queueDeferredMountEffect } from "../elements/renderContext.js";

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

const getMappedPath = (propertyPathMap, path) => {
  if (typeof path !== "string") {
    return path;
  }

  return propertyPathMap[path] ?? path;
};

const setAnimationProperty = (object, path, propertyPathMap, value) => {
  const mappedPath = getMappedPath(propertyPathMap, path);

  if (typeof mappedPath === "string") {
    object[mappedPath] = value;
    return object;
  }

  let current = object;
  for (let index = 0; index < mappedPath.length - 1; index++) {
    const key = mappedPath[index];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[mappedPath[mappedPath.length - 1]] = value;
  return object;
};

const applyInitialAnimationState = (
  element,
  properties,
  propertyPathMap = TRANSITION_PROPERTY_PATH_MAP,
) => {
  for (const [property, config] of Object.entries(properties)) {
    if (!WhiteListAnimationProps[property]) {
      throw new Error(`${property} is not a supported property for animation.`);
    }

    if (config.initialValue === undefined) {
      continue;
    }

    setAnimationProperty(
      element,
      property,
      propertyPathMap,
      config.initialValue,
    );
  }
};

const startUpdateAnimations = ({
  relevantAnimations,
  animationBus,
  completionTracker,
  element,
  targetState,
  onComplete,
}) => {
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

  if (relevantAnimations.length === 0) {
    return false;
  }

  if (renderContext?.suppressAnimations) {
    for (const animation of relevantAnimations) {
      applyInitialAnimationState(element, animation.tween);
    }

    queueDeferredMountEffect(renderContext, () => {
      if (!element || element.destroyed) {
        return;
      }

      startUpdateAnimations({
        relevantAnimations,
        animationBus,
        completionTracker,
        element,
        targetState,
        onComplete,
      });
    });

    return true;
  }

  startUpdateAnimations({
    relevantAnimations,
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
