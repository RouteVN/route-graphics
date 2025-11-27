/**
 * @typedef {import("../types.js").ASTNode} ASTNode
 * @typedef {import("../types.js").DiffElementResult} DiffElementResult
 * @typedef {import("../types.js").HoverProps} HoverPops
 * @typedef {import("../types.js").ClickProps} ClickProps
 * @typedef {import("../types.js").Application} App
 */

/**
 *
 * @param {ASTNode} prevElements
 * @param {ASTNode} nextElements
 * @param {Object[]} animations
 * @returns {DiffElementResult}
 */
export const diffElements = (prevElements, nextElements, animations = []) => {
  const allIdSet = new Set();
  const prevElementMap = new Map();
  const nextElementMap = new Map();
  console.log("Prev elements: ",prevElements)
  console.log("Next elements: ",nextElements)

  const toAddElement = [];
  const toDeleteElement = [];
  const toUpdateElement = [];

  for (const element of prevElements) {
    allIdSet.add(element.id);
    prevElementMap.set(element.id, element);
  }

  for (const element of nextElements) {
    allIdSet.add(element.id);
    nextElementMap.set(element.id, element);
  }

  for (const id of allIdSet) {
    const prevEl = prevElementMap.get(id);
    const nextEl = nextElementMap.get(id);

    if (!prevEl && nextEl) {
      // New element
      toAddElement.push(nextEl);
    } else if (prevEl && !nextEl) {
      // Element is deleted
      toDeleteElement.push(prevEl);
    } else if (
      JSON.stringify(prevEl) !== JSON.stringify(nextEl) ||
      animations.find((transition) => transition.targetId === nextEl.id)
    ) {
      //Update element
      toUpdateElement.push({
        prev: prevEl,
        next: nextEl,
      });
    }
  }
  return { toAddElement, toDeleteElement, toUpdateElement };
};
