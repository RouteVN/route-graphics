const HOVER_PASS_THROUGH = Symbol.for("routeGraphics.hoverPassThrough");
const HOVER_PASS_THROUGH_INSTALLED = Symbol.for(
  "routeGraphics.hoverPassThroughInstalled",
);

// Upstream events whose hit test picks the target of a press, a release or a
// wheel turn. A hover-only element is skipped for these, so the element
// beneath it receives the input. Moves and pointerover still hit it, so its
// hover state, cursor and occlusion are unchanged.
const PASS_THROUGH_EVENT_TYPES = new Set([
  "pointerdown",
  "pointerup",
  "pointerupoutside",
  "wheel",
]);

/**
 * Whether hover is the element's only pointer binding.
 * @param {object} element
 * @returns {boolean}
 */
export const isHoverOnlyInteraction = (element) =>
  Boolean(
    element?.hover &&
      !element.click &&
      !element.rightClick &&
      !element.scrollUp &&
      !element.scrollDown &&
      !element.drag,
  );

/**
 * Mark a leaf display object so press, release and wheel hit tests skip it.
 * @param {import("pixi.js").Container} displayObject
 * @param {boolean} enabled
 */
export const setHoverPassThrough = (displayObject, enabled) => {
  if (!displayObject) {
    return;
  }

  if (enabled) {
    displayObject[HOVER_PASS_THROUGH] = true;
    return;
  }

  delete displayObject[HOVER_PASS_THROUGH];
};

export const isHoverPassThrough = (displayObject) =>
  displayObject?.[HOVER_PASS_THROUGH] === true;

/**
 * Make an event boundary skip hover-only elements, and their internal
 * children, when it hit-tests a press, a release or a wheel event.
 * @param {import("pixi.js").EventBoundary} boundary
 */
export const installHoverPassThrough = (boundary) => {
  if (
    typeof boundary?.mapEvent !== "function" ||
    typeof boundary.hitPruneFn !== "function" ||
    boundary[HOVER_PASS_THROUGH_INSTALLED]
  ) {
    return;
  }

  const mapEvent = boundary.mapEvent.bind(boundary);
  const hitPruneFn = boundary.hitPruneFn;
  let isPassThroughEvent = false;

  boundary.mapEvent = (event) => {
    const wasPassThroughEvent = isPassThroughEvent;
    isPassThroughEvent = PASS_THROUGH_EVENT_TYPES.has(event?.type);

    try {
      mapEvent(event);
    } finally {
      isPassThroughEvent = wasPassThroughEvent;
    }
  };
  boundary.hitPruneFn = (container, location) =>
    (isPassThroughEvent && isHoverPassThrough(container)) ||
    hitPruneFn(container, location);
  boundary[HOVER_PASS_THROUGH_INSTALLED] = true;
};
