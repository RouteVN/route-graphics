const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Deep equality for plain JSON-like values.
 * @param {unknown} valueA
 * @param {unknown} valueB
 * @returns {boolean}
 */
export const isDeepEqual = (valueA, valueB) => {
  if (Object.is(valueA, valueB)) return true;

  if (
    valueA === null ||
    valueB === null ||
    typeof valueA !== "object" ||
    typeof valueB !== "object"
  ) {
    return false;
  }

  const isArrayA = Array.isArray(valueA);
  const isArrayB = Array.isArray(valueB);

  if (isArrayA !== isArrayB) return false;

  if (isArrayA && isArrayB) {
    if (valueA.length !== valueB.length) return false;
    for (let index = 0; index < valueA.length; index++) {
      if (!isDeepEqual(valueA[index], valueB[index])) return false;
    }
    return true;
  }

  const keysA = Object.keys(valueA);
  const keysB = Object.keys(valueB);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!hasOwn.call(valueB, key)) return false;
    if (!isDeepEqual(valueA[key], valueB[key])) return false;
  }

  return true;
};

export default isDeepEqual;
