import {
  TRANSITION_PROPERTY_PATH_MAP,
  WhiteListAnimationProps,
} from "../../types.js";
import {
  buildTimeline,
  calculateMaxDuration,
  getValueAtTime,
} from "../../util/animationTimeline.js";

const getMappedPath = (propertyPathMap, path) => {
  if (typeof path !== "string") {
    return path;
  }

  return propertyPathMap[path] ?? path;
};

const getAnimationProperty = (object, path, propertyPathMap, defaultValue) => {
  const mappedPath = getMappedPath(propertyPathMap, path);

  if (typeof mappedPath === "string") {
    const result = object[mappedPath];
    return result === undefined ? defaultValue : result;
  }

  let result = object;
  for (const key of mappedPath) {
    if (result == null) {
      return defaultValue;
    }
    result = result[key];
  }

  return result === undefined ? defaultValue : result;
};

const setAnimationProperty = (object, path, propertyPathMap, value) => {
  const mappedPath = getMappedPath(propertyPathMap, path);

  if (typeof mappedPath === "string") {
    object[mappedPath] = value;
    return object;
  }

  let current = object;
  for (let i = 0; i < mappedPath.length - 1; i++) {
    const key = mappedPath[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[mappedPath[mappedPath.length - 1]] = value;
  return object;
};

const resolveAutoTargetValue = (targetState, property, animationId) => {
  if (
    !targetState ||
    !Object.prototype.hasOwnProperty.call(targetState, property)
  ) {
    throw new Error(
      `Animation "${animationId}" cannot auto-resolve property "${property}" from targetState.`,
    );
  }

  return targetState[property];
};

const buildPropertyTimelines = (
  element,
  properties,
  propertyPathMap,
  targetState,
  animationId,
) =>
  Object.entries(properties)
    .map(([property, config]) => {
      if (!WhiteListAnimationProps[property]) {
        throw new Error(
          `${property} is not a supported property for animation.`,
        );
      }

      const currentValue = getAnimationProperty(
        element,
        property,
        propertyPathMap,
        0,
      );

      if (config.auto) {
        const targetValue = resolveAutoTargetValue(
          targetState,
          property,
          animationId,
        );

        if (currentValue === targetValue) {
          return null;
        }

        const timeline = buildTimeline([
          { value: currentValue },
          {
            duration: config.auto.duration,
            value: targetValue,
            easing: config.auto.easing,
          },
        ]);

        return { property, timeline };
      }

      const initialValue = config.initialValue ?? currentValue;
      const timeline = buildTimeline([
        { value: initialValue },
        ...config.keyframes,
      ]);

      return { property, timeline };
    })
    .filter(Boolean);

/**
 * Creates an animation bus that manages all active animations centrally.
 * It supports both update property animations and custom transition runners.
 * @returns {AnimationBus}
 */
export const createAnimationBus = () => {
  const commandQueue = [];
  const activeAnimations = new Map();
  const listeners = new Map();
  let stateVersion = 0;

  const emit = (event, data) => {
    listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (_error) {
        // Listener errors should not break animation processing.
      }
    });
  };

  const fireCompleteEvent = (context) => {
    emit("completed", { id: context.id });

    if (context.onComplete) {
      try {
        context.onComplete();
      } catch (_error) {
        // Completion callbacks are best-effort.
      }
    }
  };

  const startPropertyAnimation = (payload) => {
    const {
      id,
      element,
      properties,
      targetState,
      onComplete,
      onCancel,
      propertyPathMap = TRANSITION_PROPERTY_PATH_MAP,
    } = payload;

    const timelines = buildPropertyTimelines(
      element,
      properties,
      propertyPathMap,
      targetState,
      id,
    );

    if (timelines.length === 0) {
      fireCompleteEvent({ id, onComplete });
      return;
    }

    const context = {
      id,
      kind: "property",
      element,
      timelines,
      duration: calculateMaxDuration(timelines),
      currentTime: 0,
      stateVersion,
      targetState,
      onComplete,
      onCancel,
      applyFrame: (time) => {
        for (const { property, timeline } of timelines) {
          const value = getValueAtTime(timeline, time);
          try {
            setAnimationProperty(element, property, propertyPathMap, value);
          } catch (_error) {
            // Element might be mid-destroy or otherwise invalid.
          }
        }
      },
      applyTargetState: () => {
        if (!element || element.destroyed) return;

        if (targetState === null) {
          element.destroy();
          return;
        }

        if (!targetState) return;

        for (const [property, value] of Object.entries(targetState)) {
          try {
            setAnimationProperty(element, property, propertyPathMap, value);
          } catch (_error) {
            // Skip properties that fail to apply.
          }
        }
      },
      isValid: () => Boolean(element) && !element.destroyed,
    };

    context.applyFrame(0);
    activeAnimations.set(id, context);
    emit("started", { id });
  };

  const startCustomAnimation = (payload) => {
    const context = {
      id: payload.id,
      kind: "custom",
      duration: payload.duration ?? 0,
      currentTime: 0,
      stateVersion,
      onComplete: payload.onComplete,
      onCancel: payload.onCancel,
      applyFrame: payload.applyFrame ?? (() => {}),
      applyTargetState: payload.applyTargetState ?? (() => {}),
      isValid: payload.isValid ?? (() => true),
    };

    context.applyFrame(0);
    activeAnimations.set(context.id, context);
    emit("started", { id: context.id });
  };

  const startAnimation = (payload) => {
    if (payload.driver === "custom") {
      startCustomAnimation(payload);
      return;
    }

    startPropertyAnimation(payload);
  };

  const applyCancellation = (context) => {
    try {
      context.applyTargetState?.();
    } catch (_error) {
      // Best-effort cancellation.
    }

    if (context.onCancel) {
      try {
        context.onCancel();
      } catch (_error) {
        // Best-effort cancellation callback.
      }
    }
  };

  const executeCommand = (cmd) => {
    switch (cmd.type) {
      case "START":
        startAnimation(cmd.payload);
        break;
      case "CANCEL":
        cancelAnimation(cmd.id);
        break;
    }
  };

  const processQueue = () => {
    const commands = commandQueue.splice(0);
    for (const command of commands) {
      executeCommand(command);
    }
  };

  const cancelAnimation = (id) => {
    const context = activeAnimations.get(id);
    if (!context) return;

    applyCancellation(context);
    activeAnimations.delete(id);
    emit("cancelled", { id });
  };

  const dispatch = (command) => {
    commandQueue.push(command);
  };

  const cancelAll = () => {
    for (const [id, context] of activeAnimations) {
      applyCancellation(context);
      emit("cancelled", { id });
    }

    activeAnimations.clear();
    stateVersion++;
  };

  const tick = (deltaMS) => {
    processQueue();

    const toRemove = [];

    for (const [id, context] of activeAnimations) {
      if (context.stateVersion !== stateVersion) {
        toRemove.push(id);
        continue;
      }

      if (!context.isValid()) {
        toRemove.push(id);
        continue;
      }

      context.currentTime += deltaMS;

      if (context.currentTime >= context.duration) {
        context.applyFrame(context.duration);
        fireCompleteEvent(context);
        toRemove.push(id);
        continue;
      }

      context.applyFrame(context.currentTime);
    }

    for (const id of toRemove) {
      activeAnimations.delete(id);
    }
  };

  const flush = () => {
    processQueue();
  };

  const on = (event, callback) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }

    listeners.get(event).add(callback);
    return () => off(event, callback);
  };

  const off = (event, callback) => {
    listeners.get(event)?.delete(callback);
  };

  const getState = () => ({
    stateVersion,
    activeCount: activeAnimations.size,
    animations: Array.from(activeAnimations.entries()).map(([id, ctx]) => ({
      id,
      currentTime: ctx.currentTime,
      duration: ctx.duration,
      progress: ctx.duration > 0 ? ctx.currentTime / ctx.duration : 0,
    })),
  });

  const isAnimating = (id) => activeAnimations.has(id);

  const destroy = () => {
    cancelAll();
    listeners.clear();
  };

  return {
    dispatch,
    cancelAll,
    flush,
    tick,
    on,
    off,
    getState,
    isAnimating,
    destroy,
  };
};
