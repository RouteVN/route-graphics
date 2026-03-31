const SET_INHERITED_HOVER = Symbol.for("routeGraphics.setInheritedHover");
const TREE_INHERITED_HOVER_ACTIVE = Symbol.for(
  "routeGraphics.treeInheritedHoverActive",
);
const SET_INHERITED_PRESS = Symbol.for("routeGraphics.setInheritedPress");
const TREE_INHERITED_PRESS_ACTIVE = Symbol.for(
  "routeGraphics.treeInheritedPressActive",
);

const getChildren = (displayObject) =>
  Array.isArray(displayObject?.children) ? displayObject.children : [];

const setTargetInheritedState = ({ displayObject, symbol, isActive }) => {
  const setInheritedState = displayObject?.[symbol];

  if (typeof setInheritedState === "function") {
    setInheritedState(isActive);
  }
};

const clearInheritedTarget = ({ displayObject, symbol }) => {
  if (displayObject && symbol in displayObject) {
    delete displayObject[symbol];
  }
};

const createInheritedStateController = ({
  displayObject,
  symbol,
  onStateChange,
}) => {
  let isDirectActive = false;
  let isInheritedActive = false;

  const applyState = ({
    nextDirectActive = isDirectActive,
    nextInheritedActive = isInheritedActive,
  }) => {
    const wasActive = isDirectActive || isInheritedActive;
    isDirectActive = nextDirectActive;
    isInheritedActive = nextInheritedActive;
    const isActive = isDirectActive || isInheritedActive;

    if (wasActive !== isActive) {
      onStateChange(isActive);
    }

    return isActive;
  };

  displayObject[symbol] = (isActive) =>
    applyState({ nextInheritedActive: isActive });

  return {
    setDirectState: (isActive) => applyState({ nextDirectActive: isActive }),
    isActive: () => isDirectActive || isInheritedActive,
    destroy: () => {
      clearInheritedTarget({ displayObject, symbol });
    },
  };
};

export const clearInheritedHoverTarget = (displayObject) =>
  clearInheritedTarget({ displayObject, symbol: SET_INHERITED_HOVER });

export const clearInheritedPressTarget = (displayObject) =>
  clearInheritedTarget({ displayObject, symbol: SET_INHERITED_PRESS });

export const createHoverStateController = ({
  displayObject,
  onHoverChange,
}) => {
  const controller = createInheritedStateController({
    displayObject,
    symbol: SET_INHERITED_HOVER,
    onStateChange: onHoverChange,
  });

  return {
    setDirectHover: controller.setDirectState,
    isHovering: controller.isActive,
    destroy: controller.destroy,
  };
};

export const createPressStateController = ({
  displayObject,
  onPressChange,
}) => {
  const controller = createInheritedStateController({
    displayObject,
    symbol: SET_INHERITED_PRESS,
    onStateChange: onPressChange,
  });

  return {
    setDirectPress: controller.setDirectState,
    isPressed: controller.isActive,
    destroy: controller.destroy,
  };
};

export const getTreeInheritedHoverState = (displayObject) =>
  displayObject?.[TREE_INHERITED_HOVER_ACTIVE] === true;

export const getTreeInheritedPressState = (displayObject) =>
  displayObject?.[TREE_INHERITED_PRESS_ACTIVE] === true;

export const setTreeInheritedHover = ({ root, isHovered }) => {
  if (!root) {
    return;
  }

  root[TREE_INHERITED_HOVER_ACTIVE] = isHovered;

  const stack = [...getChildren(root)];

  while (stack.length > 0) {
    const displayObject = stack.pop();

    setTargetInheritedState({
      displayObject,
      symbol: SET_INHERITED_HOVER,
      isActive: isHovered,
    });
    stack.push(...getChildren(displayObject));
  }
};

export const setTreeInheritedPress = ({ root, isPressed }) => {
  if (!root) {
    return;
  }

  root[TREE_INHERITED_PRESS_ACTIVE] = isPressed;

  const stack = [...getChildren(root)];

  while (stack.length > 0) {
    const displayObject = stack.pop();

    setTargetInheritedState({
      displayObject,
      symbol: SET_INHERITED_PRESS,
      isActive: isPressed,
    });
    stack.push(...getChildren(displayObject));
  }
};
