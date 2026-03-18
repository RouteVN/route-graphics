import { FillGradient } from "pixi.js";

const TRANSPARENT_FILL = { color: 0x000000, alpha: 0 };

const isTransparentFillValue = (fill) =>
  fill === undefined || fill === null || fill === "" || fill === "transparent";

const sortStops = (stops) =>
  [...stops].sort((left, right) => left.offset - right.offset);

/**
 * @param {import("pixi.js").Graphics & {_rtglFillResource?: FillGradient}} rect
 */
export const destroyRectFillResource = (rect) => {
  rect._rtglFillResource?.destroy();
  delete rect._rtglFillResource;
};

/**
 * @param {import("../../../types.js").RectFill | undefined} fill
 * @returns {import("pixi.js").FillInput}
 */
export const normalizeRectFill = (fill) => {
  if (isTransparentFillValue(fill)) {
    return TRANSPARENT_FILL;
  }

  if (typeof fill === "string") {
    return fill;
  }

  if (fill.type === "solid") {
    return isTransparentFillValue(fill.color) ? TRANSPARENT_FILL : fill.color;
  }

  if (fill.type === "linear-gradient") {
    return new FillGradient({
      type: "linear",
      start: fill.start,
      end: fill.end,
      colorStops: sortStops(fill.stops),
      textureSpace: fill.coordinateSpace,
      textureSize: fill.textureSize,
      wrapMode: fill.wrapMode,
    });
  }

  if (fill.type === "radial-gradient") {
    return new FillGradient({
      type: "radial",
      center: fill.innerCenter,
      innerRadius: fill.innerRadius,
      outerCenter: fill.outerCenter,
      outerRadius: fill.outerRadius,
      colorStops: sortStops(fill.stops),
      textureSpace: fill.coordinateSpace,
      textureSize: fill.textureSize,
      wrapMode: fill.wrapMode,
      scale: fill.scale,
      rotation: fill.rotation,
    });
  }

  return fill;
};

/**
 * @param {import("pixi.js").Graphics & {_rtglFillResource?: FillGradient}} rect
 * @param {import("../../../types.js").RectFill | undefined} fill
 * @returns {import("pixi.js").FillInput}
 */
export const resolveRectFill = (rect, fill) => {
  destroyRectFillResource(rect);

  const normalizedFill = normalizeRectFill(fill);

  if (normalizedFill instanceof FillGradient) {
    rect._rtglFillResource = normalizedFill;
  }

  return normalizedFill;
};
