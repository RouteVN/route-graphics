export const DEFAULT_SOFT_WIPE_CONFIG = {
  direction: "leftToRight",
  softness: 1.25,
  easing: "linear",
  lineOverlap: 0,
  lineDelay: 0,
};

export const LEGACY_SOFT_WIPE_MIN_EDGE = 18;
export const LEGACY_SOFT_WIPE_MAX_EDGE = 64;

const SOFT_WIPE_DIRECTIONS = new Set(["leftToRight", "rightToLeft"]);

export const SOFT_WIPE_EASINGS = {
  linear: (progress) => progress,
  easeOutCubic: (progress) => 1 - (1 - progress) ** 3,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const finiteNumberOr = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const normalizeSoftWipeConfig = (config = {}) => {
  const input = config && typeof config === "object" ? config : {};

  return {
    direction: SOFT_WIPE_DIRECTIONS.has(input.direction)
      ? input.direction
      : DEFAULT_SOFT_WIPE_CONFIG.direction,
    softness: Math.max(
      0,
      finiteNumberOr(input.softness, DEFAULT_SOFT_WIPE_CONFIG.softness),
    ),
    easing: Object.prototype.hasOwnProperty.call(
      SOFT_WIPE_EASINGS,
      input.easing,
    )
      ? input.easing
      : DEFAULT_SOFT_WIPE_CONFIG.easing,
    lineOverlap: clamp(
      finiteNumberOr(input.lineOverlap, DEFAULT_SOFT_WIPE_CONFIG.lineOverlap),
      0,
      0.95,
    ),
    lineDelay: Math.max(
      0,
      finiteNumberOr(input.lineDelay, DEFAULT_SOFT_WIPE_CONFIG.lineDelay),
    ),
  };
};

export const getSoftWipeEasing = (name) =>
  SOFT_WIPE_EASINGS[name] ?? SOFT_WIPE_EASINGS[DEFAULT_SOFT_WIPE_CONFIG.easing];

export const getSoftWipeEdgeWidth = ({ maxLineHeight, softWipe }) =>
  Math.max(
    LEGACY_SOFT_WIPE_MIN_EDGE,
    Math.min(
      LEGACY_SOFT_WIPE_MAX_EDGE,
      Math.round(maxLineHeight * softWipe.softness),
    ),
  );
