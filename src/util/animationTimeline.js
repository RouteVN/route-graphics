const easings = {
  linear: (x) => x,
  easeIn: (x) => x * x,
  easeOut: (x) => 1 - (1 - x) * (1 - x),
  easeInOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
};

export const getEasingFunction = (name = "linear") => {
  const easing = easings[name];

  if (!easing) {
    throw new Error(`Unsupported easing: ${name}`);
  }

  return easing;
};

export const buildTimeline = (keyframesInput) => {
  const timeline = [];
  let accumulatedTime = 0;
  let latestValue;

  keyframesInput.forEach(
    ({ value, duration, easing = "linear", relative }, index) => {
      if (index === 0) {
        latestValue = value;
        timeline.push({ time: accumulatedTime, value, easing: "linear" });
        return;
      }

      if (duration === undefined) {
        return;
      }

      accumulatedTime += duration;
      latestValue = relative ? latestValue + value : value;
      timeline.push({ time: accumulatedTime, value: latestValue, easing });
    },
  );

  return timeline;
};

export const calculateMaxDuration = (timelines) => {
  let max = 0;

  for (const { timeline } of timelines) {
    const lastKeyframe = timeline[timeline.length - 1];
    if (lastKeyframe && lastKeyframe.time > max) {
      max = lastKeyframe.time;
    }
  }

  return max;
};

export const getValueAtTime = (timeline, currentTime) => {
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
      return (
        startValue + (endValue - startValue) * getEasingFunction(easing)(t)
      );
    }
  }

  return timeline[timeline.length - 1].value;
};
