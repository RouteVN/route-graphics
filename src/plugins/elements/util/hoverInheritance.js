const SET_INHERITED_HOVER = Symbol.for("routeGraphics.setInheritedHover");
const TREE_INHERITED_HOVER_ACTIVE = Symbol.for(
  "routeGraphics.treeInheritedHoverActive",
);

const getChildren = (displayObject) =>
  Array.isArray(displayObject?.children) ? displayObject.children : [];

const setTargetInheritedHover = (displayObject, isHovered) => {
  const setInheritedHover = displayObject?.[SET_INHERITED_HOVER];

  if (typeof setInheritedHover === "function") {
    setInheritedHover(isHovered);
  }
};

export const clearInheritedHoverTarget = (displayObject) => {
  if (displayObject && SET_INHERITED_HOVER in displayObject) {
    delete displayObject[SET_INHERITED_HOVER];
  }
};

export const createHoverStateController = ({
  displayObject,
  onHoverChange,
}) => {
  let isDirectHovering = false;
  let isInheritedHovering = false;

  const applyHoverState = ({
    nextDirectHovering = isDirectHovering,
    nextInheritedHovering = isInheritedHovering,
  }) => {
    const wasHovering = isDirectHovering || isInheritedHovering;
    isDirectHovering = nextDirectHovering;
    isInheritedHovering = nextInheritedHovering;
    const isHovering = isDirectHovering || isInheritedHovering;

    if (wasHovering !== isHovering) {
      onHoverChange(isHovering);
    }

    return isHovering;
  };

  displayObject[SET_INHERITED_HOVER] = (isHovered) =>
    applyHoverState({ nextInheritedHovering: isHovered });

  return {
    setDirectHover: (isHovered) =>
      applyHoverState({ nextDirectHovering: isHovered }),
    isHovering: () => isDirectHovering || isInheritedHovering,
    destroy: () => {
      clearInheritedHoverTarget(displayObject);
    },
  };
};

export const getTreeInheritedHoverState = (displayObject) =>
  displayObject?.[TREE_INHERITED_HOVER_ACTIVE] === true;

export const setTreeInheritedHover = ({ root, isHovered }) => {
  if (!root) {
    return;
  }

  root[TREE_INHERITED_HOVER_ACTIVE] = isHovered;

  const stack = [...getChildren(root)];

  while (stack.length > 0) {
    const displayObject = stack.pop();

    setTargetInheritedHover(displayObject, isHovered);
    stack.push(...getChildren(displayObject));
  }
};
