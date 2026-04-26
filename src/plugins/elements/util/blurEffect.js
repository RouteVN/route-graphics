import { BlurFilter } from "pixi.js";
import { setManagedFilter } from "./managedFilters.js";

const BLUR_STATE_KEY = "_routeGraphicsBlur";
const BLUR_FILTER_KEY = "_routeGraphicsBlurFilter";
const BLUR_OPTIONS_KEY = "_routeGraphicsBlurOptions";

const VALID_KERNEL_SIZES = new Set([5, 7, 9, 11, 13, 15]);

export const DEFAULT_BLUR_OPTIONS = {
  quality: 4,
  kernelSize: 5,
  repeatEdgePixels: false,
};

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const assertNonNegativeNumber = (value, path) => {
  if (!isFiniteNumber(value) || value < 0) {
    throw new Error(`Input Error: ${path} must be a finite number >= 0`);
  }
};

export const normalizeBlurConfig = (blur, path = "blur") => {
  if (blur === undefined) return undefined;

  if (!blur || typeof blur !== "object" || Array.isArray(blur)) {
    throw new Error(`Input Error: ${path} must be an object`);
  }

  if (blur.x === undefined || blur.y === undefined) {
    throw new Error(`Input Error: ${path}.x and ${path}.y are required`);
  }

  assertNonNegativeNumber(blur.x, `${path}.x`);
  assertNonNegativeNumber(blur.y, `${path}.y`);

  const quality = blur.quality ?? DEFAULT_BLUR_OPTIONS.quality;
  if (!isFiniteNumber(quality) || quality < 1) {
    throw new Error(
      `Input Error: ${path}.quality must be a finite number >= 1`,
    );
  }

  const kernelSize = blur.kernelSize ?? DEFAULT_BLUR_OPTIONS.kernelSize;
  if (!VALID_KERNEL_SIZES.has(kernelSize)) {
    throw new Error(
      `Input Error: ${path}.kernelSize must be one of 5, 7, 9, 11, 13, 15`,
    );
  }

  const repeatEdgePixels =
    blur.repeatEdgePixels ?? DEFAULT_BLUR_OPTIONS.repeatEdgePixels;
  if (typeof repeatEdgePixels !== "boolean") {
    throw new Error(`Input Error: ${path}.repeatEdgePixels must be a boolean`);
  }

  return {
    x: blur.x,
    y: blur.y,
    quality,
    kernelSize,
    repeatEdgePixels,
  };
};

const getAnimationsForTarget = (animations, targetId) => {
  if (!animations) return [];
  if (animations instanceof Map) {
    return animations.get(targetId) ?? [];
  }
  return animations.filter((animation) => animation?.targetId === targetId);
};

export const hasBlurUpdateAnimation = (animations, targetId) =>
  getAnimationsForTarget(animations, targetId).some(
    (animation) =>
      animation?.type === "update" &&
      (animation.tween?.blurX || animation.tween?.blurY),
  );

const createBlurState = (filter) => ({
  get x() {
    return filter.strengthX;
  },
  set x(value) {
    filter.strengthX = Math.max(0, value);
  },
  get y() {
    return filter.strengthY;
  },
  set y(value) {
    filter.strengthY = Math.max(0, value);
  },
});

const shouldReuseBlurFilter = (displayObject, blur) => {
  const previousOptions = displayObject[BLUR_OPTIONS_KEY];

  return (
    displayObject[BLUR_FILTER_KEY] &&
    previousOptions?.quality === blur.quality &&
    previousOptions?.kernelSize === blur.kernelSize &&
    previousOptions?.repeatEdgePixels === blur.repeatEdgePixels
  );
};

const clearBlurEffect = (displayObject) => {
  setManagedFilter(displayObject, "blur", null);
  delete displayObject[BLUR_STATE_KEY];
  delete displayObject[BLUR_FILTER_KEY];
  delete displayObject[BLUR_OPTIONS_KEY];
};

export const syncBlurEffect = (displayObject, blur, { force = false } = {}) => {
  if (!blur && !force) {
    clearBlurEffect(displayObject);
    return;
  }

  const normalizedBlur = blur ?? {
    x: 0,
    y: 0,
    ...DEFAULT_BLUR_OPTIONS,
  };

  const filter = shouldReuseBlurFilter(displayObject, normalizedBlur)
    ? displayObject[BLUR_FILTER_KEY]
    : new BlurFilter({
        strengthX: normalizedBlur.x,
        strengthY: normalizedBlur.y,
        quality: normalizedBlur.quality,
        kernelSize: normalizedBlur.kernelSize,
      });

  filter.repeatEdgePixels = normalizedBlur.repeatEdgePixels;
  filter.strengthX = normalizedBlur.x;
  filter.strengthY = normalizedBlur.y;

  displayObject[BLUR_FILTER_KEY] = filter;
  displayObject[BLUR_OPTIONS_KEY] = {
    quality: normalizedBlur.quality,
    kernelSize: normalizedBlur.kernelSize,
    repeatEdgePixels: normalizedBlur.repeatEdgePixels,
  };
  displayObject[BLUR_STATE_KEY] = createBlurState(filter);

  setManagedFilter(displayObject, "blur", filter);
};

export const getBlurTargetState = (element, { force = false } = {}) => {
  if (!element?.blur && !force) return {};

  return {
    blurX: element?.blur?.x ?? 0,
    blurY: element?.blur?.y ?? 0,
  };
};
