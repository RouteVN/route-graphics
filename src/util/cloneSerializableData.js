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

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

export default cloneSerializableData;
