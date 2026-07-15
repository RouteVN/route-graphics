const ELEMENT_RENDER_STATE = Symbol("routeGraphicsElementRenderState");

// JSON state is committed synchronously, while plugin mounts and removals may
// finish later. Keep the mounted type and deferred replacements separate from
// that committed state so a superseding render can reconcile the live stage.
const managedParents = new WeakSet();
const pendingReplacementsByParent = new WeakMap();
const pendingReplacementsByRoot = new WeakMap();

export const getElementRenderState = (displayObject) =>
  displayObject?.[ELEMENT_RENDER_STATE] ?? null;

export const setElementRenderState = (displayObject, element) => {
  if (!displayObject || !element) {
    return;
  }

  displayObject[ELEMENT_RENDER_STATE] = element;
};

const getRenderRoot = (parent) => {
  let root = parent;

  while (root?.parent) {
    root = root.parent;
  }

  return root;
};

const collectElementInfoById = (
  elements,
  elementInfoById = new Map(),
  ownerElementId = null,
) => {
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index];
    elementInfoById.set(element.id, {
      element,
      ownerElementId,
      zIndex: index,
    });

    if (Array.isArray(element.children)) {
      collectElementInfoById(element.children, elementInfoById, element.id);
    }
  }

  return elementInfoById;
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

export const addElementWithRenderState = ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationBus,
  completionTracker,
  elementPlugins,
  renderContext,
  zIndex,
  signal,
  plugin,
}) => {
  const operation = plugin.add({
    app,
    parent,
    element,
    animations,
    eventHandler,
    animationBus,
    completionTracker,
    elementPlugins,
    renderContext,
    zIndex,
    signal,
  });

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

const updatePendingReplacement = (
  replacement,
  {
    app,
    elementInfo,
    animations,
    animationBus,
    completionTracker,
    eventHandler,
    elementPlugins,
    renderContext,
    signal,
  },
) => {
  replacement.app = app;
  replacement.nextElement = elementInfo?.element ?? null;
  replacement.zIndex = elementInfo?.zIndex ?? -1;
  replacement.animations = animations;
  replacement.animationBus = animationBus;
  replacement.completionTracker = completionTracker;
  replacement.eventHandler = eventHandler;
  replacement.elementPlugins = elementPlugins;
  replacement.renderContext = renderContext;
  adoptPendingReplacementSignal(replacement, signal);
};

const adoptPendingReplacementSignal = (replacement, signal) => {
  if (
    replacement.signal === signal &&
    replacement.signalOwnershipRegistered === true
  ) {
    return;
  }

  replacement.removeSignalAbortListener?.();
  replacement.signal = signal;
  replacement.signalOwnershipRegistered = true;
  if (!signal) {
    return;
  }

  const abortOperationIfStillOwned = () => {
    // RouteGraphics aborts the old signal immediately before starting the next
    // render. Defer the ownership check so that synchronous render can adopt
    // the pending replacement first; destruction has no adopter and aborts it.
    queueMicrotask(() => {
      if (replacement.signal === signal) {
        replacement.operationController.abort();
      }
    });
  };

  if (signal.aborted) {
    abortOperationIfStillOwned();
    return;
  }

  signal.addEventListener("abort", abortOperationIfStillOwned, {
    once: true,
  });
  replacement.removeSignalAbortListener = () => {
    signal.removeEventListener("abort", abortOperationIfStillOwned);
  };
};

const mountPendingReplacement = (replacement) => {
  const { nextElement, parent, signal } = replacement;
  if (!nextElement || signal?.aborted || parent.destroyed) {
    return undefined;
  }

  const plugin = replacement.elementPlugins.find(
    (candidate) => candidate.type === nextElement.type,
  );
  if (!plugin) {
    throw new Error(`No plugin found for element type: ${nextElement.type}`);
  }

  return addElementWithRenderState({
    ...replacement,
    element: nextElement,
    plugin,
  });
};

const removePendingReplacement = (replacement, replacements) => {
  replacement.removeSignalAbortListener?.();
  replacement.removeSignalAbortListener = null;
  replacements.delete(replacement.id);
  if (replacements.size === 0) {
    pendingReplacementsByParent.delete(replacement.parent);
  }

  const rootReplacements = pendingReplacementsByRoot.get(replacement.root);
  rootReplacements?.delete(replacement);
  if (rootReplacements?.size === 0) {
    pendingReplacementsByRoot.delete(replacement.root);
  }
};

export const prepareElementRenderState = ({
  app,
  parent,
  prevComputedTree,
  nextComputedTree,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  elementPlugins,
  renderContext,
  signal,
}) => {
  const wasParentManaged = managedParents.has(parent);
  const committedPrevElementById = new Map(
    prevComputedTree.map((element) => [element.id, element]),
  );
  const nextElementInfoById = new Map(
    nextComputedTree.map((element, zIndex) => [
      element.id,
      { element, zIndex },
    ]),
  );
  const pendingReplacements = pendingReplacementsByParent.get(parent);
  const renderRoot = getRenderRoot(parent);

  if (renderRoot === parent) {
    // A pending replacement may be nested under an unchanged container, whose
    // own renderElements call will be skipped. Refresh every descendant record
    // from the root tree so those operations are adopted as well.
    const elementInfoById = collectElementInfoById(nextComputedTree);
    const rootReplacements = pendingReplacementsByRoot.get(renderRoot);

    for (const replacement of rootReplacements ?? []) {
      const elementInfo = elementInfoById.get(replacement.id);
      updatePendingReplacement(replacement, {
        app,
        elementInfo:
          elementInfo?.ownerElementId === replacement.ownerElementId
            ? elementInfo
            : undefined,
        animations,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        signal,
      });
    }
  }

  if (!wasParentManaged) {
    for (const child of parent.children) {
      const element = committedPrevElementById.get(child.label);
      if (element) {
        setElementRenderState(child, element);
      }
    }
  }

  let renderedPrevComputedTree = prevComputedTree;
  if (wasParentManaged) {
    // Prefer the definition attached to the actual display object whenever its
    // type differs from the optimistically committed previous JSON state.
    const renderedElementById = new Map();

    for (const child of parent.children) {
      if (child.destroyed) {
        continue;
      }

      let renderedElement = getElementRenderState(child);
      const committedElement = committedPrevElementById.get(child.label);

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

    renderedPrevComputedTree = Array.from(renderedElementById.values());
  }

  if (pendingReplacements) {
    const renderedElementById = new Map(
      renderedPrevComputedTree.map((element) => [element.id, element]),
    );

    for (const replacement of pendingReplacements.values()) {
      updatePendingReplacement(replacement, {
        app,
        elementInfo: nextElementInfoById.get(replacement.id),
        animations,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        signal,
      });

      if (replacement.nextElement) {
        renderedElementById.set(replacement.id, replacement.nextElement);
      } else {
        renderedElementById.delete(replacement.id);
      }
    }

    renderedPrevComputedTree = Array.from(renderedElementById.values());
  }

  managedParents.add(parent);

  return {
    ownerElementId: getOwnerElementId(parent),
    pendingReplacementIds: new Set(pendingReplacements?.keys() ?? []),
    renderedPrevComputedTree,
    renderRoot,
  };
};

export const registerPendingElementReplacement = ({
  deleteOperation,
  replacement,
}) => {
  const replacements =
    pendingReplacementsByParent.get(replacement.parent) ?? new Map();
  replacements.set(replacement.id, replacement);
  pendingReplacementsByParent.set(replacement.parent, replacements);

  const rootReplacements =
    pendingReplacementsByRoot.get(replacement.root) ?? new Set();
  rootReplacements.add(replacement);
  pendingReplacementsByRoot.set(replacement.root, rootReplacements);
  adoptPendingReplacementSignal(replacement, replacement.signal);

  const finishReplacement = () => {
    if (replacements.get(replacement.id) !== replacement) {
      return undefined;
    }

    removePendingReplacement(replacement, replacements);
    return mountPendingReplacement(replacement);
  };

  return deleteOperation.then(finishReplacement, (error) => {
    if (replacements.get(replacement.id) === replacement) {
      removePendingReplacement(replacement, replacements);
    }
    throw error;
  });
};
