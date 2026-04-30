const AUDIO_NODE_TYPES = new Set(["audio-channel", "sound"]);
const AUDIO_EFFECT_TYPES = new Set(["audioTransition"]);
const AUDIO_TRANSITION_PHASES = new Set(["enter", "exit", "update"]);
const AUDIO_TRANSITION_PROPERTIES = new Set(["volume"]);
const AUDIO_EASINGS = new Set(["linear"]);
const AUDIO_TRANSITION_PHASE_KEYS = {
  enter: new Set(["from", "duration", "easing"]),
  exit: new Set(["to", "duration", "easing"]),
  update: new Set(["duration", "easing"]),
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const assertRecord = (value, path) => {
  if (!isRecord(value)) {
    throw new Error(`Input error: ${path} must be an object.`);
  }
};

const assertNonEmptyString = (value, path) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Input error: ${path} must be a non-empty string.`);
  }
};

const assertNumber = (value, path, { min, max } = {}) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Input error: ${path} must be a number.`);
  }

  if (min !== undefined && value < min) {
    throw new Error(
      `Input error: ${path} must be greater than or equal to ${min}.`,
    );
  }

  if (max !== undefined && value > max) {
    throw new Error(
      `Input error: ${path} must be less than or equal to ${max}.`,
    );
  }
};

const assertOptionalBoolean = (value, path) => {
  if (value !== undefined && typeof value !== "boolean") {
    throw new Error(`Input error: ${path} must be a boolean.`);
  }
};

const assertOptionalNumber = (value, path, range) => {
  if (value !== undefined && value !== null) {
    assertNumber(value, path, range);
  }
};

const assertUniqueId = (ids, id, path) => {
  if (ids.has(id)) {
    throw new Error(
      `Input error: duplicate audio render-state id "${id}" at ${path}.`,
    );
  }
  ids.add(id);
};

const validateSound = (node, path, ids, flattenedSounds, channelId = null) => {
  assertNonEmptyString(node.id, `${path}.id`);
  assertUniqueId(ids, node.id, `${path}.id`);
  assertNonEmptyString(node.src, `${path}.src`);

  if (node.delay !== undefined) {
    throw new Error(
      `Input error: ${path}.delay is not supported. Use ${path}.startDelayMs instead.`,
    );
  }

  assertOptionalNumber(node.volume, `${path}.volume`, { min: 0, max: 100 });
  assertOptionalBoolean(node.muted, `${path}.muted`);
  assertOptionalNumber(node.pan, `${path}.pan`, { min: -1, max: 1 });
  assertOptionalBoolean(node.loop, `${path}.loop`);
  assertOptionalNumber(node.startDelayMs, `${path}.startDelayMs`, { min: 0 });
  assertOptionalNumber(node.playbackRate, `${path}.playbackRate`, { min: 0 });
  assertOptionalNumber(node.startAt, `${path}.startAt`, { min: 0 });
  assertOptionalNumber(node.endAt, `${path}.endAt`, { min: 0 });

  if (
    node.endAt !== undefined &&
    node.endAt !== null &&
    node.startAt !== undefined &&
    node.endAt < node.startAt
  ) {
    throw new Error(
      `Input error: ${path}.endAt must be greater than or equal to startAt.`,
    );
  }

  flattenedSounds.push({
    id: node.id,
    type: "sound",
    src: node.src,
    volume: node.volume ?? 100,
    muted: node.muted ?? false,
    pan: node.pan ?? 0,
    loop: node.loop ?? false,
    startDelayMs: node.startDelayMs ?? 0,
    playbackRate: node.playbackRate ?? 1,
    startAt: node.startAt ?? 0,
    endAt: node.endAt ?? null,
    channelId,
  });
};

const validateChannel = (
  node,
  path,
  ids,
  flattenedChannels,
  flattenedSounds,
) => {
  assertNonEmptyString(node.id, `${path}.id`);
  assertUniqueId(ids, node.id, `${path}.id`);

  assertOptionalNumber(node.volume, `${path}.volume`, { min: 0, max: 100 });
  assertOptionalBoolean(node.muted, `${path}.muted`);
  assertOptionalNumber(node.pan, `${path}.pan`, { min: -1, max: 1 });

  if (node.children !== undefined && !Array.isArray(node.children)) {
    throw new Error(`Input error: ${path}.children must be an array.`);
  }

  flattenedChannels.push({
    id: node.id,
    type: "audio-channel",
    volume: node.volume ?? 100,
    muted: node.muted ?? false,
    pan: node.pan ?? 0,
  });

  for (const [index, child] of (node.children ?? []).entries()) {
    const childPath = `${path}.children[${index}]`;
    assertRecord(child, childPath);

    if (child.type === "audio-channel") {
      throw new Error(
        `Input error: nested audio-channel nodes are not supported at ${childPath}.`,
      );
    }

    if (child.type !== "sound") {
      throw new Error(`Input error: ${childPath}.type must be "sound".`);
    }

    validateSound(child, childPath, ids, flattenedSounds, node.id);
  }
};

const validateAudioNodes = (audio, ids) => {
  if (!Array.isArray(audio)) {
    throw new Error("Input error: `audio` must be an array.");
  }

  const flattenedChannels = [];
  const flattenedSounds = [];

  for (const [index, node] of audio.entries()) {
    const path = `audio[${index}]`;
    assertRecord(node, path);

    if (!AUDIO_NODE_TYPES.has(node.type)) {
      throw new Error(
        `Input error: unsupported audio node type "${node.type}" at ${path}.`,
      );
    }

    if (node.type === "audio-channel") {
      validateChannel(node, path, ids, flattenedChannels, flattenedSounds);
    } else {
      validateSound(node, path, ids, flattenedSounds);
    }
  }

  return {
    channels: flattenedChannels,
    sounds: flattenedSounds,
  };
};

const validateTransitionPhase = (phase, phaseName, path, propertyName) => {
  assertRecord(phase, path);

  for (const key of Object.keys(phase)) {
    if (!AUDIO_TRANSITION_PHASE_KEYS[phaseName].has(key)) {
      throw new Error(
        `Input error: unsupported audio transition field "${key}" at ${path}.`,
      );
    }
  }

  if (phase.duration === undefined) {
    throw new Error(`Input error: ${path}.duration is required.`);
  }
  assertNumber(phase.duration, `${path}.duration`, { min: 0 });

  if (phase.easing === undefined) {
    throw new Error(`Input error: ${path}.easing is required.`);
  }
  if (!AUDIO_EASINGS.has(phase.easing)) {
    throw new Error(
      `Input error: ${path}.easing "${phase.easing}" is not supported.`,
    );
  }

  if (phaseName === "enter") {
    if (phase.from === undefined) {
      throw new Error(`Input error: ${path}.from is required.`);
    }
    assertNumber(phase.from, `${path}.from`, { min: 0, max: 100 });
  }

  if (phaseName === "exit") {
    if (phase.to === undefined) {
      throw new Error(`Input error: ${path}.to is required.`);
    }
    assertNumber(phase.to, `${path}.to`, { min: 0, max: 100 });
  }

  if (propertyName !== "volume") {
    throw new Error(
      `Input error: unsupported audio transition property "${propertyName}" at ${path}.`,
    );
  }
};

const validateAudioTransition = (effect, path, nodeIds) => {
  assertNonEmptyString(effect.targetId, `${path}.targetId`);
  if (!nodeIds.has(effect.targetId)) {
    throw new Error(
      `Input error: ${path}.targetId "${effect.targetId}" does not resolve to an audio node.`,
    );
  }

  assertRecord(effect.properties, `${path}.properties`);

  for (const [propertyName, propertyTransitions] of Object.entries(
    effect.properties,
  )) {
    if (!AUDIO_TRANSITION_PROPERTIES.has(propertyName)) {
      throw new Error(
        `Input error: unsupported audio transition property "${propertyName}" at ${path}.properties.`,
      );
    }

    assertRecord(propertyTransitions, `${path}.properties.${propertyName}`);

    for (const [phaseName, phase] of Object.entries(propertyTransitions)) {
      if (!AUDIO_TRANSITION_PHASES.has(phaseName)) {
        throw new Error(
          `Input error: unsupported audio transition phase "${phaseName}" at ${path}.properties.${propertyName}.`,
        );
      }

      validateTransitionPhase(
        phase,
        phaseName,
        `${path}.properties.${propertyName}.${phaseName}`,
        propertyName,
      );
    }
  }
};

const validateAudioEffects = (audioEffects, ids, nodeIds) => {
  if (!Array.isArray(audioEffects)) {
    throw new Error("Input error: `audioEffects` must be an array.");
  }

  for (const [index, effect] of audioEffects.entries()) {
    const path = `audioEffects[${index}]`;
    assertRecord(effect, path);
    assertNonEmptyString(effect.id, `${path}.id`);
    assertUniqueId(ids, effect.id, `${path}.id`);

    if (!AUDIO_EFFECT_TYPES.has(effect.type)) {
      throw new Error(
        `Input error: unsupported audio effect type "${effect.type}" at ${path}.`,
      );
    }

    if (effect.type === "audioTransition") {
      validateAudioTransition(effect, path, nodeIds);
    }
  }
};

export const flattenAudioNodes = (audio = []) => {
  const ids = new Set();
  return validateAudioNodes(audio, ids);
};

export const normalizeAudioRenderState = ({
  audio = [],
  audioEffects = [],
} = {}) => {
  const ids = new Set();
  const flattened = validateAudioNodes(audio, ids);
  const nodeIds = new Set(ids);
  validateAudioEffects(audioEffects, ids, nodeIds);

  return {
    audio,
    audioEffects,
    ...flattened,
  };
};
