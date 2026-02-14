/**
 * Clone JSON-like, serializable data.
 * This is used at ownership boundaries to avoid shared references.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export const cloneSerializableData = (value) => {
  if (value === undefined) return value;

  if (typeof structuredClone !== "function") {
    throw new Error("structuredClone is required to clone serializable data.");
  }

  return structuredClone(value);
};

export default cloneSerializableData;
