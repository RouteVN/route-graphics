import {
  getElementHitTestBounds,
  getElementRenderState,
} from "../plugins/elements/elementRenderState.js";

const SPRITE_ELEMENT_TYPES = new Set([
  "sprite",
  "video",
  "animated-sprite",
  "spritesheet-animation",
]);

const isFinitePoint = (point) =>
  Number.isFinite(point?.x) && Number.isFinite(point?.y);

const isDisplayObjectVisible = (displayObject) =>
  displayObject &&
  displayObject.destroyed !== true &&
  displayObject.visible !== false &&
  displayObject.renderable !== false;

const getRectangle = ({ x = 0, y = 0, width, height }) => ({
  x,
  y,
  width,
  height,
});

const getTextLayoutOffsetX = (element) => {
  if (Array.isArray(element.content) || element.__fixedWidth !== true) {
    return 0;
  }

  const measuredWidth = element.measuredWidth ?? element.width;
  const remainingWidth = Math.max(0, element.width - measuredWidth);
  const align = element.textStyle?.align;

  if (align === "center") {
    return remainingWidth / 2;
  }

  if (align === "right") {
    return remainingWidth;
  }

  return 0;
};

const getLocalHitRectangle = ({ displayObject, element }) => {
  const liveHitBounds = getElementHitTestBounds(displayObject);
  if (liveHitBounds) {
    return getRectangle(liveHitBounds);
  }

  if (SPRITE_ELEMENT_TYPES.has(element.type)) {
    const localBounds = displayObject.getLocalBounds?.();
    const rectangle = localBounds?.rectangle ?? localBounds;

    if (
      Number.isFinite(rectangle?.x) &&
      Number.isFinite(rectangle?.y) &&
      Number.isFinite(rectangle?.width) &&
      Number.isFinite(rectangle?.height) &&
      rectangle.width > 0 &&
      rectangle.height > 0
    ) {
      return getRectangle(rectangle);
    }
  }

  if (element.type === "text") {
    return getRectangle({
      x: -getTextLayoutOffsetX(element),
      width: element.width,
      height: element.height,
    });
  }

  return getRectangle({
    width: element.width,
    height: element.height,
  });
};

const containsPoint = ({ displayObject, rectangle, point }) => {
  if (
    !Number.isFinite(rectangle.width) ||
    !Number.isFinite(rectangle.height) ||
    rectangle.width <= 0 ||
    rectangle.height <= 0 ||
    typeof displayObject.toLocal !== "function"
  ) {
    return false;
  }

  const localPoint = displayObject.toLocal(point);

  return (
    localPoint.x >= rectangle.x &&
    localPoint.x <= rectangle.x + rectangle.width &&
    localPoint.y >= rectangle.y &&
    localPoint.y <= rectangle.y + rectangle.height
  );
};

const getTransformedBounds = ({ displayObject, rectangle }) => {
  if (typeof displayObject.toGlobal !== "function") {
    return undefined;
  }

  const corners = [
    displayObject.toGlobal({ x: rectangle.x, y: rectangle.y }),
    displayObject.toGlobal({
      x: rectangle.x + rectangle.width,
      y: rectangle.y,
    }),
    displayObject.toGlobal({
      x: rectangle.x + rectangle.width,
      y: rectangle.y + rectangle.height,
    }),
    displayObject.toGlobal({
      x: rectangle.x,
      y: rectangle.y + rectangle.height,
    }),
  ].map(({ x, y }) => ({ x, y }));
  const xValues = corners.map(({ x }) => x);
  const yValues = corners.map(({ y }) => y);
  const x = Math.min(...xValues);
  const y = Math.min(...yValues);

  return {
    x,
    y,
    width: Math.max(...xValues) - x,
    height: Math.max(...yValues) - y,
    corners,
  };
};

const getRenderChildren = (displayObject) =>
  displayObject?.__routeGraphicsScrollController?.contentContainer?.children ??
  displayObject?.children ??
  [];

const pairElementsWithDisplays = ({ elements, parent }) => {
  const renderChildren = getRenderChildren(parent);
  const displaysByLabel = new Map();
  const paintIndexByDisplay = new Map();
  const pairs = [];
  const pairedDisplays = new Set();
  const elementIndexById = new Map(
    elements.map((element, index) => [element.id, index]),
  );

  for (let paintIndex = 0; paintIndex < renderChildren.length; paintIndex++) {
    const displayObject = renderChildren[paintIndex];
    const renderedElement = getElementRenderState(displayObject);

    if (renderedElement) {
      pairs.push({
        displayObject,
        element: renderedElement,
        elementIndex: elementIndexById.get(renderedElement.id) ?? paintIndex,
        paintIndex,
      });
      pairedDisplays.add(displayObject);
      paintIndexByDisplay.set(displayObject, paintIndex);
      continue;
    }

    const matches = displaysByLabel.get(displayObject.label) ?? [];
    matches.push(displayObject);
    displaysByLabel.set(displayObject.label, matches);
    paintIndexByDisplay.set(displayObject, paintIndex);
  }

  const displayIndexByLabel = new Map();

  return pairs.concat(
    elements.flatMap((element, elementIndex) => {
      const displays = displaysByLabel.get(element.id) ?? [];
      const displayIndex = displayIndexByLabel.get(element.id) ?? 0;
      const displayObject = displays[displayIndex];
      displayIndexByLabel.set(element.id, displayIndex + 1);

      if (!displayObject || pairedDisplays.has(displayObject)) {
        return [];
      }

      const paintIndex = paintIndexByDisplay.get(displayObject) ?? -1;

      return [{ displayObject, element, elementIndex, paintIndex }];
    }),
  );
};

const orderFrontToBack = (pairs) =>
  pairs.sort((left, right) => {
    const zIndexDifference =
      (right.displayObject.zIndex ?? right.elementIndex) -
      (left.displayObject.zIndex ?? left.elementIndex);

    if (zIndexDifference !== 0) {
      return zIndexDifference;
    }

    return right.paintIndex - left.paintIndex;
  });

const isInsideClips = ({ clips, point }) =>
  clips.every(({ displayObject, rectangle }) =>
    containsPoint({ displayObject, rectangle, point }),
  );

const getViewportClip = (displayObject) => {
  const controller = displayObject.__routeGraphicsScrollController;

  if (!controller) {
    return undefined;
  }

  return {
    displayObject,
    rectangle: getRectangle({
      width: controller.viewportWidth,
      height: controller.viewportHeight,
    }),
  };
};

const hitTestElement = ({ displayObject, element, point, path, clips }) => {
  if (!isDisplayObjectVisible(displayObject)) {
    return [];
  }

  if (!isInsideClips({ clips, point })) {
    return [];
  }

  const rectangle = getLocalHitRectangle({ displayObject, element });
  const bounds = getTransformedBounds({ displayObject, rectangle });
  const pathEntry = {
    id: element.id,
    type: element.type,
    bounds,
  };
  const nextPath = [...path, pathEntry];
  const viewportClip = getViewportClip(displayObject);
  const childClips = viewportClip ? [...clips, viewportClip] : clips;
  const childPairs = orderFrontToBack(
    pairElementsWithDisplays({
      elements: element.children ?? [],
      parent: displayObject,
    }),
  );
  const childHits = childPairs.flatMap((pair) =>
    hitTestElement({
      ...pair,
      point,
      path: nextPath,
      clips: childClips,
    }),
  );

  if (childHits.length > 0) {
    return childHits;
  }

  if (
    containsPoint({ displayObject, rectangle, point }) &&
    (!viewportClip || isInsideClips({ clips: [viewportClip], point }))
  ) {
    return [{ path: nextPath }];
  }

  return [];
};

/**
 * Hit-tests semantic Route Graphics elements by their live transformed bounds.
 * Results are ordered front-to-back and each result represents one rendered
 * branch from a root element to its deepest hit descendant.
 */
export const hitTestElementBounds = ({ stage, elements = [], x, y }) => {
  const point = { x, y };

  if (!stage || !Array.isArray(elements) || !isFinitePoint(point)) {
    return [];
  }

  return orderFrontToBack(
    pairElementsWithDisplays({ elements, parent: stage }),
  ).flatMap((pair) =>
    hitTestElement({
      ...pair,
      point,
      path: [],
      clips: [],
    }),
  );
};
