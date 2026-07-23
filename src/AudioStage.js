import { AudioAsset } from "./AudioAsset.js";
import { getEasingFunction } from "./util/animationTimeline.js";
import { normalizeVolume } from "./util/normalizeVolume.js";
import { normalizeAudioRenderState } from "./util/normalizeAudio.js";
import { getAudioContext } from "./audioContext.js";

const ROOT_CHANNEL_ID = "__route_graphics_audio_root__";
const DIRECT_CHANNEL_ID = "__route_graphics_audio_direct__";
const AUDIO_AUTOMATION_SAMPLE_INTERVAL_MS = 16;
const AUDIO_AUTOMATION_MAX_SAMPLES = 1024;
const audioParamAutomation = new WeakMap();

const isAudioDebugEnabled = () =>
  globalThis.window?.RTGL_AUDIO_DEBUG === true ||
  globalThis.window?.RTGL_VT_DEBUG === true;

const debugAudio = (message, details = {}) => {
  if (!isAudioDebugEnabled()) {
    return;
  }

  console.log(`[AudioStage] ${message}`, details);
};

const connect = (from, to) => {
  if (from && to && typeof from.connect === "function") {
    from.connect(to);
  }
};

const disconnect = (node) => {
  if (node && typeof node.disconnect === "function") {
    node.disconnect();
  }
};

const toFiniteParamValue = (value, fallback = 0) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return fallback;
};

const getParamValue = (param, fallback = 0) =>
  toFiniteParamValue(param?.value, fallback);

const getTimelineValueAtTime = (timeline, elapsedMs) => {
  if (timeline.length === 0) return 0;

  const lastKeyframe = timeline[timeline.length - 1];
  if (elapsedMs >= lastKeyframe.time) return lastKeyframe.value;

  for (let index = 1; index < timeline.length; index++) {
    const start = timeline[index - 1];
    const end = timeline[index];
    if (elapsedMs >= end.time || end.time === start.time) continue;

    const progress = Math.max(
      0,
      Math.min(1, (elapsedMs - start.time) / (end.time - start.time)),
    );
    const easedProgress = getEasingFunction(end.easing)(progress);
    return start.value + (end.value - start.value) * easedProgress;
  }

  return lastKeyframe.value;
};

const getCurrentParamValue = (param, context = getAudioContext()) => {
  const automation = audioParamAutomation.get(param);
  if (!automation) return getParamValue(param);

  const elapsedMs = Math.max(
    0,
    (context.currentTime - automation.startTime) * 1000,
  );
  return automation.normalizeValue(
    getTimelineValueAtTime(automation.timeline, elapsedMs),
  );
};

const setParamAtTime = (param, value, time) => {
  if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(value, time);
  } else {
    param.value = value;
  }
};

const resumeAudioContext = (context = getAudioContext()) => {
  if (context.state === "suspended" && typeof context.resume === "function") {
    const previousState = context.state;
    debugAudio("resume requested", { state: previousState });

    return context
      .resume()
      .then(() => {
        debugAudio("resume resolved", {
          previousState,
          state: context.state,
        });
      })
      .catch((error) => {
        if (isAudioDebugEnabled()) {
          console.warn("[AudioStage] resume failed", {
            previousState,
            state: context.state,
            error,
          });
        }
      });
  }

  debugAudio("resume skipped", {
    state: context.state,
    canResume: typeof context.resume === "function",
  });
  return Promise.resolve();
};

const setParamNow = (param, value, context = getAudioContext()) => {
  if (!param) return;

  const now = context.currentTime;
  const nextValue = toFiniteParamValue(value, getParamValue(param));

  if (typeof param.cancelScheduledValues === "function") {
    param.cancelScheduledValues(now);
  }
  setParamAtTime(param, nextValue, now);
  audioParamAutomation.set(param, {
    startTime: now,
    timeline: [{ time: 0, value: nextValue, easing: "linear" }],
    normalizeValue: (automationValue) => automationValue,
  });
};

const buildAudioTimeline = ({
  transition,
  currentValue,
  normalizeTransitionValue,
  denormalizeParamValue,
}) => {
  const initialAuthoredValue =
    transition.initialValue === undefined
      ? denormalizeParamValue(currentValue)
      : transition.initialValue;
  const initialValue = normalizeTransitionValue(initialAuthoredValue);
  let authoredValue = denormalizeParamValue(initialValue);
  let elapsedMs = 0;
  const timeline = [
    {
      time: 0,
      value: initialValue,
      easing: "linear",
    },
  ];

  for (const keyframe of transition.keyframes) {
    elapsedMs += Math.max(0, toFiniteParamValue(keyframe.duration, 0));
    const nextAuthoredValue = keyframe.relative
      ? authoredValue + keyframe.value
      : keyframe.value;
    const nextValue = normalizeTransitionValue(nextAuthoredValue);
    authoredValue = denormalizeParamValue(nextValue);
    timeline.push({
      time: elapsedMs,
      value: nextValue,
      easing: keyframe.easing ?? "linear",
    });
  }

  return timeline;
};

const scheduleTimelineSegment = ({
  param,
  start,
  end,
  startTime,
  normalizeValue,
}) => {
  const durationMs = end.time - start.time;
  const endTime = startTime + end.time / 1000;

  if (durationMs <= 0) {
    setParamAtTime(param, end.value, endTime);
    return;
  }

  if (typeof param.linearRampToValueAtTime !== "function") {
    setParamAtTime(param, end.value, endTime);
    return;
  }

  if (end.easing === "linear") {
    param.linearRampToValueAtTime(end.value, endTime);
    return;
  }

  const easing = getEasingFunction(end.easing);
  const sampleCount = Math.min(
    AUDIO_AUTOMATION_MAX_SAMPLES,
    Math.max(1, Math.ceil(durationMs / AUDIO_AUTOMATION_SAMPLE_INTERVAL_MS)),
  );
  for (let sample = 1; sample <= sampleCount; sample++) {
    const progress = sample / sampleCount;
    const value = normalizeValue(
      start.value + (end.value - start.value) * easing(progress),
    );
    const time = startTime + (start.time + durationMs * progress) / 1000;
    param.linearRampToValueAtTime(value, time);
  }
};

const rampParam = ({
  param,
  transition,
  normalizeTransitionValue,
  denormalizeParamValue,
  normalizeParamValue,
  context = getAudioContext(),
}) => {
  if (!param) return 0;

  const now = context.currentTime;
  const currentValue = getCurrentParamValue(param, context);
  const timeline = buildAudioTimeline({
    transition,
    currentValue,
    normalizeTransitionValue,
    denormalizeParamValue,
  });
  const hasExplicitInitialValue = transition.initialValue !== undefined;

  if (
    !hasExplicitInitialValue &&
    typeof param.cancelAndHoldAtTime === "function"
  ) {
    param.cancelAndHoldAtTime(now);
  } else if (typeof param.cancelScheduledValues === "function") {
    param.cancelScheduledValues(now);
  }

  setParamAtTime(param, timeline[0].value, now);
  for (let index = 1; index < timeline.length; index++) {
    scheduleTimelineSegment({
      param,
      start: timeline[index - 1],
      end: timeline[index],
      startTime: now,
      normalizeValue: normalizeParamValue,
    });
  }

  audioParamAutomation.set(param, {
    startTime: now,
    timeline,
    normalizeValue: normalizeParamValue,
  });

  return timeline[timeline.length - 1].time;
};

const createGainNode = (value = 1) => {
  const context = getAudioContext();
  const node = context.createGain();
  setParamNow(node.gain, value, context);
  return node;
};

const createPannerNode = (pan = 0) => {
  const context = getAudioContext();
  if (typeof context.createStereoPanner !== "function") {
    return null;
  }

  const node = context.createStereoPanner();
  setParamNow(node.pan, pan, context);
  return node;
};

const getVolumeValue = ({ volume, muted }) =>
  muted ? 0 : normalizeVolume(volume, 100);

const hasSameSoundSourceIdentity = (previous, next) =>
  previous.src === next.src &&
  previous.startAt === next.startAt &&
  previous.endAt === next.endAt &&
  previous.startDelayMs === next.startDelayMs;

const normalizeDirectVolume = (volume, fallback = 1) => {
  const parsedFallback = Number(fallback);
  const normalizedFallback = Number.isFinite(parsedFallback)
    ? parsedFallback
    : 1;
  const parsedVolume = Number(volume ?? normalizedFallback);
  const normalizedVolume = Number.isFinite(parsedVolume)
    ? parsedVolume
    : normalizedFallback;

  return (
    normalizeVolume(normalizedVolume * 100, normalizedFallback * 100) * 100
  );
};

const getTransitionPhase = (effects = [], targetId, property, phase) => {
  const transition = effects.find(
    (effect) =>
      effect.type === "audio-transition" && effect.targetId === targetId,
  );

  return transition?.properties?.[property]?.[phase] ?? null;
};

const applyAudioParam = ({
  param,
  targetValue,
  transition,
  normalizeTargetValue = (value) => value,
  normalizeTransitionValue = normalizeTargetValue,
  denormalizeParamValue = (value) => value,
}) => {
  if (!param) return 0;

  const normalizedTargetValue = normalizeTargetValue(targetValue);

  if (!transition) {
    setParamNow(param, normalizedTargetValue);
    return 0;
  }

  return rampParam({
    param,
    transition,
    normalizeTransitionValue,
    denormalizeParamValue,
    normalizeParamValue: normalizeTargetValue,
  });
};

const applyVolume = ({ gainNode, targetValue, transition }) =>
  applyAudioParam({
    param: gainNode?.gain,
    targetValue,
    transition,
    normalizeTargetValue: (value) =>
      Math.max(0, Math.min(1, toFiniteParamValue(value, 1))),
    normalizeTransitionValue: (value) => normalizeVolume(value, 100),
    denormalizeParamValue: (value) => value * 100,
  });

const applyPan = ({ pannerNode, targetValue, transition }) =>
  applyAudioParam({
    param: pannerNode?.pan,
    targetValue,
    transition,
    normalizeTargetValue: (value) =>
      Math.max(-1, Math.min(1, toFiniteParamValue(value, 0))),
  });

const applyPlaybackRate = ({ source, targetValue, transition }) =>
  applyAudioParam({
    param: source?.playbackRate,
    targetValue,
    transition,
    normalizeTargetValue: (value) => Math.max(0, toFiniteParamValue(value, 1)),
  });

const createChannelInstance = (channel, outputNode) => {
  const gainNode = createGainNode(getVolumeValue(channel));
  const pannerNode = createPannerNode(channel.pan ?? 0);

  connect(gainNode, pannerNode ?? outputNode);
  if (pannerNode) connect(pannerNode, outputNode);

  return {
    id: channel.id,
    gainNode,
    pannerNode,
    volume: channel.volume ?? 100,
    muted: channel.muted ?? false,
    pan: channel.pan ?? 0,
    loop: channel.loop ?? false,
    outputNode,
    cleanupTimeoutId: null,
  };
};

const createSoundInstance = ({ sound, channelNode, internalId }) => {
  const gainNode = createGainNode(getVolumeValue(sound));
  const pannerNode = createPannerNode(sound.pan ?? 0);

  connect(gainNode, pannerNode ?? channelNode);
  if (pannerNode) connect(pannerNode, channelNode);

  return {
    internalId,
    id: sound.id,
    src: sound.src,
    url: sound.src,
    loop: sound.loop ?? false,
    volume: sound.volume ?? 100,
    muted: sound.muted ?? false,
    pan: sound.pan ?? 0,
    startDelayMs: sound.startDelayMs ?? 0,
    playbackRate: sound.playbackRate ?? 1,
    startAt: sound.startAt ?? 0,
    endAt: sound.endAt ?? null,
    channelId: sound.channelId ?? null,
    gainNode,
    pannerNode,
    source: null,
    sourceEnded: false,
    onSourceEnded: null,
    finishing: false,
    playbackRateTransition: null,
    pendingTimeoutId: null,
    cleanupTimeoutId: null,
    playRequestId: 0,
  };
};

const createSourceForSound = (sound) => {
  const context = getAudioContext();
  const audioBuffer = AudioAsset.getAsset(sound.src);
  debugAudio("asset lookup", {
    id: sound.id,
    src: sound.src,
    found: Boolean(audioBuffer),
    duration: audioBuffer?.duration ?? null,
    contextState: context.state,
  });
  if (!audioBuffer) {
    console.warn("AudioStage: asset not found", sound.src);
    return null;
  }

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = sound.loop ?? false;

  applyPlaybackRate({
    source,
    targetValue: sound.playbackRate ?? 1,
    transition: sound.playbackRateTransition,
  });
  sound.playbackRateTransition = null;

  connect(source, sound.gainNode);

  sound.sourceEnded = false;
  source.onended = () => {
    if (sound.source !== source) {
      return;
    }

    sound.sourceEnded = true;
    sound.onSourceEnded?.();
  };

  const offset = sound.startAt ?? 0;
  const duration =
    sound.endAt !== null && sound.endAt !== undefined
      ? Math.max(sound.endAt - offset, 0)
      : undefined;
  const startTime = Math.max(0, toFiniteParamValue(context.currentTime, 0));

  if (source.loop && sound.endAt !== null && sound.endAt !== undefined) {
    source.loopStart = offset;
    source.loopEnd = sound.endAt;
    source.start(startTime, offset);
  } else if (duration !== undefined) {
    source.start(startTime, offset, duration);
  } else {
    source.start(startTime, offset);
  }
  debugAudio("source started", {
    id: sound.id,
    src: sound.src,
    loop: source.loop,
    startTime,
    offset,
    duration: duration ?? null,
    playbackRate: sound.playbackRate,
    gain: getParamValue(sound.gainNode?.gain, null),
    contextState: context.state,
  });

  return source;
};

const playSound = (sound) => {
  if (sound.pendingTimeoutId !== null) {
    clearTimeout(sound.pendingTimeoutId);
    sound.pendingTimeoutId = null;
  }

  const context = getAudioContext();
  const playRequestId = (sound.playRequestId ?? 0) + 1;
  sound.playRequestId = playRequestId;
  sound.sourceEnded = false;
  debugAudio("play requested", {
    id: sound.id,
    src: sound.src,
    loop: sound.loop,
    volume: sound.volume,
    muted: sound.muted,
    startDelayMs: sound.startDelayMs,
    contextState: context.state,
  });
  const needsResume =
    context.state === "suspended" && typeof context.resume === "function";

  const start = () => {
    if (sound.playRequestId !== playRequestId) {
      return;
    }

    sound.pendingTimeoutId = null;
    const previousSource = sound.source;
    sound.source = createSourceForSound(sound);
    if (previousSource && previousSource !== sound.source) {
      disconnect(previousSource);
    }
  };

  const scheduleStart = () => {
    if (sound.playRequestId !== playRequestId) {
      return;
    }

    if (sound.startDelayMs > 0) {
      sound.pendingTimeoutId = setTimeout(start, sound.startDelayMs);
      return;
    }

    start();
  };

  const resumePromise = resumeAudioContext(context);
  if (needsResume) {
    void resumePromise.then(scheduleStart);
    return;
  }

  scheduleStart();
};

const stopSource = (sound, delayMs = 0) => {
  sound.playRequestId = (sound.playRequestId ?? 0) + 1;

  if (sound.pendingTimeoutId !== null) {
    clearTimeout(sound.pendingTimeoutId);
    sound.pendingTimeoutId = null;
  }

  if (!sound.source) return;

  const context = getAudioContext();
  try {
    sound.source.stop(context.currentTime + delayMs / 1000);
  } catch {
    // Stopping an already-stopped source is harmless for cleanup.
  }
};

const cleanupSound = (sound) => {
  sound.onSourceEnded = null;

  if (sound.pendingTimeoutId !== null) {
    clearTimeout(sound.pendingTimeoutId);
    sound.pendingTimeoutId = null;
  }
  if (sound.cleanupTimeoutId !== null) {
    clearTimeout(sound.cleanupTimeoutId);
    sound.cleanupTimeoutId = null;
  }

  stopSource(sound);
  disconnect(sound.source);
  disconnect(sound.gainNode);
  disconnect(sound.pannerNode);
};

const cleanupChannel = (channel) => {
  if (channel.cleanupTimeoutId !== null) {
    clearTimeout(channel.cleanupTimeoutId);
    channel.cleanupTimeoutId = null;
  }
  disconnect(channel.gainNode);
  disconnect(channel.pannerNode);
};

const schedule = (callback, delayMs) => {
  if (delayMs <= 0) {
    callback();
    return null;
  }
  return setTimeout(callback, delayMs);
};

/**
 * Creates an audio player instance.
 * Kept as a small compatibility wrapper for direct tests/integrations.
 *
 * @param {string} id
 * @param {Object} options
 * @param {string} options.url
 * @param {boolean} [options.loop=false]
 * @param {number} [options.volume=1.0]
 * @returns {Object} Audio player instance
 */
export const createAudioPlayer = (id, options) => {
  const sound = {
    id,
    src: options.url,
    loop: options.loop ?? false,
    volume: normalizeDirectVolume(options.volume),
  };
  const channel = createChannelInstance(
    { id: `${id}:channel`, volume: 100, muted: false, pan: 0 },
    getAudioContext().destination,
  );
  const instance = createSoundInstance({
    sound,
    channelNode: channel.gainNode,
    internalId: id,
  });

  const play = () => playSound(instance);
  const stop = () => cleanupSound(instance);
  const update = (newState) => {
    instance.src = newState.url ?? instance.src;
    instance.url = instance.src;
    instance.loop = newState.loop ?? instance.loop;
    if (newState.volume !== undefined) {
      const nextVolume = normalizeDirectVolume(newState.volume);
      instance.volume = nextVolume;
      setParamNow(instance.gainNode.gain, normalizeVolume(nextVolume, 100));
    }
  };

  return {
    play,
    stop,
    update,
    getId: () => instance.id,
    getUrl: () => instance.url,
    getLoop: () => instance.loop,
    getVolume: () => normalizeVolume(instance.volume, 100),
    setUrl: (url) => {
      instance.src = url;
      instance.url = url;
    },
    setLoop: (loop) => {
      instance.loop = loop;
      if (instance.source) instance.source.loop = loop;
    },
    setVolume: (volume) => {
      const nextVolume = normalizeDirectVolume(volume);
      instance.volume = nextVolume;
      setParamNow(instance.gainNode.gain, normalizeVolume(nextVolume, 100));
    },
    get id() {
      return instance.id;
    },
    get url() {
      return instance.url;
    },
    get loop() {
      return instance.loop;
    },
    get volume() {
      return normalizeVolume(instance.volume, 100);
    },
    gainNode: instance.gainNode,
  };
};

/**
 * Creates an audio stage instance.
 *
 * @returns {Object} Audio stage instance
 */
export const createAudioStage = () => {
  const channels = new Map();
  const sounds = new Map();
  const currentSoundKeyById = new Map();
  const directAudios = new Map();
  let soundGeneration = 0;

  const getCurrentChannelSounds = (channelId) => {
    const channelSounds = [];
    for (const internalId of currentSoundKeyById.values()) {
      const sound = sounds.get(internalId);
      if (
        sound?.channelId === channelId &&
        !sound.finishing &&
        !channelSounds.includes(sound)
      ) {
        channelSounds.push(sound);
      }
    }
    return channelSounds;
  };

  const restartLoopingChannelIfComplete = (channelId) => {
    const channel = channels.get(channelId);
    if (!channel?.loop) {
      return;
    }

    const channelSounds = getCurrentChannelSounds(channelId);
    if (
      channelSounds.length === 0 ||
      channelSounds.some(
        (sound) =>
          sound.pendingTimeoutId !== null || sound.sourceEnded !== true,
      )
    ) {
      return;
    }

    channelSounds.forEach((sound) => {
      playSound(sound);
    });
  };

  const bindChannelLoopCompletion = (sound) => {
    sound.onSourceEnded = sound.channelId
      ? () => restartLoopingChannelIfComplete(sound.channelId)
      : null;
  };

  const ensureRootChannel = (id) => {
    const existing = channels.get(id);
    if (existing) return existing;

    const channel = createChannelInstance(
      { id, volume: 100, muted: false, pan: 0 },
      getAudioContext().destination,
    );
    channels.set(id, channel);
    return channel;
  };

  const ensureChannel = (channel, effects, phase) => {
    const existing = channels.get(channel.id);
    const volumeTransition = getTransitionPhase(
      effects,
      channel.id,
      "volume",
      phase,
    );
    const panTransition = getTransitionPhase(effects, channel.id, "pan", phase);

    if (existing && existing.cleanupTimeoutId !== null) {
      const created = createChannelInstance(
        channel,
        getAudioContext().destination,
      );
      channels.set(channel.id, created);
      applyVolume({
        gainNode: created.gainNode,
        targetValue: getVolumeValue(channel),
        transition: volumeTransition,
      });
      applyPan({
        pannerNode: created.pannerNode,
        targetValue: channel.pan,
        transition: panTransition,
      });
      return created;
    }

    if (existing) {
      const currentVolumeValue = getVolumeValue(existing);
      const nextVolumeValue = getVolumeValue(channel);
      const volumeChanged = currentVolumeValue !== nextVolumeValue;
      const panChanged = existing.pan !== (channel.pan ?? 0);

      existing.volume = channel.volume;
      existing.muted = channel.muted;
      existing.pan = channel.pan;
      existing.loop = channel.loop;

      if (volumeChanged && volumeTransition) {
        applyVolume({
          gainNode: existing.gainNode,
          targetValue: nextVolumeValue,
          transition: volumeTransition,
        });
      } else if (volumeChanged) {
        applyVolume({
          gainNode: existing.gainNode,
          targetValue: nextVolumeValue,
          transition: null,
        });
      }

      if (panChanged) {
        applyPan({
          pannerNode: existing.pannerNode,
          targetValue: channel.pan,
          transition: panTransition,
        });
      }
      return existing;
    }

    const created = createChannelInstance(
      channel,
      getAudioContext().destination,
    );
    channels.set(channel.id, created);
    applyVolume({
      gainNode: created.gainNode,
      targetValue: getVolumeValue(channel),
      transition: volumeTransition,
    });
    applyPan({
      pannerNode: created.pannerNode,
      targetValue: channel.pan,
      transition: panTransition,
    });
    return created;
  };

  const getParentChannelForSound = (sound) => {
    const parentChannel =
      sound.channelId !== null
        ? channels.get(sound.channelId)
        : ensureRootChannel(ROOT_CHANNEL_ID);

    if (!parentChannel) {
      throw new Error(
        `Input error: sound "${sound.id}" references missing channel.`,
      );
    }

    return parentChannel;
  };

  const connectSoundToChannel = (instance, channelNode) => {
    disconnect(instance.gainNode);
    disconnect(instance.pannerNode);
    connect(instance.gainNode, instance.pannerNode ?? channelNode);
    if (instance.pannerNode) connect(instance.pannerNode, channelNode);
  };

  const removeChannel = (channel, effects) => {
    if (
      !channel ||
      channel.id === ROOT_CHANNEL_ID ||
      channel.id === DIRECT_CHANNEL_ID
    ) {
      return 0;
    }

    const volumeTransition = getTransitionPhase(
      effects,
      channel.id,
      "volume",
      "exit",
    );
    const panTransition = getTransitionPhase(
      effects,
      channel.id,
      "pan",
      "exit",
    );
    const volumeDuration = applyVolume({
      gainNode: channel.gainNode,
      targetValue: getVolumeValue(channel),
      transition: volumeTransition,
    });
    const panDuration = applyPan({
      pannerNode: channel.pannerNode,
      targetValue: channel.pan,
      transition: panTransition,
    });

    return Math.max(volumeDuration, panDuration);
  };

  const addSoundInstance = ({ sound, effects, phase, internalId }) => {
    const parentChannel = getParentChannelForSound(sound);

    const instance = createSoundInstance({
      sound,
      channelNode: parentChannel.gainNode,
      internalId,
    });
    sounds.set(internalId, instance);
    currentSoundKeyById.set(sound.id, internalId);
    bindChannelLoopCompletion(instance);

    const volumeTransition = getTransitionPhase(
      effects,
      sound.id,
      "volume",
      phase,
    );
    const panTransition = getTransitionPhase(effects, sound.id, "pan", phase);
    applyVolume({
      gainNode: instance.gainNode,
      targetValue: getVolumeValue(sound),
      transition: volumeTransition,
    });
    applyPan({
      pannerNode: instance.pannerNode,
      targetValue: sound.pan,
      transition: panTransition,
    });
    instance.playbackRateTransition = getTransitionPhase(
      effects,
      sound.id,
      "playbackRate",
      phase,
    );
    playSound(instance);
    return instance;
  };

  const removeSoundInstance = (instance, effects, inheritedDuration = 0) => {
    if (!instance) return 0;

    instance.finishing = false;
    instance.onSourceEnded = null;

    const volumeTransition = getTransitionPhase(
      effects,
      instance.id,
      "volume",
      "exit",
    );
    const panTransition = getTransitionPhase(
      effects,
      instance.id,
      "pan",
      "exit",
    );
    const playbackRateTransition = getTransitionPhase(
      effects,
      instance.id,
      "playbackRate",
      "exit",
    );
    const volumeDuration = applyVolume({
      gainNode: instance.gainNode,
      targetValue: getVolumeValue(instance),
      transition: volumeTransition,
    });
    const panDuration = applyPan({
      pannerNode: instance.pannerNode,
      targetValue: instance.pan,
      transition: panTransition,
    });
    const playbackRateDuration = applyPlaybackRate({
      source: instance.source,
      targetValue: instance.playbackRate,
      transition: playbackRateTransition,
    });
    const ownDuration = Math.max(
      volumeDuration,
      panDuration,
      playbackRateDuration,
    );
    const duration = Math.max(ownDuration, inheritedDuration);

    stopSource(instance, duration);
    instance.cleanupTimeoutId = schedule(() => {
      cleanupSound(instance);
      sounds.delete(instance.internalId);
    }, duration);

    return duration;
  };

  const finishSoundInstance = (instance) => {
    if (!instance || instance.finishing) {
      return;
    }

    instance.finishing = true;
    instance.loop = false;

    const cleanupFinishedSound = () => {
      if (!instance.finishing) {
        return;
      }

      instance.finishing = false;
      instance.onSourceEnded = null;
      cleanupSound(instance);
      if (sounds.get(instance.internalId) === instance) {
        sounds.delete(instance.internalId);
      }
    };

    if (
      !instance.source ||
      instance.sourceEnded ||
      getAudioContext().state !== "running"
    ) {
      cleanupFinishedSound();
      return;
    }

    instance.source.loop = false;
    instance.onSourceEnded = cleanupFinishedSound;
  };

  const updateSoundInstance = ({ instance, sound, effects }) => {
    const currentVolumeValue = getVolumeValue(instance);
    const nextVolumeValue = getVolumeValue(sound);
    const volumeChanged = currentVolumeValue !== nextVolumeValue;
    const panChanged = instance.pan !== sound.pan;
    const playbackRateChanged = instance.playbackRate !== sound.playbackRate;
    const startDelayChanged = instance.startDelayMs !== sound.startDelayMs;

    if (instance.channelId !== sound.channelId) {
      const parentChannel = getParentChannelForSound(sound);
      connectSoundToChannel(instance, parentChannel.gainNode);
    }

    instance.loop = sound.loop;
    instance.volume = sound.volume;
    instance.muted = sound.muted;
    instance.pan = sound.pan;
    instance.startDelayMs = sound.startDelayMs;
    instance.playbackRate = sound.playbackRate;
    instance.startAt = sound.startAt;
    instance.endAt = sound.endAt;
    instance.channelId = sound.channelId;
    bindChannelLoopCompletion(instance);

    if (instance.source) {
      instance.source.loop = sound.loop;
    }

    const volumeTransition = getTransitionPhase(
      effects,
      sound.id,
      "volume",
      "update",
    );
    if (volumeChanged && volumeTransition) {
      applyVolume({
        gainNode: instance.gainNode,
        targetValue: nextVolumeValue,
        transition: volumeTransition,
      });
    } else if (volumeChanged) {
      applyVolume({
        gainNode: instance.gainNode,
        targetValue: nextVolumeValue,
        transition: null,
      });
    }

    if (panChanged) {
      applyPan({
        pannerNode: instance.pannerNode,
        targetValue: sound.pan,
        transition: getTransitionPhase(effects, sound.id, "pan", "update"),
      });
    }

    if (playbackRateChanged) {
      const playbackRateTransition = getTransitionPhase(
        effects,
        sound.id,
        "playbackRate",
        "update",
      );
      if (instance.source) {
        applyPlaybackRate({
          source: instance.source,
          targetValue: sound.playbackRate,
          transition: playbackRateTransition,
        });
      } else {
        instance.playbackRateTransition = playbackRateTransition;
      }
    }

    if (startDelayChanged && instance.pendingTimeoutId !== null) {
      playSound(instance);
    }
  };

  const renderGraph = ({
    prevAudio = [],
    nextAudio = [],
    prevAudioEffects = [],
    nextAudioEffects = [],
  } = {}) => {
    const prev = normalizeAudioRenderState({
      audio: prevAudio,
      audioEffects: prevAudioEffects,
    });
    const next = normalizeAudioRenderState({
      audio: nextAudio,
      audioEffects: nextAudioEffects,
    });

    const prevChannelById = new Map(
      prev.channels.map((channel) => [channel.id, channel]),
    );
    const nextChannelById = new Map(
      next.channels.map((channel) => [channel.id, channel]),
    );
    const prevSoundById = new Map(
      prev.sounds.map((sound) => [sound.id, sound]),
    );
    const nextSoundById = new Map(
      next.sounds.map((sound) => [sound.id, sound]),
    );

    for (const id of prevChannelById.keys()) {
      if (nextSoundById.has(id)) {
        throw new Error(
          `Input error: audio node "${id}" cannot change type from "audio-channel" to "sound" between render states.`,
        );
      }
    }
    for (const id of prevSoundById.keys()) {
      if (nextChannelById.has(id)) {
        throw new Error(
          `Input error: audio node "${id}" cannot change type from "sound" to "audio-channel" between render states.`,
        );
      }
    }

    ensureRootChannel(ROOT_CHANNEL_ID);

    const removedChannels = new Map();
    const channelCleanupDurations = new Map();

    for (const [id] of prevChannelById) {
      if (!nextChannelById.has(id)) {
        const duration = removeChannel(channels.get(id), prevAudioEffects);
        removedChannels.set(id, channels.get(id));
        channelCleanupDurations.set(id, duration);
      }
    }

    for (const [id, nextChannel] of nextChannelById) {
      ensureChannel(
        nextChannel,
        nextAudioEffects,
        prevChannelById.has(id) ? "update" : "enter",
      );
    }

    for (const [id, prevSound] of prevSoundById) {
      const nextSound = nextSoundById.get(id);
      const currentKey = currentSoundKeyById.get(id);
      const instance = currentKey ? sounds.get(currentKey) : null;
      const inheritedDuration = prevSound.channelId
        ? (channelCleanupDurations.get(prevSound.channelId) ?? 0)
        : 0;

      if (!nextSound) {
        const duration = removeSoundInstance(
          instance,
          prevAudioEffects,
          inheritedDuration,
        );
        if (prevSound.channelId) {
          channelCleanupDurations.set(
            prevSound.channelId,
            Math.max(
              channelCleanupDurations.get(prevSound.channelId) ?? 0,
              duration,
            ),
          );
        }
        currentSoundKeyById.delete(id);
        continue;
      }

      if (!hasSameSoundSourceIdentity(prevSound, nextSound)) {
        const duration = removeSoundInstance(
          instance,
          prevAudioEffects,
          inheritedDuration,
        );
        if (prevSound.channelId) {
          channelCleanupDurations.set(
            prevSound.channelId,
            Math.max(
              channelCleanupDurations.get(prevSound.channelId) ?? 0,
              duration,
            ),
          );
        }
        addSoundInstance({
          sound: nextSound,
          effects: nextAudioEffects,
          phase: "enter",
          internalId: `render:${id}:${++soundGeneration}`,
        });
      }
    }

    for (const [id, nextSound] of nextSoundById) {
      if (!prevSoundById.has(id)) {
        addSoundInstance({
          sound: nextSound,
          effects: nextAudioEffects,
          phase: "enter",
          internalId: `render:${id}:${++soundGeneration}`,
        });
        continue;
      }

      const prevSound = prevSoundById.get(id);
      if (!hasSameSoundSourceIdentity(prevSound, nextSound)) {
        continue;
      }

      const currentKey = currentSoundKeyById.get(id);
      const instance = currentKey ? sounds.get(currentKey) : null;
      if (instance) {
        updateSoundInstance({
          instance,
          sound: nextSound,
          effects: nextAudioEffects,
        });
      }
    }

    for (const [id, channel] of removedChannels) {
      if (!channel) continue;
      const duration = channelCleanupDurations.get(id) ?? 0;
      channel.cleanupTimeoutId = schedule(() => {
        cleanupChannel(channel);
        if (channels.get(id) === channel) {
          channels.delete(id);
        }
      }, duration);
    }

    for (const channel of next.channels) {
      restartLoopingChannelIfComplete(channel.id);
    }
  };

  const add = (element) => {
    const existingInstance = sounds.get(`direct:${element.id}`);
    if (existingInstance?.finishing) {
      removeSoundInstance(existingInstance, [], 0);
    }

    const audio = {
      id: element.id,
      type: "sound",
      src: element.url ?? element.src,
      loop: element.loop ?? false,
      volume: normalizeDirectVolume(element.volume),
      muted: element.muted ?? false,
      pan: toFiniteParamValue(element.pan, 0),
      startDelayMs: Math.max(0, toFiniteParamValue(element.startDelayMs, 0)),
      playbackRate: toFiniteParamValue(element.playbackRate, 1),
      startAt: Math.max(0, toFiniteParamValue(element.startAt, 0)),
      endAt:
        element.endAt !== undefined && element.endAt !== null
          ? Math.max(0, toFiniteParamValue(element.endAt, 0))
          : null,
    };

    directAudios.set(element.id, audio);
    debugAudio("direct add", {
      id: audio.id,
      src: audio.src,
      loop: audio.loop,
      volume: audio.volume,
      muted: audio.muted,
      pan: audio.pan,
    });
  };

  const remove = (id) => {
    const internalId = `direct:${id}`;
    const instance = sounds.get(internalId);
    debugAudio("direct remove", {
      id,
      hadAudio: directAudios.has(id),
      hadInstance: Boolean(instance),
    });
    directAudios.delete(id);
    currentSoundKeyById.delete(id);
    if (instance) {
      removeSoundInstance(instance, [], 0);
    }
  };

  const finish = (id) => {
    const internalId = `direct:${id}`;
    const instance = sounds.get(internalId);
    debugAudio("direct finish", {
      id,
      hadAudio: directAudios.has(id),
      hadInstance: Boolean(instance),
    });
    directAudios.delete(id);
    currentSoundKeyById.delete(id);
    finishSoundInstance(instance);
  };

  const getById = (id) => directAudios.get(id);

  const resume = () => resumeAudioContext(getAudioContext());

  const tick = () => {
    const channel = ensureRootChannel(DIRECT_CHANNEL_ID);
    for (const audio of directAudios.values()) {
      const internalId = `direct:${audio.id}`;
      const instance = sounds.get(internalId);
      if (!instance) {
        const directSound = { ...audio, channelId: DIRECT_CHANNEL_ID };
        addSoundInstance({
          sound: directSound,
          effects: [],
          phase: "enter",
          internalId,
        });
        continue;
      }

      if (instance.src !== audio.src) {
        removeSoundInstance(instance, [], 0);
        const directSound = { ...audio, channelId: DIRECT_CHANNEL_ID };
        addSoundInstance({
          sound: directSound,
          effects: [],
          phase: "enter",
          internalId,
        });
        continue;
      }

      updateSoundInstance({
        instance,
        sound: { ...audio, channelId: DIRECT_CHANNEL_ID },
        effects: [],
      });
    }

    for (const [internalId, instance] of sounds) {
      if (
        internalId.startsWith("direct:") &&
        !directAudios.has(instance.id) &&
        !instance.finishing
      ) {
        removeSoundInstance(instance, [], 0);
        currentSoundKeyById.delete(instance.id);
      }
    }

    return channel;
  };

  const destroy = () => {
    for (const sound of sounds.values()) {
      cleanupSound(sound);
    }
    for (const channel of channels.values()) {
      cleanupChannel(channel);
    }

    sounds.clear();
    currentSoundKeyById.clear();
    channels.clear();
    directAudios.clear();
  };

  return {
    add,
    remove,
    finish,
    getById,
    resume,
    tick,
    renderGraph,
    destroy,
    _inspect: () => ({
      channels,
      sounds,
      currentSoundKeyById,
      directAudios,
    }),
  };
};

export const AudioStage = createAudioStage;
