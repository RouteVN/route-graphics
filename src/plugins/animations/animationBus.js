import {
  WhiteListTransitionProps,
  TRANSITION_PROPERTY_PATH_MAP,
} from "../../types.js";

// --- Easing Functions ---
const easings = {
  linear: (x) => x,
};

// --- Property Access Helpers ---
const getTransitionProperty = (object, path, defaultValue) => {
  if (typeof path === "string") {
    const mappedPath = TRANSITION_PROPERTY_PATH_MAP[path];
    if (mappedPath) {
      path = mappedPath;
    } else {
      // Property not in map, get directly from object
      const result = object[path];
      return result === undefined ? defaultValue : result;
    }
  }

  let result = object;
  for (const key of path) {
    if (result == null) {
      return defaultValue;
    }
    result = result[key];
  }
  return result === undefined ? defaultValue : result;
};

const setTransitionProperty = (object, path, value) => {
  if (typeof path === "string") {
    const mappedPath = TRANSITION_PROPERTY_PATH_MAP[path];
    if (mappedPath) {
      path = mappedPath;
    } else {
      // Property not in map, set directly on object
      object[path] = value;
      return object;
    }
  }

  let current = object;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
  return object;
};

// --- Timeline Building ---
const interpolate = (start, end, t, easing) => {
  return start + (end - start) * easings[easing](t);
};

const buildTimeline = (keyframesInput) => {
  const timeline = [];
  let accumulatedTime = 0;
  let latestValue;

  keyframesInput.forEach(
    ({ value, duration, easing = "linear", relative }, index) => {
      if (index === 0) {
        latestValue = value;
        timeline.push({ time: accumulatedTime, value, easing: "linear" });
      } else if (duration !== undefined && easing !== undefined) {
        accumulatedTime += duration;

        if (relative) {
          latestValue = latestValue + value;
        } else {
          latestValue = value;
        }

        timeline.push({ time: accumulatedTime, value: latestValue, easing });
      }
    },
  );

  return timeline;
};

const getValueAtTime = (timeline, currentTime) => {
  if (timeline.length === 0) return 0;
  if (currentTime <= timeline[0].time) return timeline[0].value;
  if (currentTime >= timeline[timeline.length - 1].time) {
    return timeline[timeline.length - 1].value;
  }

  for (let i = 0; i < timeline.length - 1; i++) {
    const { time: startTime, value: startValue, easing } = timeline[i];
    const { time: endTime, value: endValue } = timeline[i + 1];

    if (currentTime >= startTime && currentTime <= endTime) {
      const t = (currentTime - startTime) / (endTime - startTime);
      return interpolate(startValue, endValue, t, easing);
    }
  }

  return timeline[timeline.length - 1].value;
};

/**
 * Creates an animation bus that manages all tween animations centrally.
 * @returns {AnimationBus}
 */
export const createAnimationBus = () => {
  const commandQueue = [];
  const activeAnimations = new Map();
  const listeners = new Map();
  let stateVersion = 0;

  // --- Command Processing ---

  const dispatch = (command) => {
    commandQueue.push(command);
  };

  const processQueue = () => {
    const commands = commandQueue.splice(0);
    for (const cmd of commands) {
      executeCommand(cmd);
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

  // --- Animation Lifecycle ---

  const startAnimation = (payload) => {
    const { id, element, properties, targetState, onComplete } = payload;

    const timelines = buildPropertyTimelines(element, properties);
    const duration = calculateMaxDuration(timelines);

    const context = {
      id,
      element,
      timelines,
      duration,
      currentTime: 0,
      stateVersion,
      targetState,
      onComplete,
    };

    // Apply initial values immediately (at time=0)
    applyAnimationFrame(context, 0);

    activeAnimations.set(id, context);
    emit("started", { id });
  };

  const buildPropertyTimelines = (element, properties) => {
    return Object.entries(properties).map(([property, config]) => {
      if (!WhiteListTransitionProps[property]) {
        throw new Error(
          `${property} is not a supported property for transition.`,
        );
      }

      const currentValue = getTransitionProperty(element, property);
      const initialValue = config.initialValue ?? currentValue;

      const keyframesInput = [{ value: initialValue }, ...config.keyframes];
      const timeline = buildTimeline(keyframesInput);

      return { property, timeline };
    });
  };

  const calculateMaxDuration = (timelines) => {
    let max = 0;
    for (const { timeline } of timelines) {
      const lastKeyframe = timeline[timeline.length - 1];
      if (lastKeyframe && lastKeyframe.time > max) {
        max = lastKeyframe.time;
      }
    }
    return max;
  };

  // --- Cancellation (Synchronous!) ---

  const cancelAnimation = (id) => {
    const context = activeAnimations.get(id);
    if (context) {
      applyTargetState(context);
      activeAnimations.delete(id);
      emit("cancelled", { id });
    }
  };

  const cancelAll = () => {
    for (const [id, context] of activeAnimations) {
      applyTargetState(context);
      emit("cancelled", { id });
    }
    activeAnimations.clear();
    stateVersion++;
  };

  const applyTargetState = (context) => {
    const { element, targetState } = context;

    if (!element || element.destroyed) return;

    if (targetState === null) {
      // Special case: destroy element (for delete animations)
      element.destroy();
      return;
    }

    // Apply all target properties
    if (targetState) {
      for (const [property, value] of Object.entries(targetState)) {
        try {
          setTransitionProperty(element, property, value);
        } catch (e) {
          // Skip properties that fail to apply
        }
      }
    }
  };

  // --- Tick (Called every frame) ---

  const tick = (deltaMS) => {
    // 1. Process any pending commands first
    processQueue();

    // 2. Update all active animations
    const toRemove = [];

    for (const [id, context] of activeAnimations) {
      // Check for stale animations (from previous state version)
      if (context.stateVersion !== stateVersion) {
        toRemove.push(id);
        continue;
      }

      // Check if element was destroyed externally
      if (!context.element || context.element.destroyed) {
        toRemove.push(id);
        continue;
      }

      // Advance time
      context.currentTime += deltaMS;

      // Check if complete
      if (context.currentTime >= context.duration) {
        applyAnimationFrame(context, context.duration);
        fireCompleteEvent(context);
        toRemove.push(id);
        continue;
      }

      // Apply interpolated values
      applyAnimationFrame(context, context.currentTime);
    }

    // 3. Clean up completed/stale animations
    for (const id of toRemove) {
      activeAnimations.delete(id);
    }
  };

  const applyAnimationFrame = (context, time) => {
    const { element, timelines } = context;

    for (const { property, timeline } of timelines) {
      const value = getValueAtTime(timeline, time);
      try {
        setTransitionProperty(element, property, value);
      } catch (e) {
        // Element might be in invalid state, skip
      }
    }
  };

  const fireCompleteEvent = (context) => {
    const { id, onComplete } = context;

    emit("completed", { id });

    if (onComplete) {
      try {
        onComplete();
      } catch (e) {
        // Skip onComplete errors
      }
    }
  };

  // --- Event System ---

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

  const emit = (event, data) => {
    listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        // Skip listener errors
      }
    });
  };

  // --- State ---

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

  // --- Cleanup ---

  const destroy = () => {
    cancelAll();
    listeners.clear();
  };

  const flush = () => {
    processQueue();
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
