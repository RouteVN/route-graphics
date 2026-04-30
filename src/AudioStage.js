import { AudioAsset } from "./AudioAsset.js";
import { normalizeVolume } from "./util/normalizeVolume.js";
import { normalizeAudioRenderState } from "./util/normalizeAudio.js";

const ROOT_CHANNEL_ID = "__route_graphics_audio_root__";
const DIRECT_CHANNEL_ID = "__route_graphics_audio_direct__";

let audioContext;

const getAudioContext = () => {
  if (audioContext) return audioContext;

  const AudioContextCtor =
    globalThis.window?.AudioContext ?? globalThis.window?.webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("AudioContext is not available in this environment.");
  }

  audioContext = new AudioContextCtor();
  return audioContext;
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

const getParamValue = (param, fallback = 0) =>
  typeof param?.value === "number" ? param.value : fallback;

const setParamNow = (param, value, context = getAudioContext()) => {
  if (!param) return;
  if (typeof param.cancelScheduledValues === "function") {
    param.cancelScheduledValues(context.currentTime);
  }
  if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(value, context.currentTime);
  } else {
    param.value = value;
  }
};

const rampParam = (param, value, durationMs, context = getAudioContext()) => {
  if (!param) return;

  const now = context.currentTime;
  const seconds = durationMs / 1000;
  const currentValue = getParamValue(param);

  if (typeof param.cancelScheduledValues === "function") {
    param.cancelScheduledValues(now);
  }
  if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(currentValue, now);
  } else {
    param.value = currentValue;
  }

  if (seconds > 0 && typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(value, now + seconds);
  } else if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(value, now + seconds);
  } else {
    param.value = value;
  }
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

const getTransitionPhase = (effects = [], targetId, property, phase) => {
  const transition = effects.find(
    (effect) =>
      effect.type === "audioTransition" && effect.targetId === targetId,
  );

  return transition?.properties?.[property]?.[phase] ?? null;
};

const getTransitionDuration = (transition) =>
  typeof transition?.duration === "number" ? transition.duration : 0;

const applyVolume = ({ gainNode, targetValue, transition }) => {
  if (!transition) {
    setParamNow(gainNode.gain, targetValue);
    return 0;
  }

  const initialValue =
    transition.from !== undefined
      ? normalizeVolume(transition.from, 100)
      : undefined;
  const finalValue =
    transition.to !== undefined
      ? normalizeVolume(transition.to, 100)
      : targetValue;

  if (initialValue !== undefined) {
    setParamNow(gainNode.gain, initialValue);
  }
  rampParam(gainNode.gain, finalValue, transition.duration);

  return transition.duration;
};

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
    pendingTimeoutId: null,
    cleanupTimeoutId: null,
  };
};

const createSourceForSound = (sound) => {
  const context = getAudioContext();
  const audioBuffer = AudioAsset.getAsset(sound.src);
  if (!audioBuffer) {
    console.warn("AudioStage: asset not found", sound.src);
    return null;
  }

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = sound.loop ?? false;

  if (source.playbackRate) {
    setParamNow(source.playbackRate, sound.playbackRate ?? 1, context);
  }

  connect(source, sound.gainNode);

  const offset = sound.startAt ?? 0;
  const duration =
    sound.endAt !== null && sound.endAt !== undefined
      ? Math.max(sound.endAt - offset, 0)
      : undefined;

  if (duration !== undefined) {
    source.start(0, offset, duration);
  } else {
    source.start(0, offset);
  }

  return source;
};

const playSound = (sound) => {
  if (sound.pendingTimeoutId !== null) {
    clearTimeout(sound.pendingTimeoutId);
    sound.pendingTimeoutId = null;
  }

  const start = () => {
    sound.pendingTimeoutId = null;
    sound.source = createSourceForSound(sound);
  };

  if (sound.startDelayMs > 0) {
    sound.pendingTimeoutId = setTimeout(start, sound.startDelayMs);
    return;
  }

  start();
};

const stopSource = (sound, delayMs = 0) => {
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
    volume: (options.volume ?? 1) * 100,
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
      instance.volume = newState.volume * 100;
      setParamNow(instance.gainNode.gain, newState.volume);
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
      instance.volume = volume * 100;
      setParamNow(instance.gainNode.gain, volume);
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
    const transition = getTransitionPhase(effects, channel.id, "volume", phase);

    if (existing) {
      if (existing.cleanupTimeoutId !== null) {
        clearTimeout(existing.cleanupTimeoutId);
        existing.cleanupTimeoutId = null;
      }

      existing.volume = channel.volume;
      existing.muted = channel.muted;
      existing.pan = channel.pan;
      applyVolume({
        gainNode: existing.gainNode,
        targetValue: getVolumeValue(channel),
        transition,
      });
      if (existing.pannerNode?.pan) {
        setParamNow(existing.pannerNode.pan, channel.pan ?? 0);
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
      transition,
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

    const transition = getTransitionPhase(
      effects,
      channel.id,
      "volume",
      "exit",
    );
    const duration = applyVolume({
      gainNode: channel.gainNode,
      targetValue: getVolumeValue(channel),
      transition,
    });

    return duration;
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

    const transition = getTransitionPhase(effects, sound.id, "volume", phase);
    applyVolume({
      gainNode: instance.gainNode,
      targetValue: getVolumeValue(sound),
      transition,
    });
    playSound(instance);
    return instance;
  };

  const removeSoundInstance = (instance, effects, inheritedDuration = 0) => {
    if (!instance) return 0;

    const transition = getTransitionPhase(
      effects,
      instance.id,
      "volume",
      "exit",
    );
    const ownDuration = applyVolume({
      gainNode: instance.gainNode,
      targetValue: getVolumeValue(instance),
      transition,
    });
    const duration = Math.max(ownDuration, inheritedDuration);

    stopSource(instance, duration);
    instance.cleanupTimeoutId = schedule(() => {
      cleanupSound(instance);
      sounds.delete(instance.internalId);
    }, duration);

    return duration;
  };

  const updateSoundInstance = ({ instance, sound, effects }) => {
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

    if (instance.source) {
      instance.source.loop = sound.loop;
      if (instance.source.playbackRate) {
        setParamNow(instance.source.playbackRate, sound.playbackRate);
      }
    }

    if (instance.pannerNode?.pan) {
      setParamNow(instance.pannerNode.pan, sound.pan);
    }

    const transition = getTransitionPhase(
      effects,
      sound.id,
      "volume",
      "update",
    );
    applyVolume({
      gainNode: instance.gainNode,
      targetValue: getVolumeValue(sound),
      transition,
    });
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

    ensureRootChannel(ROOT_CHANNEL_ID);

    const removedChannels = new Map();
    const channelCleanupDurations = new Map();

    for (const [id, prevChannel] of prevChannelById) {
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

      if (prevSound.src !== nextSound.src) {
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
      if (prevSound.src !== nextSound.src) {
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
        channels.delete(id);
      }, duration);
    }
  };

  const add = (element) => {
    const audio = {
      id: element.id,
      type: "sound",
      src: element.url ?? element.src,
      loop: element.loop ?? false,
      volume: (element.volume ?? 1) * 100,
      startDelayMs: element.startDelayMs ?? 0,
    };

    directAudios.set(element.id, audio);
  };

  const remove = (id) => {
    directAudios.delete(id);
    currentSoundKeyById.delete(id);
    const internalId = `direct:${id}`;
    const instance = sounds.get(internalId);
    if (instance) {
      removeSoundInstance(instance, [], 0);
    }
  };

  const getById = (id) => directAudios.get(id);

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
      if (internalId.startsWith("direct:") && !directAudios.has(instance.id)) {
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
    getById,
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
