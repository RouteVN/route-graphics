import {
  TRANSITION_PROPERTY_PATH_MAP,
  WhiteListAnimationProps,
} from "../../types.js";

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

export const applyInitialUpdateAnimationState = (
  element,
  animations,
  propertyPathMap = TRANSITION_PROPERTY_PATH_MAP,
) => {
  for (const animation of animations) {
    for (const [property, config] of Object.entries(animation.tween)) {
      if (!WhiteListAnimationProps[property]) {
        throw new Error(
          `${property} is not a supported property for animation.`,
        );
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
  }
};

export const dispatchUpdateAnimationsNow = ({
  animations,
  animationBus,
  completionTracker,
  element,
  targetState,
  onComplete,
}) => {
  for (const animation of animations) {
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
