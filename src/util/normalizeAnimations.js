import { SUPPORTED_EASING_NAMES } from "./animationTimeline.js";
import { normalizeShaderCompositor } from "../plugins/elements/util/shaderConfig.js";
import { Color } from "pixi.js";
import { normalizePortableGsap } from "../plugins/animations/timeline/normalizePortableGsap.js";

const ANIMATION_TYPES = new Set(["update", "transition"]);
const CONTINUITY_MODES = new Set(["render", "persistent"]);
const DEFAULT_PLAYBACK_CONTINUITY = "render";
const DEFAULT_PLAYBACK_SPEED = 1;
const DEFAULT_PLAYBACK_LOOP = false;
const DEFAULT_PLAYBACK_REPEAT = 0;
const DEFAULT_PLAYBACK_REPEAT_DELAY = 0;
const DEFAULT_PLAYBACK_YOYO = false;
const UPDATE_TWEEN_PROPERTIES = new Set([
  "alpha",
  "x",
  "y",
  "translateX",
  "translateY",
  "scaleX",
  "scaleY",
  "rotation",
  "blurX",
  "blurY",
]);
const TRANSITION_TWEEN_PROPERTIES = new Set([
  "x",
  "y",
  "translateX",
  "translateY",
  "alpha",
  "scaleX",
  "scaleY",
  "rotation",
]);
const MASK_KINDS = new Set(["single", "sequence"]);
const MASK_CHANNELS = new Set(["red", "green", "blue", "alpha"]);
const MASK_SEQUENCE_SAMPLE_MODES = new Set(["hold", "linear"]);
const SUPPORTED_EASINGS = new Set(SUPPORTED_EASING_NAMES);
const SHADER_PARAMETER_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const RECT_STYLE_TWEEN_FIELDS = new Set([
  "width",
  "height",
  "fill",
  "border",
  "cornerRadius",
]);
// Manual tracks on update/transition surfaces (element properties, rect style
// fields, update filter parameters, replace-side tweens) whose authored
// keyframes array is empty animate nothing: the authored shape and
// initialValue are validated first, then the track prunes to this sentinel so
// grouping normalizers can drop it. A pruning track writes nothing, including
// its initialValue. Surfaces with their own non-empty contract - mask
// progress, compositor tweens, gsap programs, sequence frames - never request
// this policy and keep rejecting empty timelines.
const NO_TRACKS = Symbol("no animation tracks");
const EMPTY_MANUAL_TRACKS = { allowEmptyKeyframes: true };
const MANUAL_TRACK_FIELDS = new Set(["initialValue", "keyframes"]);

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

const assertKnownFields = (value, fields, path) => {
  for (const key of Object.keys(value)) {
    if (!fields.has(key)) {
      throw new Error(`${path}.${key} is not supported.`);
    }
  }
};

const assertNumber = (value, path) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${path} must be a number.`);
  }
};

const assertShaderTweenValue = (value, path) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return;
  }

  if (
    Array.isArray(value) &&
    [2, 3, 4, 9, 16].includes(value.length) &&
    value.every((component) => Number.isFinite(component))
  ) {
    return;
  }

  throw new Error(
    `${path} must be a finite number or a numeric array with length 2, 3, 4, 9, or 16.`,
  );
};

const assertShaderProgressValue = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
};

const assertPositiveFiniteNumber = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${path} must be a finite number greater than 0.`);
  }
};

const assertNonNegativeSafeIntegerMilliseconds = (value, path) => {
  if (value === undefined) {
    throw new Error(`${path} must be a number.`);
  }

  const isDirectLegacyTweenPath =
    /^animations\[\d+\]\.tween\.(?!filters\.)/.test(path);
  if (
    isDirectLegacyTweenPath &&
    path.endsWith(".delay") &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value < 0
  ) {
    throw new Error(
      `${path} must be a finite number greater than or equal to 0.`,
    );
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(
      `${path} must be a finite number greater than or equal to 0 and an integer number of milliseconds.`,
    );
  }
};

const normalizePlayback = (playback, path) => {
  assertPlainObject(playback, path);

  assertKnownFields(
    playback,
    new Set(["continuity", "speed", "loop", "repeat", "repeatDelay", "yoyo"]),
    path,
  );

  const continuity = playback.continuity ?? DEFAULT_PLAYBACK_CONTINUITY;
  if (!CONTINUITY_MODES.has(continuity)) {
    throw new Error(
      `${path}.continuity must be one of: ${Array.from(CONTINUITY_MODES).join(", ")}.`,
    );
  }

  const normalized = { continuity };

  if (playback.speed !== undefined) {
    assertPositiveFiniteNumber(playback.speed, `${path}.speed`);
    if (playback.speed !== DEFAULT_PLAYBACK_SPEED) {
      normalized.speed = playback.speed;
    }
  }

  if (playback.loop !== undefined && playback.repeat !== undefined) {
    throw new Error(`${path} cannot define both loop and repeat.`);
  }

  const loop = playback.loop ?? DEFAULT_PLAYBACK_LOOP;
  if (typeof loop !== "boolean") {
    throw new Error(`${path}.loop must be a boolean.`);
  }
  if (loop) {
    normalized.loop = true;
  }

  const repeat = playback.repeat ?? DEFAULT_PLAYBACK_REPEAT;
  if (repeat !== "infinite" && (!Number.isSafeInteger(repeat) || repeat < 0)) {
    throw new Error(
      `${path}.repeat must be a non-negative safe integer or "infinite".`,
    );
  }
  if (repeat !== DEFAULT_PLAYBACK_REPEAT) {
    normalized.repeat = repeat;
  }

  const repeatDelay = playback.repeatDelay ?? DEFAULT_PLAYBACK_REPEAT_DELAY;
  assertNonNegativeSafeIntegerMilliseconds(repeatDelay, `${path}.repeatDelay`);

  const yoyo = playback.yoyo ?? DEFAULT_PLAYBACK_YOYO;
  if (typeof yoyo !== "boolean") {
    throw new Error(`${path}.yoyo must be a boolean.`);
  }

  const isRepeating = loop || repeat === "infinite" || repeat > 0;
  if (!isRepeating && repeatDelay > 0) {
    throw new Error(`${path}.repeatDelay requires repeat or loop.`);
  }
  if (!isRepeating && yoyo) {
    throw new Error(`${path}.yoyo requires repeat or loop.`);
  }
  if (repeatDelay > 0) normalized.repeatDelay = repeatDelay;
  if (yoyo) normalized.yoyo = true;

  return normalized;
};

const normalizeAutoTween = (autoConfig, path) => {
  assertPlainObject(autoConfig, path);
  assertNonNegativeSafeIntegerMilliseconds(
    autoConfig.duration,
    `${path}.duration`,
  );

  if (autoConfig.delay !== undefined) {
    assertNonNegativeSafeIntegerMilliseconds(autoConfig.delay, `${path}.delay`);
  }

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
    ...(autoConfig.delay > 0 ? { delay: autoConfig.delay } : {}),
  };
};

const normalizeKeyframes = (
  propertyConfig,
  path,
  assertValue = assertNumber,
  normalizeValue = (value) => (Array.isArray(value) ? [...value] : value),
  { allowEmptyKeyframes = false } = {},
) => {
  assertPlainObject(propertyConfig, path);

  const normalized = {};

  if (propertyConfig.initialValue !== undefined) {
    assertValue(propertyConfig.initialValue, `${path}.initialValue`);
    normalized.initialValue = normalizeValue(propertyConfig.initialValue);
  }

  if (!Array.isArray(propertyConfig.keyframes)) {
    throw new Error(`${path}.keyframes must be a non-empty array.`);
  }

  if (propertyConfig.keyframes.length === 0) {
    if (!allowEmptyKeyframes) {
      throw new Error(`${path}.keyframes must be a non-empty array.`);
    }
    // Newly accepted empty tracks must not hide typos or incompatible auto
    // configuration when their callers use the manual-only normalizer.
    assertKnownFields(propertyConfig, MANUAL_TRACK_FIELDS, path);
    return NO_TRACKS;
  }

  normalized.keyframes = propertyConfig.keyframes.map((keyframe, index) => {
    const keyframePath = `${path}.keyframes[${index}]`;
    assertPlainObject(keyframe, keyframePath);
    assertValue(keyframe.value, `${keyframePath}.value`);
    if (keyframe.startValue !== undefined) {
      assertValue(keyframe.startValue, `${keyframePath}.startValue`);
    }
    assertNonNegativeSafeIntegerMilliseconds(
      keyframe.duration,
      `${keyframePath}.duration`,
    );

    if (keyframe.delay !== undefined) {
      assertNonNegativeSafeIntegerMilliseconds(
        keyframe.delay,
        `${keyframePath}.delay`,
      );
    }

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
      value: normalizeValue(keyframe.value),
      ...(keyframe.startValue === undefined
        ? {}
        : { startValue: normalizeValue(keyframe.startValue) }),
      duration: keyframe.duration,
      easing: keyframe.easing ?? "linear",
      ...(keyframe.delay > 0 ? { delay: keyframe.delay } : {}),
      ...(keyframe.relative !== undefined
        ? { relative: keyframe.relative }
        : {}),
    };
  });

  return normalized;
};

// Update filter parameter maps accept empty authoring (empty map, parameters
// with empty keyframes); compositor tweens intentionally keep the strict
// non-empty contract by not passing options here.
const normalizeShaderTweenMap = (tween, path, options = {}) => {
  assertPlainObject(tween, path);
  const { allowEmptyMap = false, ...keyframeOptions } = options;
  const entries = Object.entries(tween);
  if (entries.length === 0 && !allowEmptyMap) {
    throw new Error(`${path} must define at least one parameter.`);
  }

  return Object.fromEntries(
    entries.flatMap(([parameter, config]) => {
      if (parameter === "uTime" || parameter === "time") {
        throw new Error(
          `${path}.${parameter} is read-only. Animate a custom parameter instead.`,
        );
      }
      if (parameter === "uProgress") {
        throw new Error(
          `${path}.uProgress is no longer supported. Use ${path}.progress.`,
        );
      }
      if (
        parameter !== "progress" &&
        !SHADER_PARAMETER_PATTERN.test(parameter)
      ) {
        throw new Error(
          `${path}.${parameter} must be progress or match ${SHADER_PARAMETER_PATTERN.source}.`,
        );
      }

      const normalized = normalizeKeyframes(
        config,
        `${path}.${parameter}`,
        parameter === "progress"
          ? assertShaderProgressValue
          : assertShaderTweenValue,
        undefined,
        keyframeOptions,
      );
      return normalized === NO_TRACKS
        ? []
        : [[parameter === "progress" ? "uProgress" : parameter, normalized]];
    }),
  );
};

const normalizeUpdatePropertyConfig = (propertyConfig, path, options = {}) => {
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

  return normalizeKeyframes(
    propertyConfig,
    path,
    undefined,
    undefined,
    options,
  );
};

const normalizeColorValue = (value, path) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty color string.`);
  }

  try {
    return new Color(value).toArray();
  } catch {
    throw new Error(`${path} must be a valid color.`);
  }
};

const normalizeColorPropertyConfig = (propertyConfig, path, options = {}) => {
  assertPlainObject(propertyConfig, path);

  if (propertyConfig.auto !== undefined) {
    return normalizeUpdatePropertyConfig(propertyConfig, path, options);
  }

  for (const [index, keyframe] of (propertyConfig.keyframes ?? []).entries()) {
    if (keyframe?.relative === true) {
      throw new Error(
        `${path}.keyframes[${index}].relative is not supported for colors.`,
      );
    }
  }

  return normalizeKeyframes(
    propertyConfig,
    path,
    (value, valuePath) => {
      normalizeColorValue(value, valuePath);
    },
    normalizeColorValue,
    options,
  );
};

const normalizeRectPointTween = (point, path, prefix) => {
  assertPlainObject(point, path);
  assertKnownFields(point, new Set(["x", "y"]), path);
  // An empty point map (or one whose axes all prune) authors no tracks.
  return Object.fromEntries(
    Object.entries(point).flatMap(([axis, config]) => {
      const normalized = normalizeUpdatePropertyConfig(
        config,
        `${path}.${axis}`,
        EMPTY_MANUAL_TRACKS,
      );
      return normalized === NO_TRACKS
        ? []
        : [[`${prefix}.${axis}`, normalized]];
    }),
  );
};

const normalizeRectFillStopsTween = (stops, path) => {
  if (!Array.isArray(stops)) {
    throw new Error(`${path} must be a non-empty array.`);
  }

  // An empty stops array authors no tracks; every remaining stop still
  // validates its index and channels in full before its tracks can prune.
  const indices = new Set();
  return Object.assign(
    {},
    ...stops.map((stop, itemIndex) => {
      const itemPath = `${path}[${itemIndex}]`;
      assertPlainObject(stop, itemPath);
      assertKnownFields(stop, new Set(["index", "offset", "color"]), itemPath);
      if (!Number.isInteger(stop.index) || stop.index < 0) {
        throw new Error(`${itemPath}.index must be a non-negative integer.`);
      }
      if (indices.has(stop.index)) {
        throw new Error(`${path} cannot target stop ${stop.index} twice.`);
      }
      indices.add(stop.index);
      if (stop.offset === undefined && stop.color === undefined) {
        throw new Error(`${itemPath} must define offset or color.`);
      }

      const stopTracks = {};
      if (stop.offset !== undefined) {
        const offset = normalizeUpdatePropertyConfig(
          stop.offset,
          `${itemPath}.offset`,
          EMPTY_MANUAL_TRACKS,
        );
        if (offset !== NO_TRACKS) {
          stopTracks[`rect.fill.stops.${stop.index}.offset`] = offset;
        }
      }
      if (stop.color !== undefined) {
        const color = normalizeColorPropertyConfig(
          stop.color,
          `${itemPath}.color`,
          EMPTY_MANUAL_TRACKS,
        );
        if (color !== NO_TRACKS) {
          stopTracks[`rect.fill.stops.${stop.index}.color`] = color;
        }
      }
      return stopTracks;
    }),
  );
};

const normalizeRectFillTween = (fill, path) => {
  assertPlainObject(fill, path);
  assertKnownFields(
    fill,
    new Set([
      "color",
      "start",
      "end",
      "innerCenter",
      "innerRadius",
      "outerCenter",
      "outerRadius",
      "stops",
      "scale",
      "rotation",
    ]),
    path,
  );

  // An empty fill map (or one whose properties all prune) authors no tracks.
  const normalized = {};

  if (fill.color !== undefined) {
    const color = normalizeColorPropertyConfig(
      fill.color,
      `${path}.color`,
      EMPTY_MANUAL_TRACKS,
    );
    if (color !== NO_TRACKS) {
      normalized["rect.fill.color"] = color;
    }
  }

  for (const [point, prefix] of [
    ["start", "rect.fill.start"],
    ["end", "rect.fill.end"],
    ["innerCenter", "rect.fill.innerCenter"],
    ["outerCenter", "rect.fill.outerCenter"],
  ]) {
    if (fill[point] !== undefined) {
      Object.assign(
        normalized,
        normalizeRectPointTween(fill[point], `${path}.${point}`, prefix),
      );
    }
  }

  for (const property of ["innerRadius", "outerRadius", "scale", "rotation"]) {
    if (fill[property] === undefined) {
      continue;
    }
    const tracks = normalizeUpdatePropertyConfig(
      fill[property],
      `${path}.${property}`,
      EMPTY_MANUAL_TRACKS,
    );
    if (tracks !== NO_TRACKS) {
      normalized[`rect.fill.${property}`] = tracks;
    }
  }

  if (fill.stops !== undefined) {
    Object.assign(
      normalized,
      normalizeRectFillStopsTween(fill.stops, `${path}.stops`),
    );
  }

  return normalized;
};

const normalizeRectBorderTween = (border, path) => {
  assertPlainObject(border, path);
  assertKnownFields(border, new Set(["width", "color", "alpha"]), path);
  // An empty border map (or one whose properties all prune) authors no tracks.
  return Object.fromEntries(
    Object.entries(border).flatMap(([property, config]) => {
      const normalized =
        property === "color"
          ? normalizeColorPropertyConfig(
              config,
              `${path}.${property}`,
              EMPTY_MANUAL_TRACKS,
            )
          : normalizeUpdatePropertyConfig(
              config,
              `${path}.${property}`,
              EMPTY_MANUAL_TRACKS,
            );
      return normalized === NO_TRACKS
        ? []
        : [[`rect.border.${property}`, normalized]];
    }),
  );
};

const normalizeRectCornerRadiusTween = (cornerRadius, path) => {
  assertPlainObject(cornerRadius, path);
  const isUniformTimeline =
    cornerRadius.keyframes !== undefined || cornerRadius.auto !== undefined;
  const cornerNames = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

  if (isUniformTimeline) {
    assertKnownFields(
      cornerRadius,
      new Set(["initialValue", "keyframes", "auto"]),
      path,
    );
    const normalized = normalizeUpdatePropertyConfig(
      cornerRadius,
      path,
      EMPTY_MANUAL_TRACKS,
    );
    if (normalized === NO_TRACKS) {
      return {};
    }
    return Object.fromEntries(
      cornerNames.map((corner) => [`rect.cornerRadius.${corner}`, normalized]),
    );
  }

  assertKnownFields(cornerRadius, new Set(cornerNames), path);
  // An empty per-corner map (or one whose corners all prune) authors no tracks.
  return Object.fromEntries(
    Object.entries(cornerRadius).flatMap(([corner, config]) => {
      const normalized = normalizeUpdatePropertyConfig(
        config,
        `${path}.${corner}`,
        EMPTY_MANUAL_TRACKS,
      );
      return normalized === NO_TRACKS
        ? []
        : [[`rect.cornerRadius.${corner}`, normalized]];
    }),
  );
};

const normalizeRectStyleTween = (rectTween, path) => {
  const normalized = {};
  for (const property of ["width", "height"]) {
    if (rectTween[property] === undefined) {
      continue;
    }
    const tracks = normalizeUpdatePropertyConfig(
      rectTween[property],
      `${path}.${property}`,
      EMPTY_MANUAL_TRACKS,
    );
    if (tracks !== NO_TRACKS) {
      normalized[`rect.${property}`] = tracks;
    }
  }
  if (rectTween.fill !== undefined) {
    Object.assign(
      normalized,
      normalizeRectFillTween(rectTween.fill, `${path}.fill`),
    );
  }
  if (rectTween.border !== undefined) {
    Object.assign(
      normalized,
      normalizeRectBorderTween(rectTween.border, `${path}.border`),
    );
  }
  if (rectTween.cornerRadius !== undefined) {
    Object.assign(
      normalized,
      normalizeRectCornerRadiusTween(
        rectTween.cornerRadius,
        `${path}.cornerRadius`,
      ),
    );
  }
  return normalized;
};

// Replace-side (transition surface) tracks share the empty-manual-track
// policy; this adapter lets normalizeTweenMap hand track options to either
// property normalizer uniformly.
const normalizeSurfacePropertyConfig = (propertyConfig, path, options) =>
  normalizeKeyframes(propertyConfig, path, undefined, undefined, options);

const normalizeTweenMap = (
  tween,
  path,
  allowedProperties,
  propertyNormalizer = normalizeSurfacePropertyConfig,
  options = EMPTY_MANUAL_TRACKS,
) => {
  assertPlainObject(tween, path);

  // Alias conflicts are authored-shape errors, so they are rejected before any
  // empty track prunes: defining x alongside translateX (or y alongside
  // translateY) stays invalid even when one of the two timelines is empty.
  if (tween.x !== undefined && tween.translateX !== undefined) {
    throw new Error(`${path} cannot define both x and translateX.`);
  }
  if (tween.y !== undefined && tween.translateY !== undefined) {
    throw new Error(`${path} cannot define both y and translateY.`);
  }

  return Object.fromEntries(
    Object.entries(tween).flatMap(([property, config]) => {
      if (!allowedProperties.has(property)) {
        throw new Error(
          `${path}.${property} is not a supported animation property.`,
        );
      }

      const normalizedProperty = propertyNormalizer(
        config,
        `${path}.${property}`,
        options,
      );
      return normalizedProperty === NO_TRACKS
        ? []
        : [[property, normalizedProperty]];
    }),
  );
};

const normalizeFilterTweens = (filters, path) => {
  assertPlainObject(filters, path);

  // An empty filter map (or one whose filters all prune) authors no tracks;
  // filter ids still validate before any pruning.
  return Object.fromEntries(
    Object.entries(filters).flatMap(([filterId, tween]) => {
      assertString(filterId, `${path} filter id`);
      const tweenTracks = normalizeShaderTweenMap(
        tween,
        `${path}.${filterId}`,
        { allowEmptyMap: true, allowEmptyKeyframes: true },
      );
      return Object.keys(tweenTracks).length === 0
        ? []
        : [[filterId, tweenTracks]];
    }),
  );
};

const normalizeUpdateTween = (tween, path) => {
  assertPlainObject(tween, path);

  const { filters, ...nonFilterTween } = tween;
  const rectTween = Object.fromEntries(
    Object.entries(nonFilterTween).filter(([property]) =>
      RECT_STYLE_TWEEN_FIELDS.has(property),
    ),
  );
  const elementTween = Object.fromEntries(
    Object.entries(nonFilterTween).filter(
      ([property]) => !RECT_STYLE_TWEEN_FIELDS.has(property),
    ),
  );
  const tracks = {};

  if (Object.keys(elementTween).length > 0) {
    Object.assign(
      tracks,
      normalizeTweenMap(
        elementTween,
        path,
        UPDATE_TWEEN_PROPERTIES,
        normalizeUpdatePropertyConfig,
        EMPTY_MANUAL_TRACKS,
      ),
    );
  }
  if (Object.keys(rectTween).length > 0) {
    Object.assign(tracks, normalizeRectStyleTween(rectTween, path));
  }

  const normalized = {};

  // Never emit an empty tween map: an update whose tracks all prune carries no
  // active content and the whole animation drops.
  if (Object.keys(tracks).length > 0) {
    normalized.tween = tracks;
  }

  if (filters !== undefined) {
    const filterTweens = normalizeFilterTweens(filters, `${path}.filters`);
    if (Object.keys(filterTweens).length > 0) {
      normalized.filterTweens = filterTweens;
    }
  }

  return normalized;
};

const normalizeSequenceFrame = (frame, path) => {
  assertPlainObject(frame, path);
  assertString(frame.texture, `${path}.texture`);
  assertNumber(frame.at, `${path}.at`);

  if (frame.at < 0 || frame.at > 1) {
    throw new Error(`${path}.at must be between 0 and 1.`);
  }

  return {
    at: frame.at,
    texture: frame.texture,
  };
};

const normalizeSequenceFrames = (frames, path) => {
  if (!Array.isArray(frames) || frames.length < 2) {
    throw new Error(`${path} must be an array with at least two frames.`);
  }

  const normalized = frames.map((frame, index) =>
    normalizeSequenceFrame(frame, `${path}[${index}]`),
  );

  if (normalized[0].at !== 0) {
    throw new Error(`${path}[0].at must be 0.`);
  }

  const lastIndex = normalized.length - 1;
  if (normalized[lastIndex].at !== 1) {
    throw new Error(`${path}[${lastIndex}].at must be 1.`);
  }

  for (let index = 1; index < normalized.length; index++) {
    if (normalized[index].at <= normalized[index - 1].at) {
      throw new Error(`${path} must be sorted by ascending unique at values.`);
    }
  }

  return normalized;
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

  if (mask.delay !== undefined) {
    assertNonNegativeSafeIntegerMilliseconds(mask.delay, `${path}.delay`);
    if (mask.delay > 0) {
      normalized.delay = mask.delay;
    }
  }

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
    if (mask.frames !== undefined) {
      throw new Error(`${path}.frames is only valid for sequence masks.`);
    }
    if (mask.sample !== undefined) {
      throw new Error(`${path}.sample is only valid for sequence masks.`);
    }
    if (mask.items !== undefined) {
      throw new Error(`${path}.items is not supported.`);
    }
    if (mask.combine !== undefined) {
      throw new Error(`${path}.combine is not supported.`);
    }
    assertString(mask.texture, `${path}.texture`);
    normalized.texture = mask.texture;
  }

  if (mask.kind === "sequence") {
    if (mask.texture !== undefined) {
      throw new Error(
        `${path}.texture is not valid for sequence masks. Use ${path}.frames[].texture instead.`,
      );
    }
    if (mask.items !== undefined) {
      throw new Error(`${path}.items is not supported.`);
    }
    if (mask.combine !== undefined) {
      throw new Error(`${path}.combine is not supported.`);
    }
    if (mask.textures !== undefined) {
      throw new Error(
        `${path}.textures is no longer supported. Use ${path}.frames with texture and at entries instead.`,
      );
    }
    if (mask.softness !== undefined) {
      throw new Error(
        `${path}.softness is not valid for sequence masks. Author feathering into ${path}.frames[].texture instead.`,
      );
    }

    normalized.frames = normalizeSequenceFrames(mask.frames, `${path}.frames`);

    if (mask.sample !== undefined) {
      assertString(mask.sample, `${path}.sample`);
      if (!MASK_SEQUENCE_SAMPLE_MODES.has(mask.sample)) {
        throw new Error(
          `${path}.sample must be one of: ${Array.from(MASK_SEQUENCE_SAMPLE_MODES).join(", ")}.`,
        );
      }
    }

    normalized.sample = mask.sample ?? "hold";
  }

  if (!normalized.progress) {
    normalized.progress = {
      initialValue: 0,
      keyframes: [{ duration: 0, value: 1, easing: "linear" }],
    };
  }

  return normalized;
};

const normalizeMasks = (maskOrMasks, path) => {
  const usesArrayShape = Array.isArray(maskOrMasks);
  if (usesArrayShape && maskOrMasks.length === 0) {
    throw new Error(`${path} must be a non-empty array.`);
  }

  const masks = usesArrayShape ? maskOrMasks : [maskOrMasks];
  return masks.map((mask, index) =>
    normalizeMask(mask, usesArrayShape ? `${path}[${index}]` : path),
  );
};

const normalizeReplaceSide = (side, path) => {
  assertPlainObject(side, path);

  if (side.mask !== undefined) {
    throw new Error(`${path}.mask is not valid. Define mask on ${path}.`);
  }
  if (side.tween === undefined && Object.keys(side).length > 0) {
    throw new Error(`${path} must define tween.`);
  }

  const normalized = {};

  if (side.tween !== undefined) {
    normalized.tween = normalizeTweenMap(
      side.tween,
      `${path}.tween`,
      TRANSITION_TWEEN_PROPERTIES,
    );
  }

  if (!normalized.tween || Object.keys(normalized.tween).length === 0) {
    assertKnownFields(side, new Set(["tween"]), path);
  }

  return normalized;
};

const normalizeReplacePayload = (animation, path) => {
  if (
    animation.prev === undefined &&
    animation.next === undefined &&
    animation.mask === undefined &&
    animation.compositor === undefined
  ) {
    throw new Error(`${path} must define prev, next, mask, or compositor.`);
  }

  const normalized = {};

  if (animation.prev !== undefined) {
    const prev = normalizeReplaceSide(animation.prev, `${path}.prev`);
    if (prev.tween && Object.keys(prev.tween).length > 0) {
      normalized.prev = prev;
    }
  }

  if (animation.next !== undefined) {
    const next = normalizeReplaceSide(animation.next, `${path}.next`);
    if (next.tween && Object.keys(next.tween).length > 0) {
      normalized.next = next;
    }
  }

  if (animation.mask !== undefined) {
    normalized.mask = normalizeMasks(animation.mask, `${path}.mask`);
  }

  if (animation.compositor !== undefined) {
    normalized.compositor = normalizeShaderCompositor(
      animation.compositor,
      `${path}.compositor`,
    );
    if (animation.compositor.tween === undefined) {
      throw new Error(
        `${path}.compositor.tween.progress is required when compositor is defined.`,
      );
    }
    // Compositor tweens keep their own contract: the parameter map stays
    // non-empty and progress keyframes stay required, so no empty-track
    // options are passed here.
    normalized.compositor.tween = normalizeShaderTweenMap(
      animation.compositor.tween,
      `${path}.compositor.tween`,
    );
    if (normalized.compositor.tween.uProgress === undefined) {
      throw new Error(
        `${path}.compositor.tween.progress is required when compositor is defined.`,
      );
    }
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

  const normalizedEntries = animations.map((animation, index) => {
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

    const loopsForever = normalizedAnimation.playback?.loop === true;
    const repeatsForever = normalizedAnimation.playback?.repeat === "infinite";
    if (loopsForever || repeatsForever) {
      if (animation.type !== "update") {
        if (loopsForever) {
          throw new Error(
            `${path}.playback.loop is only supported for type "update".`,
          );
        }
        throw new Error(
          `${path}.playback infinite repetition is only supported for type "update".`,
        );
      }
      if (normalizedAnimation.complete !== undefined) {
        if (loopsForever) {
          throw new Error(
            `${path}.complete is not allowed when playback.loop is true because a loop never completes.`,
          );
        }
        throw new Error(
          `${path}.complete is not allowed when playback repeats infinitely because it never completes.`,
        );
      }
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
    assertLegacyFieldAbsent(
      animation.shader,
      `${path}.shader`,
      "is no longer supported. Use `tween.filters.<filterId>` for element filters or `compositor.tween` for a transition compositor.",
    );

    if (animation.type === "update") {
      if (animation.tween !== undefined && animation.gsap !== undefined) {
        throw new Error(`${path} cannot define both tween and gsap.`);
      }
      if (animation.tween === undefined && animation.gsap === undefined) {
        throw new Error(
          `${path} must define exactly one of tween or gsap for an update animation.`,
        );
      }

      if (animation.tween !== undefined) {
        Object.assign(
          normalizedAnimation,
          normalizeUpdateTween(animation.tween, `${path}.tween`),
        );
      }

      if (animation.gsap !== undefined) {
        normalizedAnimation.gsap = normalizePortableGsap(
          animation.gsap,
          `${path}.gsap`,
          "update",
        );
      }

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

      if (animation.compositor !== undefined) {
        throw new Error(
          `${path}.compositor is only valid for transition animations.`,
        );
      }

      return normalizedAnimation.tween === undefined &&
        normalizedAnimation.filterTweens === undefined &&
        normalizedAnimation.gsap === undefined
        ? null
        : normalizedAnimation;
    }

    if (animation.tween !== undefined) {
      throw new Error(`${path}.tween is not valid for transition animations.`);
    }

    if (animation.gsap !== undefined) {
      if (animation.prev !== undefined || animation.next !== undefined) {
        throw new Error(
          `${path} orchestrated gsap transitions cannot define prev.tween or next.tween.`,
        );
      }
      normalizedAnimation.gsap = normalizePortableGsap(
        animation.gsap,
        `${path}.gsap`,
        "transition",
      );

      if (animation.mask !== undefined) {
        const usesArrayShape = Array.isArray(animation.mask);
        const authoredMasks = usesArrayShape
          ? animation.mask
          : [animation.mask];
        normalizedAnimation.mask = normalizeMasks(
          animation.mask,
          `${path}.mask`,
        ).map((mask, index) => {
          const maskPath = usesArrayShape
            ? `${path}.mask[${index}]`
            : `${path}.mask`;
          if (mask.delay > 0) {
            throw new Error(
              `${maskPath}.delay cannot be mixed with top-level gsap. Delay the transitionMask action instead.`,
            );
          }
          if (authoredMasks[index].progress !== undefined) {
            throw new Error(
              `${maskPath}.progress cannot be mixed with top-level gsap. Animate the transitionMask target instead.`,
            );
          }
          const resource = { ...mask };
          delete resource.progress;
          return resource;
        });
      }

      if (animation.compositor !== undefined) {
        if (animation.compositor.tween !== undefined) {
          throw new Error(
            `${path}.compositor.tween cannot be mixed with top-level gsap. Animate the transitionCompositor target instead.`,
          );
        }
        normalizedAnimation.compositor = normalizeShaderCompositor(
          animation.compositor,
          `${path}.compositor`,
        );
      }

      return normalizedAnimation;
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
    if (normalizedReplace.compositor !== undefined) {
      normalizedAnimation.compositor = normalizedReplace.compositor;
    }

    return Object.keys(normalizedReplace).length === 0
      ? null
      : normalizedAnimation;
  });

  const normalized = normalizedEntries.filter(
    (animation) => animation !== null,
  );

  const animationIds = new Map();
  const transitionTargets = new Map();

  for (const [index, animation] of normalizedEntries.entries()) {
    if (animation === null) continue;
    const priorIdIndex = animationIds.get(animation.id);
    if (priorIdIndex !== undefined) {
      throw new Error(
        `animations[${index}].id duplicates animations[${priorIdIndex}].id "${animation.id}". Animation ids must be unique within one state.`,
      );
    }
    animationIds.set(animation.id, index);

    if (animation.type !== "transition") {
      continue;
    }

    const priorTransitionIndex = transitionTargets.get(animation.targetId);
    if (priorTransitionIndex !== undefined) {
      throw new Error(
        `animations[${index}] defines a second transition for target "${animation.targetId}"; animations[${priorTransitionIndex}] already owns that transition target.`,
      );
    }
    transitionTargets.set(animation.targetId, index);
  }

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

  const shaderAnimationChannels = new Set();

  for (const animation of normalized) {
    if (animation.type !== "update") {
      continue;
    }

    for (const [filterId, tween] of Object.entries(
      animation.filterTweens ?? {},
    )) {
      for (const parameter of Object.keys(tween)) {
        const channel = JSON.stringify([
          animation.targetId,
          filterId,
          parameter,
        ]);
        if (shaderAnimationChannels.has(channel)) {
          const authoredParameter =
            parameter === "uProgress" ? "progress" : parameter;
          throw new Error(
            `Animations targeting shader filter "${filterId}" on "${animation.targetId}" cannot both animate parameter "${authoredParameter}".`,
          );
        }
        shaderAnimationChannels.add(channel);
      }
    }
  }

  return normalized;
};

export default normalizeAnimations;
