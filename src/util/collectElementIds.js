/**
 * Recursively collect all element IDs from an element tree
 * @param {Object} element - Element to collect IDs from
 * @returns {Set<string>} Set of all element IDs including children
 */
export const collectAllElementIds = (element) => {
  const ids = new Set();
  if (element.id) {
    ids.add(element.id);
  }
  if (element.children && Array.isArray(element.children)) {
    for (const child of element.children) {
      for (const id of collectAllElementIds(child)) {
        ids.add(id);
      }
    }
  }
  return ids;
};
