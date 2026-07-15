const ELEMENT_RENDER_STATE = Symbol("routeGraphicsElementRenderState");
const PARENT_RENDER_STATE = Symbol("routeGraphicsParentRenderState");
const RENDER_LIFECYCLE = Symbol("routeGraphicsElementRenderLifecycle");

export const getElementRenderState = (displayObject) =>
  displayObject?.[ELEMENT_RENDER_STATE] ?? null;

export const setElementRenderState = (displayObject, element) => {
  if (displayObject && element) {
    displayObject[ELEMENT_RENDER_STATE] = element;
  }
};

const getParentRenderState = (parent) => {
  if (!parent[PARENT_RENDER_STATE]) {
    parent[PARENT_RENDER_STATE] = {
      lifecycle: null,
      managed: false,
      pendingReplacements: new Map(),
    };
  }

  return parent[PARENT_RENDER_STATE];
};

const getMountedChild = (parent, element) => {
  for (let index = parent.children.length - 1; index >= 0; index--) {
    if (parent.children[index].label === element.id) {
      return parent.children[index];
    }
  }

  return undefined;
};

const markMountedElement = (parent, element) => {
  const child = getMountedChild(parent, element);
  if (child && !child.destroyed) {
    setElementRenderState(child, element);
  }
};

export const addElementWithRenderState = ({ plugin, ...options }) => {
  const operation = plugin.add(options);
  const { parent, element, signal } = options;

  markMountedElement(parent, element);

  if (operation && typeof operation.then === "function") {
    return operation.then(() => {
      if (!signal?.aborted && !parent.destroyed) {
        markMountedElement(parent, element);
      }
    });
  }

  return operation;
};

const collectDesiredElements = (
  elements,
  desiredElementById = new Map(),
  ownerElementId = null,
) => {
  for (let zIndex = 0; zIndex < elements.length; zIndex++) {
    const element = elements[zIndex];
    desiredElementById.set(element.id, {
      element,
      ownerElementId,
      zIndex,
    });

    if (Array.isArray(element.children)) {
      collectDesiredElements(element.children, desiredElementById, element.id);
    }
  }

  return desiredElementById;
};

const getOwnerElementId = (parent) => {
  let ancestor = parent;

  while (ancestor) {
    const element = getElementRenderState(ancestor);
    if (element) {
      return element.id;
    }
    ancestor = ancestor.parent;
  }

  return null;
};

const createLifecycle = () => ({
  currentRender: null,
  desiredElementById: new Map(),
});

const getLifecycle = (parent, renderContext) => {
  const contextLifecycle = renderContext[RENDER_LIFECYCLE];
  if (contextLifecycle) {
    return { lifecycle: contextLifecycle, isRootRender: false };
  }

  const parentState = getParentRenderState(parent);
  const lifecycle = parentState.lifecycle ?? createLifecycle();
  parentState.lifecycle = lifecycle;

  renderContext[RENDER_LIFECYCLE] = lifecycle;
  return { lifecycle, isRootRender: true };
};

const beginRootRender = (
  lifecycle,
  { parent, nextComputedTree, mountElement, signal },
) => {
  lifecycle.currentRender = {
    mountElement,
    signal,
  };
  lifecycle.desiredElementById = collectDesiredElements(
    nextComputedTree,
    new Map(),
    getOwnerElementId(parent),
  );
};

const getRenderedPreviousElements = (parent, prevComputedTree) => {
  const parentState = getParentRenderState(parent);
  const committedElementById = new Map(
    prevComputedTree.map((element) => [element.id, element]),
  );

  if (!parentState.managed) {
    for (const child of parent.children) {
      const committedElement = committedElementById.get(child.label);
      if (committedElement) {
        setElementRenderState(child, committedElement);
      }
    }

    parentState.managed = true;
    return prevComputedTree;
  }

  const renderedElementById = new Map();
  for (const child of parent.children) {
    if (child.destroyed) {
      continue;
    }

    let renderedElement = getElementRenderState(child);
    const committedElement = committedElementById.get(child.label);

    if (!renderedElement && committedElement) {
      renderedElement = committedElement;
      setElementRenderState(child, committedElement);
    }

    if (renderedElement) {
      renderedElementById.set(
        renderedElement.id,
        committedElement?.type === renderedElement.type
          ? committedElement
          : renderedElement,
      );
    }
  }

  return Array.from(renderedElementById.values());
};

export const prepareElementRenderState = ({
  parent,
  prevComputedTree,
  nextComputedTree,
  mountElement,
  renderContext,
  signal,
}) => {
  const { lifecycle, isRootRender } = getLifecycle(parent, renderContext);
  if (isRootRender) {
    beginRootRender(lifecycle, {
      parent,
      nextComputedTree,
      mountElement,
      signal,
    });
  }

  const pendingReplacements = getParentRenderState(parent).pendingReplacements;
  return {
    lifecycle,
    ownerElementId: getOwnerElementId(parent),
    pendingReplacementIds: new Set(pendingReplacements?.keys() ?? []),
    renderedPrevComputedTree: getRenderedPreviousElements(
      parent,
      prevComputedTree,
    ),
  };
};

const removePendingReplacement = (replacement) => {
  const replacements = getParentRenderState(
    replacement.parent,
  ).pendingReplacements;
  if (replacements.get(replacement.id) !== replacement) {
    return false;
  }

  replacements.delete(replacement.id);
  return true;
};

const mountPendingReplacement = (lifecycle, replacement) => {
  const { currentRender } = lifecycle;
  if (
    !currentRender ||
    currentRender.signal?.aborted ||
    replacement.parent.destroyed
  ) {
    return undefined;
  }

  const desiredElement = lifecycle.desiredElementById.get(replacement.id);
  if (desiredElement?.ownerElementId !== replacement.ownerElementId) {
    return undefined;
  }

  return currentRender.mountElement({
    parent: replacement.parent,
    element: desiredElement.element,
    zIndex: desiredElement.zIndex,
  });
};

export const registerPendingElementReplacement = ({
  deleteOperation,
  lifecycle,
  replacement,
}) => {
  const replacements = getParentRenderState(
    replacement.parent,
  ).pendingReplacements;
  replacements.set(replacement.id, replacement);

  const finishReplacement = () => {
    if (!removePendingReplacement(replacement)) {
      return undefined;
    }
    return mountPendingReplacement(lifecycle, replacement);
  };

  return deleteOperation.then(finishReplacement, (error) => {
    removePendingReplacement(replacement);
    throw error;
  });
};
