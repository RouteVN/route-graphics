const LIVE_OPERATIONS = new Set(["enter", "update", "exit"]);
const ALL_OPERATIONS = new Set([...LIVE_OPERATIONS, "replace"]);
const LIVE_PROPERTIES = new Set([
  "alpha",
  "x",
  "y",
  "scaleX",
  "scaleY",
  "rotation",
]);
const REPLACE_SUBJECT_PROPERTIES = new Set([
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

const normalizePropertyMap = (properties, path, allowedProperties) => {
  assertPlainObject(properties, path);

  const normalizedEntries = Object.entries(properties).map(
    ([property, config]) => {
      if (!allowedProperties.has(property)) {
        throw new Error(
          `${path}.${property} is not a supported animation property.`,
        );
      }

      return [property, normalizeKeyframes(config, `${path}.${property}`)];
    },
  );

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

const normalizeSubjects = (subjects, path) => {
  assertPlainObject(subjects, path);

  const normalized = {};

  for (const subject of ["prev", "next"]) {
    if (!subjects[subject]) continue;

    assertPlainObject(subjects[subject], `${path}.${subject}`);
    const subjectEntry = {};

    if (subjects[subject].properties !== undefined) {
      subjectEntry.properties = normalizePropertyMap(
        subjects[subject].properties,
        `${path}.${subject}.properties`,
        REPLACE_SUBJECT_PROPERTIES,
      );
    }

    normalized[subject] = subjectEntry;
  }

  if (!normalized.prev && !normalized.next) {
    throw new Error(`${path} must define prev and/or next.`);
  }

  return normalized;
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
    assertString(animation.operation, `${path}.operation`);

    if (!ALL_OPERATIONS.has(animation.operation)) {
      throw new Error(
        `${path}.operation must be one of: ${Array.from(ALL_OPERATIONS).join(", ")}.`,
      );
    }

    const normalizedAnimation = {
      id: animation.id,
      targetId: animation.targetId,
      operation: animation.operation,
    };

    if (animation.complete !== undefined) {
      assertPlainObject(animation.complete, `${path}.complete`);
      normalizedAnimation.complete = animation.complete;
    }

    if (animation.shader !== undefined) {
      throw new Error(`${path}.shader is not supported.`);
    }

    if (LIVE_OPERATIONS.has(animation.operation)) {
      normalizedAnimation.properties = normalizePropertyMap(
        animation.properties,
        `${path}.properties`,
        LIVE_PROPERTIES,
      );

      if (animation.subjects !== undefined) {
        throw new Error(
          `${path}.subjects is only valid for replace animations.`,
        );
      }
      if (animation.mask !== undefined) {
        throw new Error(`${path}.mask is only valid for replace animations.`);
      }

      return normalizedAnimation;
    }

    if (animation.properties !== undefined) {
      throw new Error(
        `${path}.properties is not valid for replace animations.`,
      );
    }

    if (animation.subjects !== undefined) {
      normalizedAnimation.subjects = normalizeSubjects(
        animation.subjects,
        `${path}.subjects`,
      );
    }

    if (animation.mask !== undefined) {
      normalizedAnimation.mask = normalizeMask(animation.mask, `${path}.mask`);
    }

    if (
      normalizedAnimation.subjects === undefined &&
      normalizedAnimation.mask === undefined
    ) {
      throw new Error(
        `${path} replace animations must define subjects or mask.`,
      );
    }

    const hasSubjectProperties =
      normalizedAnimation.subjects?.prev?.properties !== undefined ||
      normalizedAnimation.subjects?.next?.properties !== undefined;

    if (normalizedAnimation.mask && hasSubjectProperties) {
      throw new Error(
        `${path} cannot combine subject property animation with mask replace.`,
      );
    }

    return normalizedAnimation;
  });

  const replaceTargets = new Set();

  for (const animation of normalized) {
    if (animation.operation !== "replace") continue;

    if (replaceTargets.has(animation.targetId)) {
      throw new Error(
        `Only one replace animation may target "${animation.targetId}" in the same state.`,
      );
    }

    replaceTargets.add(animation.targetId);
  }

  return normalized;
};

export default normalizeAnimations;
