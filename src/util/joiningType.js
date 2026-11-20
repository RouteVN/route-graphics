import { JOINING_TYPE_RANGES } from "./joiningTypeData.js";

const VALUES = [null, "R", "L", "D", "C"];
const RANGE_COUNT = JOINING_TYPE_RANGES.length / 3;
const ZERO_WIDTH_NON_JOINER = 0x200c;
const TRANSPARENT_PATTERN = /[\p{Mn}\p{Me}\p{Cf}]/u;

/**
 * Unicode Joining_Type of a code point: how a letter of a cursive script
 * connects to its neighbours. `R` joins the letter before it, `L` the letter
 * after it, `D` both, `C` causes joining without being a letter (tatweel,
 * zero width joiner), `T` is skipped over (marks), `U` does not join.
 * @param {number} codePoint
 * @returns {"R" | "L" | "D" | "C" | "T" | "U"}
 */
export const getJoiningType = (codePoint) => {
  let low = 0;
  let high = RANGE_COUNT - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;

    if (codePoint < JOINING_TYPE_RANGES[middle * 3]) {
      high = middle - 1;
    } else if (codePoint > JOINING_TYPE_RANGES[middle * 3 + 1]) {
      low = middle + 1;
    } else {
      return VALUES[JOINING_TYPE_RANGES[middle * 3 + 2]];
    }
  }

  if (codePoint === ZERO_WIDTH_NON_JOINER) return "U";

  return TRANSPARENT_PATTERN.test(String.fromCodePoint(codePoint)) ? "T" : "U";
};

/**
 * Whether the last letter of `before` connects to the first letter of
 * `after` when the two strings are shaped as one, in logical order.
 * @param {string} before
 * @param {string} after
 * @returns {boolean}
 */
export const joinsAcross = (before, after) => {
  let left = "U";

  for (let index = before.length - 1; index >= 0; index--) {
    // Step back over a whole surrogate pair.
    if (index > 0 && /[\uDC00-\uDFFF]/.test(before[index])) index -= 1;

    left = getJoiningType(before.codePointAt(index));
    if (left !== "T") break;
  }

  if (left !== "D" && left !== "L" && left !== "C") return false;

  for (const character of after) {
    const right = getJoiningType(character.codePointAt(0));

    if (right !== "T") return right === "D" || right === "R" || right === "C";
  }

  return false;
};
