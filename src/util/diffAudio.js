/**
 * @typedef {import("../types.js").DiffElementResult} DiffElementResult
 * @typedef {import("../types.js").SoundElement} SoundElement
 */

/**
 *
 * @param {SoundElement[]} prevElements
 * @param {SoundElement[]} nextElements
 * @returns {DiffElementResult}
 */
export const diffAudio = (prevElements = [], nextElements = []) => {
  const allIdSet = new Set();
  const prevElementMap = new Map();
  const nextElementMap = new Map();

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
      toAddElement.push(nextEl);
    } else if (prevEl && !nextEl) {
      toDeleteElement.push(prevEl);
    } else if (
      prevEl.src !== nextEl.src ||
      prevEl.volume !== nextEl.volume ||
      prevEl.loop !== nextEl.loop ||
      prevEl.startDelayMs !== nextEl.startDelayMs ||
      prevEl.muted !== nextEl.muted ||
      prevEl.pan !== nextEl.pan ||
      prevEl.playbackRate !== nextEl.playbackRate ||
      prevEl.startAt !== nextEl.startAt ||
      prevEl.endAt !== nextEl.endAt
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
