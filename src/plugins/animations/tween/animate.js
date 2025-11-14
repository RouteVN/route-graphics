import {
  WhiteListTransitionProps,
  TRANSITION_PROPERTY_PATH_MAP,
} from "../../../types.js";

const easings = {
  linear: (x) => x,
};

const interpolate = (start, end, t, easing) => {
  return start + (end - start) * easings[easing](t);
};

// Get function with camelCase to nested path support
const getTransitionProperty = (object, path, defaultValue) => {
  if (typeof path === "string") {
    path = TRANSITION_PROPERTY_PATH_MAP[path];
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

// Set function with camelCase to nested path support
const setTransitionProperty = (object, path, value) => {
  if (typeof path === "string") {
    path = TRANSITION_PROPERTY_PATH_MAP[path];
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

/**
 *
 * @example
 * Input: [
 *   { value: 0 },
 *   { value: 1, duration: 1000, easing: "linear" },
 *   { value: 0, duration: 1000, easing: "linear" }
 * ]
 *
 * Output: [
 *   { time: 0, value: 0, easing: "linear" },
 *   { time: 1000, value: 1, easing: "linear" },
 *   { time: 2000, value: 0, easing: "linear" }
 * ]
 */
const buildTimeline = (keyframesInput) => {
  const timeline = [];
  let accumulatedTime = 0;
  let latestValue;

  keyframesInput.forEach(({ value, duration, easing, relative }, index) => {
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
  });

  return timeline;
};

/**
 *
 * @example
 * Timeline: [
 *   { time: 0, value: 0, easing: "linear" },
 *   { time: 1000, value: 1, easing: "linear" },
 *   { time: 2000, value: 0, easing: "linear" }
 * ]
 *
 * getValueAtTime(timeline, 500) => 0.5
 * getValueAtTime(timeline, 1500) => 0.5
 */
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

const getMaxOfArray = (numArray) => {
  return Math.max.apply(null, numArray);
};

/**
 * Execute tween animation
 * @param {Object} params
 * @param {import('../../../types.js').Application} params.app
 * @param {import('pixi.js').DisplayObject} params.element
 * @param {Object} params.animation - Animation configuration
 * @param {AbortSignal} params.signal
 */
export const animate = async ({ app, element, animation, signal }) => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      app.ticker.remove(effect);
      reject(new DOMException("Operation aborted", "AbortError"));
      return;
    }

    const { properties } = animation;

    const animationProperties = Object.entries(properties).map(
      ([property, value]) => {
        if (!WhiteListTransitionProps[property])
          throw new Error(
            `${property} is not a supported property for transition.`,
          );
        return {
          ...value,
          property,
        };
      },
    );

    // Calculate max duration
    const accumulatedDurations = animationProperties.map(
      (animationProperty) => {
        return animationProperty.keyframes.reduce((acc, item) => {
          return acc + item.duration || 0;
        }, 0);
      },
    );
    const maxDuration = getMaxOfArray(accumulatedDurations);

    // Store initial displayObject values
    const initialProperties = {};
    animationProperties.forEach((animationProperty) => {
      initialProperties[animationProperty.property] = getTransitionProperty(
        element,
        animationProperty.property,
      );
    });

    const propertyTimelines = animationProperties.map((animationProperty) => {
      let keyframesInput = [];
      if (animationProperty.initialValue !== undefined) {
        keyframesInput = [{ value: animationProperty.initialValue }];
      } else {
        keyframesInput = [
          { value: initialProperties[animationProperty.property] },
        ];
      }
      keyframesInput = keyframesInput.concat(animationProperty.keyframes);

      const timeline = buildTimeline(keyframesInput);

      return {
        property: animationProperty.property,
        timeline: timeline,
      };
    });

    let currentTimeDelta = 0;

    // Helper function to apply the animation state at a given time
    const applyAnimationState = (timeDelta) => {
      propertyTimelines.forEach(({ property, timeline }) => {
        const value = getValueAtTime(timeline, timeDelta);

        if (element && !element.destroyed) {
          setTransitionProperty(element, property, value);
        }
      });
    };

    // Register abort handler for immediate cleanup
    if (signal) {
      signal.addEventListener("abort", () => {
        app.ticker.remove(effect);
        reject(new DOMException("Operation aborted", "AbortError"));
      });
    }

    const effect = (time) => {
      currentTimeDelta += time.deltaMS;

      if (currentTimeDelta >= maxDuration) {
        app.ticker.remove(effect);
        resolve();
        return;
      }

      // This now just does interpolation lookups, no timeline building!
      applyAnimationState(currentTimeDelta);
    };

    // If already aborted, don't start
    if (signal?.aborted) {
      app.ticker.remove(effect);
      reject(new DOMException("Operation aborted", "AbortError"));
      return;
    }

    app.ticker.add(effect);
  });
};
