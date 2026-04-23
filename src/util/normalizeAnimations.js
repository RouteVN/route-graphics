import { SUPPORTED_EASING_NAMES } from "./animationTimeline.js";

const ANIMATION_TYPES = new Set(["update", "transition"]);
const CONTINUITY_MODES = new Set(["persistent"]);
const UPDATE_TWEEN_PROPERTIES = new Set([
  "alpha",
  "x",
  "y",
  "scaleX",
  "scaleY",
  "rotation",
]);
const TRANSITION_TWEEN_PROPERTIES = new Set([
  "translateX",
  "translateY",
  "alpha",
  "scaleX",
  "scaleY",
  "rotation",
]);
const MASK_KINDS = new Set(["single", "sequence", "composite"]);
const MASK_CHANNELS = new Set(["red", "green", "blue", "alpha"]);
const MASK_COMBINE_MODES = new Set(["max", "min", "multiply", "add"]);
const SUPPORTED_EASINGS = new Set(SUPPORTED_EASING_NAMES);

const assertPlainObject = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
};

const assertString = (value, path) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
};

const assertNumber = (value, path) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${path} must be a number.`);
  }
};

const normalizePlayback = (playback, path) => {
  assertPlainObject(playback, path);

  if (!CONTINUITY_MODES.has(playback.continuity)) {
    throw new Error(
      `${path}.continuity must be one of: ${Array.from(CONTINUITY_MODES).join(", ")}.`,
    );
  }

  return {
    continuity: playback.continuity,
  };
};

const normalizeAutoTween = (autoConfig, path) => {
  assertPlainObject(autoConfig, path);
  assertNumber(autoConfig.duration, `${path}.duration`);

  if (
    autoConfig.easing !== undefined &&
    typeof autoConfig.easing !== "string"
  ) {
    throw new Error(`${path}.easing must be a string.`);
  }

  if (
    autoConfig.easing !== undefined &&
    !SUPPORTED_EASINGS.has(autoConfig.easing)
  ) {
    throw new Error(
      `${path}.easing must be one of: ${SUPPORTED_EASING_NAMES.join(", ")}.`,
    );
  }

  return {
    duration: autoConfig.duration,
    easing: autoConfig.easing ?? "linear",
  };
};

const normalizeKeyframes = (propertyConfig, path) => {
  assertPlainObject(propertyConfig, path);

  const normalized = {};

  if (propertyConfig.initialValue !== undefined) {
    assertNumber(propertyConfig.initialValue, `${path}.initialValue`);
    normalized.initialValue = propertyConfig.initialValue;
  }

  if (
    !Array.isArray(propertyConfig.keyframes) ||
    propertyConfig.keyframes.length === 0
  ) {
    throw new Error(`${path}.keyframes must be a non-empty array.`);
  }

  normalized.keyframes = propertyConfig.keyframes.map((keyframe, index) => {
    const keyframePath = `${path}.keyframes[${index}]`;
    assertPlainObject(keyframe, keyframePath);
    assertNumber(keyframe.value, `${keyframePath}.value`);
    assertNumber(keyframe.duration, `${keyframePath}.duration`);

    if (keyframe.easing !== undefined && typeof keyframe.easing !== "string") {
      throw new Error(`${keyframePath}.easing must be a string.`);
    }

    if (
      keyframe.easing !== undefined &&
      !SUPPORTED_EASINGS.has(keyframe.easing)
    ) {
      throw new Error(
        `${keyframePath}.easing must be one of: ${SUPPORTED_EASING_NAMES.join(", ")}.`,
      );
    }

    if (
      keyframe.relative !== undefined &&
      typeof keyframe.relative !== "boolean"
    ) {
      throw new Error(`${keyframePath}.relative must be a boolean.`);
    }

    return {
      value: keyframe.value,
      duration: keyframe.duration,
      easing: keyframe.easing ?? "linear",
      ...(keyframe.relative !== undefined
        ? { relative: keyframe.relative }
        : {}),
    };
  });

  return normalized;
};

const normalizeUpdatePropertyConfig = (propertyConfig, path) => {
  assertPlainObject(propertyConfig, path);

  const hasKeyframes = propertyConfig.keyframes !== undefined;
  const hasAuto = propertyConfig.auto !== undefined;

  if (hasKeyframes && hasAuto) {
    throw new Error(`${path} cannot define both keyframes and auto.`);
  }

  if (!hasKeyframes && !hasAuto) {
    throw new Error(`${path} must define keyframes or auto.`);
  }

  if (hasAuto) {
    if (propertyConfig.initialValue !== undefined) {
      throw new Error(
        `${path}.initialValue is not valid when auto is defined.`,
      );
    }

    return {
      auto: normalizeAutoTween(propertyConfig.auto, `${path}.auto`),
    };
  }

  return normalizeKeyframes(propertyConfig, path);
};

const normalizeTweenMap = (
  tween,
  path,
  allowedProperties,
  propertyNormalizer = normalizeKeyframes,
) => {
  assertPlainObject(tween, path);

  const normalizedEntries = Object.entries(tween).map(([property, config]) => {
    if (!allowedProperties.has(property)) {
      throw new Error(
        `${path}.${property} is not a supported animation property.`,
      );
    }

    return [property, propertyNormalizer(config, `${path}.${property}`)];
  });

  if (normalizedEntries.length === 0) {
    throw new Error(`${path} must define at least one property.`);
  }

  return Object.fromEntries(normalizedEntries);
};

const normalizeMaskResource = (maskItem, path) => {
  assertPlainObject(maskItem, path);
  assertString(maskItem.texture, `${path}.texture`);

  if (maskItem.channel !== undefined && !MASK_CHANNELS.has(maskItem.channel)) {
    throw new Error(
      `${path}.channel must be one of: ${Array.from(MASK_CHANNELS).join(", ")}.`,
    );
  }

  if (maskItem.invert !== undefined && typeof maskItem.invert !== "boolean") {
    throw new Error(`${path}.invert must be a boolean.`);
  }

  return {
    texture: maskItem.texture,
    ...(maskItem.channel ? { channel: maskItem.channel } : {}),
    ...(maskItem.invert !== undefined ? { invert: maskItem.invert } : {}),
  };
};

const normalizeMask = (mask, path) => {
  assertPlainObject(mask, path);

  if (!MASK_KINDS.has(mask.kind)) {
    throw new Error(
      `${path}.kind must be one of: ${Array.from(MASK_KINDS).join(", ")}.`,
    );
  }

  const normalized = {
    kind: mask.kind,
  };

  if (mask.channel !== undefined) {
    if (!MASK_CHANNELS.has(mask.channel)) {
      throw new Error(
        `${path}.channel must be one of: ${Array.from(MASK_CHANNELS).join(", ")}.`,
      );
    }
    normalized.channel = mask.channel;
  }

  if (mask.softness !== undefined) {
    assertNumber(mask.softness, `${path}.softness`);
    normalized.softness = mask.softness;
  }

  if (mask.invert !== undefined) {
    if (typeof mask.invert !== "boolean") {
      throw new Error(`${path}.invert must be a boolean.`);
    }
    normalized.invert = mask.invert;
  }

  if (mask.progress !== undefined) {
    normalized.progress = normalizeKeyframes(mask.progress, `${path}.progress`);
  }

  if (mask.kind === "single") {
    assertString(mask.texture, `${path}.texture`);
    normalized.texture = mask.texture;
  }

  if (mask.kind === "sequence") {
    if (!Array.isArray(mask.textures) || mask.textures.length === 0) {
      throw new Error(`${path}.textures must be a non-empty array.`);
    }

    normalized.textures = mask.textures.map((texture, index) => {
      assertString(texture, `${path}.textures[${index}]`);
      return texture;
    });

    if (mask.sample !== undefined) {
      assertString(mask.sample, `${path}.sample`);
      normalized.sample = mask.sample;
    }
  }

  if (mask.kind === "composite") {
    if (!MASK_COMBINE_MODES.has(mask.combine ?? "max")) {
      throw new Error(
        `${path}.combine must be one of: ${Array.from(MASK_COMBINE_MODES).join(", ")}.`,
      );
    }

    if (!Array.isArray(mask.items) || mask.items.length === 0) {
      throw new Error(`${path}.items must be a non-empty array.`);
    }

    normalized.combine = mask.combine ?? "max";
    normalized.items = mask.items.map((item, index) =>
      normalizeMaskResource(item, `${path}.items[${index}]`),
    );
  }

  if (!normalized.progress) {
    normalized.progress = {
      initialValue: 0,
      keyframes: [{ duration: 0, value: 1, easing: "linear" }],
    };
  }

  return normalized;
};

const normalizeReplaceSide = (side, path) => {
  assertPlainObject(side, path);

  if (side.mask !== undefined) {
    throw new Error(`${path}.mask is not valid. Define mask on ${path}.`);
  }

  const normalized = {};

  if (side.tween !== undefined) {
    normalized.tween = normalizeTweenMap(
      side.tween,
      `${path}.tween`,
      TRANSITION_TWEEN_PROPERTIES,
    );
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error(`${path} must define tween.`);
  }

  return normalized;
};

const normalizeReplacePayload = (animation, path) => {
  const normalized = {};

  if (animation.shader !== undefined) {
    throw new Error(`${path}.shader is not supported.`);
  }

  if (animation.prev !== undefined) {
    normalized.prev = normalizeReplaceSide(animation.prev, `${path}.prev`);
  }

  if (animation.next !== undefined) {
    normalized.next = normalizeReplaceSide(animation.next, `${path}.next`);
  }

  if (animation.mask !== undefined) {
    normalized.mask = normalizeMask(animation.mask, `${path}.mask`);
  }

  if (
    normalized.prev === undefined &&
    normalized.next === undefined &&
    normalized.mask === undefined
  ) {
    throw new Error(`${path} must define prev, next, or mask.`);
  }

  return normalized;
};

const assertLegacyFieldAbsent = (value, path, message) => {
  if (value !== undefined) {
    throw new Error(`${path} ${message}`);
  }
};

export const normalizeAnimations = (animations = []) => {
  if (!Array.isArray(animations)) {
    throw new Error("Input error: `animations` must be an array.");
  }

  const normalized = animations.map((animation, index) => {
    const path = `animations[${index}]`;
    assertPlainObject(animation, path);
    assertString(animation.id, `${path}.id`);
    assertString(animation.targetId, `${path}.targetId`);
    assertString(animation.type, `${path}.type`);

    if (!ANIMATION_TYPES.has(animation.type)) {
      throw new Error(
        `${path}.type must be one of: ${Array.from(ANIMATION_TYPES).join(", ")}.`,
      );
    }

    const normalizedAnimation = {
      id: animation.id,
      targetId: animation.targetId,
      type: animation.type,
    };

    if (animation.complete !== undefined) {
      assertPlainObject(animation.complete, `${path}.complete`);
      normalizedAnimation.complete = animation.complete;
    }

    if (animation.playback !== undefined) {
      normalizedAnimation.playback = normalizePlayback(
        animation.playback,
        `${path}.playback`,
      );
    }

    assertLegacyFieldAbsent(
      animation.operation,
      `${path}.operation`,
      "is no longer supported. Use `type: update | transition` instead.",
    );
    assertLegacyFieldAbsent(
      animation.properties,
      `${path}.properties`,
      "is no longer supported. Use `tween` instead.",
    );
    assertLegacyFieldAbsent(
      animation.subjects,
      `${path}.subjects`,
      "is no longer supported. Use `prev` / `next` instead.",
    );

    if (animation.type === "update") {
      normalizedAnimation.tween = normalizeTweenMap(
        animation.tween,
        `${path}.tween`,
        UPDATE_TWEEN_PROPERTIES,
        normalizeUpdatePropertyConfig,
      );

      if (animation.replace !== undefined) {
        throw new Error(
          `${path}.replace is no longer supported. Define \`prev\`, \`next\`, or \`mask\` directly on the animation.`,
        );
      }

      if (animation.prev !== undefined) {
        throw new Error(
          `${path}.prev is only valid for transition animations.`,
        );
      }

      if (animation.next !== undefined) {
        throw new Error(
          `${path}.next is only valid for transition animations.`,
        );
      }

      if (animation.mask !== undefined) {
        throw new Error(
          `${path}.mask is only valid for transition animations.`,
        );
      }

      if (animation.shader !== undefined) {
        throw new Error(`${path}.shader is not supported.`);
      }

      return normalizedAnimation;
    }

    if (animation.tween !== undefined) {
      throw new Error(`${path}.tween is not valid for transition animations.`);
    }

    if (animation.replace !== undefined) {
      throw new Error(
        `${path}.replace is no longer supported. Define \`prev\`, \`next\`, or \`mask\` directly on the animation.`,
      );
    }

    const normalizedReplace = normalizeReplacePayload(animation, path);
    if (normalizedReplace.prev !== undefined) {
      normalizedAnimation.prev = normalizedReplace.prev;
    }
    if (normalizedReplace.next !== undefined) {
      normalizedAnimation.next = normalizedReplace.next;
    }
    if (normalizedReplace.mask !== undefined) {
      normalizedAnimation.mask = normalizedReplace.mask;
    }

    return normalizedAnimation;
  });

  const targetKinds = new Map();

  for (const animation of normalized) {
    const kinds = targetKinds.get(animation.targetId) ?? new Set();
    kinds.add(animation.type);
    targetKinds.set(animation.targetId, kinds);
  }

  for (const [targetId, kinds] of targetKinds) {
    if (kinds.has("transition") && kinds.size > 1) {
      throw new Error(
        `Animations targeting "${targetId}" cannot mix update and transition types in the same state.`,
      );
    }
  }

  return normalized;
};

export default normalizeAnimations;
