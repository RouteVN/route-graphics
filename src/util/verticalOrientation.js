import { VERTICAL_ORIENTATION_RANGES } from "./verticalOrientationData.js";

export const VERTICAL_ORIENTATION = Object.freeze({
  ROTATED: "R",
  UPRIGHT: "U",
  TRANSFORMED_UPRIGHT: "Tu",
  TRANSFORMED_ROTATED: "Tr",
});

const VALUES = [
  VERTICAL_ORIENTATION.ROTATED,
  VERTICAL_ORIENTATION.UPRIGHT,
  VERTICAL_ORIENTATION.TRANSFORMED_UPRIGHT,
  VERTICAL_ORIENTATION.TRANSFORMED_ROTATED,
];

const RANGE_COUNT = VERTICAL_ORIENTATION_RANGES.length / 3;

/**
 * Unicode Vertical_Orientation property (UAX #50) of a code point.
 * @param {number} codePoint
 * @returns {"R" | "U" | "Tu" | "Tr"}
 */
export const getVerticalOrientation = (codePoint) => {
  let low = 0;
  let high = RANGE_COUNT - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const start = VERTICAL_ORIENTATION_RANGES[middle * 3];
    const end = VERTICAL_ORIENTATION_RANGES[middle * 3 + 1];

    if (codePoint < start) {
      high = middle - 1;
    } else if (codePoint > end) {
      low = middle + 1;
    } else {
      return VALUES[VERTICAL_ORIENTATION_RANGES[middle * 3 + 2]];
    }
  }

  return VERTICAL_ORIENTATION.ROTATED;
};
